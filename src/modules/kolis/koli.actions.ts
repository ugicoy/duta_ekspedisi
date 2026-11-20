"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { generateKoliNo } from "@/lib/code-generator";
import { prisma } from "@/lib/prisma";

const createKoliSchema = z.object({
  origin_warehouse_id: z.string().uuid("Gudang asal tidak valid"),
  shipment_ids: z
    .array(z.string().uuid("ID resi tidak valid"))
    .min(1, "Pilih minimal 1 resi untuk dikonsolidasi ke dalam koli"),
});

export async function createKoliAction(data: {
  origin_warehouse_id: string;
  shipment_ids: string[];
}) {
  const session = await requirePermission("koli:manage");

  const parsed = createKoliSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ?? "Data konsolidasi koli tidak valid.",
    };
  }

  const { origin_warehouse_id, shipment_ids } = parsed.data;

  try {
    const [warehouse, shipments] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: origin_warehouse_id } }),
      prisma.shipment.findMany({
        where: { id: { in: shipment_ids } },
        include: {
          destWarehouse: true,
          koliItems: { where: { released_at: null } },
        },
      }),
    ]);

    if (!warehouse || !warehouse.is_active) {
      return { success: false, error: "Gudang asal tidak aktif." };
    }
    if (shipments.length !== shipment_ids.length) {
      return {
        success: false,
        error: "Sebagian resi yang dipilih tidak ditemukan.",
      };
    }

    const invalidShipment = shipments.find(
      (s) => s.status !== "RECEIVED_AT_ORIGIN" || s.koliItems.length > 0,
    );
    if (invalidShipment) {
      return {
        success: false,
        error: `Resi ${invalidShipment.shipment_no} tidak memenuhi syarat atau sudah masuk ke dalam koli aktif.`,
      };
    }

    const distinctDestIds = new Set(shipments.map((s) => s.dest_warehouse_id));
    if (distinctDestIds.size > 1) {
      return {
        success: false,
        error:
          "Semua resi dalam satu koli konsolidasi harus memiliki gudang tujuan yang sama.",
      };
    }

    const destCode = shipments[0]?.destWarehouse.code ?? "SB";

    const createdKoli = await prisma.$transaction(async (tx) => {
      let koliNo = generateKoliNo(warehouse.code, destCode);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const collision = await tx.koli.findUnique({
          where: { koli_no: koliNo },
          select: { id: true },
        });
        if (!collision) break;
        koliNo = generateKoliNo(warehouse.code, destCode);
      }

      const barcode = koliNo;

      const koli = await tx.koli.create({
        data: {
          koli_no: koliNo,
          barcode,
          status: "PACKED",
          koliItems: {
            create: shipments.map((s) => ({
              shipment_id: s.id,
            })),
          },
        },
      });

      for (const s of shipments) {
        await tx.warehouseMovement.create({
          data: {
            warehouse_id: origin_warehouse_id,
            shipment_id: s.id,
            movement_type: "PACKED_INTO_KOLI",
            actor_id: session.userId,
            notes: `Dikonsolidasi ke dalam koli ${koliNo}`,
          },
        });

        await tx.trackingEvent.create({
          data: {
            shipment_id: s.id,
            status: s.status,
            description: `Barang dikemas ke dalam koli konsolidasi ${koliNo}.`,
            location: `${warehouse.name} (${warehouse.city})`,
          },
        });
      }

      return koli;
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_KOLI",
      entityName: "Koli",
      entityId: createdKoli.id,
      newValues: {
        koli_no: createdKoli.koli_no,
        barcode: createdKoli.barcode,
        shipment_count: shipments.length,
      },
    });

    revalidatePath("/dashboard/kolis");
    revalidatePath("/dashboard/shipments");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to create koli:", error);
    return {
      success: false,
      error: "Gagal membuat konsolidasi koli baru.",
    };
  }
}

export async function unpackKoliAction(koliId: string) {
  const session = await requirePermission("koli:manage");

  try {
    const koli = await prisma.koli.findUnique({
      where: { id: koliId },
      include: {
        koliItems: {
          where: { released_at: null },
          include: {
            shipment: {
              include: {
                originWarehouse: true,
                destWarehouse: true,
              },
            },
          },
        },
      },
    });

    if (!koli) {
      return { success: false, error: "Data koli tidak ditemukan." };
    }
    if (koli.status !== "PACKED" && koli.status !== "RECEIVED") {
      return {
        success: false,
        error: `Koli berstatus ${koli.status} tidak dapat dibongkar.`,
      };
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.koli.update({
        where: { id: koliId },
        data: { status: "UNPACKED" },
      });

      await tx.koliItem.updateMany({
        where: { koli_id: koliId, released_at: null },
        data: { released_at: now },
      });

      for (const item of koli.koliItems) {
        const isDest =
          item.shipment.status === "ARRIVED_AT_DESTINATION" ||
          item.shipment.status === "OUT_FOR_DELIVERY" ||
          item.shipment.status === "DELIVERED";
        const activeWh = isDest
          ? item.shipment.destWarehouse
          : item.shipment.originWarehouse;

        await tx.warehouseMovement.create({
          data: {
            warehouse_id: activeWh.id,
            shipment_id: item.shipment_id,
            movement_type: "UNPACKED_FROM_KOLI",
            actor_id: session.userId,
            notes: `Dikeluarkan dari koli ${koli.koli_no}`,
          },
        });

        await tx.trackingEvent.create({
          data: {
            shipment_id: item.shipment_id,
            status: item.shipment.status,
            description: `Koli konsolidasi ${koli.koli_no} dibongkar (Unpacked).`,
            location: `${activeWh.name} (${activeWh.city})`,
          },
        });
      }
    });

    await createAuditLog({
      userId: session.userId,
      action: "UNPACK_KOLI",
      entityName: "Koli",
      entityId: koliId,
      oldValues: { status: koli.status },
      newValues: { status: "UNPACKED" },
    });

    revalidatePath("/dashboard/kolis");
    revalidatePath("/dashboard/shipments");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to unpack koli:", error);
    return { success: false, error: "Gagal membongkar koli." };
  }
}
