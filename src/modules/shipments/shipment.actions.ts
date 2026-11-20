"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ShipmentStatus } from "@/generated/prisma/enums";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { generateShipmentNo } from "@/lib/code-generator";
import { prisma } from "@/lib/prisma";

const partyInputSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(150),
  phone: z.string().min(5, "Nomor HP minimal 5 digit").max(50),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(100)
    .optional()
    .or(z.literal("")),
  address: z.string().min(5, "Alamat lengkap minimal 5 karakter"),
});

const shipmentItemInputSchema = z.object({
  item_description: z.string().min(2, "Deskripsi item minimal 2 karakter"),
  qty: z.coerce.number().int().positive("Qty harus bernilai positif"),
  weight: z.coerce.number().positive("Berat item harus bernilai positif"),
  length: z.coerce.number().min(0, "Panjang tidak boleh negatif").default(0),
  width: z.coerce.number().min(0, "Lebar tidak boleh negatif").default(0),
  height: z.coerce.number().min(0, "Tinggi tidak boleh negatif").default(0),
  item_type: z.string().min(2, "Tipe item minimal 2 karakter"),
});

const shipmentSchema = z
  .object({
    origin_warehouse_id: z.string().uuid("Warehouse asal tidak valid"),
    dest_warehouse_id: z.string().uuid("Warehouse tujuan tidak valid"),
    sender_mode: z.enum(["NEW", "EXISTING"]),
    sender_id: z
      .string()
      .uuid("Pengirim terdaftar tidak valid")
      .optional()
      .or(z.literal("")),
    sender_data: partyInputSchema.optional(),
    receiver_mode: z.enum(["NEW", "EXISTING"]),
    receiver_id: z
      .string()
      .uuid("Penerima terdaftar tidak valid")
      .optional()
      .or(z.literal("")),
    receiver_data: partyInputSchema.optional(),
    goods_description: z.string().min(2, "Deskripsi barang minimal 2 karakter"),
    pricing_type_id: z.string().uuid("Jenis harga tidak valid"),
    manual_price: z.coerce
      .number()
      .min(0, "Harga manual tidak boleh negatif")
      .default(0),
    payment_option: z.enum(["PAID_NOW", "PAY_ON_PICKUP"]).default("PAID_NOW"),
    payment_method: z.string().max(50).optional().default("Tunai"),
    reference_shipment_id: z
      .string()
      .uuid("ID resi referensi tidak valid")
      .optional()
      .nullable(),
    items: z
      .array(shipmentItemInputSchema)
      .min(1, "Minimal harus ada 1 item barang dalam resi"),
  })
  .superRefine((val, ctx) => {
    if (val.sender_mode === "EXISTING" && !val.sender_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pilih pengirim dari daftar customer terdaftar.",
        path: ["sender_id"],
      });
    }
    if (val.sender_mode === "NEW" && !val.sender_data) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lengkapi data pengirim baru (Nama, No. HP, Alamat).",
        path: ["sender_data"],
      });
    }
    if (val.receiver_mode === "EXISTING" && !val.receiver_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pilih penerima dari daftar customer terdaftar.",
        path: ["receiver_id"],
      });
    }
    if (val.receiver_mode === "NEW" && !val.receiver_data) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Lengkapi data penerima baru (Nama, No. HP, Alamat).",
        path: ["receiver_data"],
      });
    }
  });

const updateStatusSchema = z.object({
  shipment_id: z.string().uuid("ID resi tidak valid"),
  next_status: z.enum([
    "BOOKED",
    "RECEIVED_AT_ORIGIN",
    "ARRIVED_AT_DESTINATION",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
  ]),
  notes: z.string().max(500).optional(),
});

export type ShipmentInput = z.input<typeof shipmentSchema>;

const ALLOWED_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  DRAFT: ["BOOKED", "RECEIVED_AT_ORIGIN", "CANCELLED"],
  BOOKED: ["RECEIVED_AT_ORIGIN", "CANCELLED"],
  RECEIVED_AT_ORIGIN: ["CANCELLED"],
  MANIFESTED: ["IN_TRANSIT"],
  IN_TRANSIT: ["ARRIVED_AT_DESTINATION"],
  ARRIVED_AT_DESTINATION: ["OUT_FOR_DELIVERY", "DELIVERED", "RETURNED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  CANCELLED: [],
  RETURNED: [],
};

const STATUS_DESCRIPTIONS: Record<ShipmentStatus, string> = {
  DRAFT: "Resi dibuat dalam status draft.",
  BOOKED: "Pesanan pengiriman telah dikonfirmasi (Booked).",
  RECEIVED_AT_ORIGIN: "Barang fisik telah diterima di gudang asal.",
  MANIFESTED: "Resi telah dimasukkan ke dalam manifest muatan.",
  IN_TRANSIT: "Armada berangkat menuju kota tujuan.",
  ARRIVED_AT_DESTINATION: "Barang telah tiba di gudang tujuan.",
  OUT_FOR_DELIVERY: "Barang sedang dalam proses pengantaran ke penerima.",
  DELIVERED: "Barang telah diterima oleh penerima.",
  CANCELLED: "Resi pengiriman dibatalkan.",
  RETURNED: "Barang dikembalikan (Retur).",
};

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function resolveCustomerInTx(
  tx: PrismaTx,
  mode: "NEW" | "EXISTING",
  existingId: string | undefined,
  partyData: z.infer<typeof partyInputSchema> | undefined,
  roleLabel: "Pengirim" | "Penerima",
): Promise<{
  id: string;
  createdCustomer: { id: string; name: string; phone: string } | null;
}> {
  if (mode === "EXISTING") {
    if (!existingId) {
      throw new Error(`VALIDATION: Pilih ${roleLabel} terdaftar.`);
    }
    const found = await tx.customer.findUnique({ where: { id: existingId } });
    if (!found || found.status !== "ACTIVE") {
      throw new Error(
        `VALIDATION: Data ${roleLabel} terdaftar tidak ditemukan atau tidak aktif.`,
      );
    }
    return { id: found.id, createdCustomer: null };
  }

  if (!partyData) {
    throw new Error(`VALIDATION: Data ${roleLabel} baru wajib diisi.`);
  }

  const cleanName = partyData.name.trim();
  const cleanPhone = partyData.phone.trim();
  const cleanEmail = partyData.email?.trim() || null;
  const cleanAddress = partyData.address.trim();

  const existingMatch = await tx.customer.findFirst({
    where: {
      phone: cleanPhone,
      name: { equals: cleanName, mode: "insensitive" },
      status: "ACTIVE",
    },
  });

  if (existingMatch) {
    await tx.customer.update({
      where: { id: existingMatch.id },
      data: {
        address: cleanAddress,
        ...(cleanEmail ? { email: cleanEmail } : {}),
      },
    });
    return { id: existingMatch.id, createdCustomer: null };
  }

  const created = await tx.customer.create({
    data: {
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      address: cleanAddress,
      status: "ACTIVE",
    },
  });

  return {
    id: created.id,
    createdCustomer: {
      id: created.id,
      name: created.name,
      phone: created.phone,
    },
  };
}

export async function createShipmentAction(data: ShipmentInput) {
  const session = await requirePermission("shipment:create");

  const parsed = shipmentSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ?? "Data pengiriman resi tidak valid.",
    };
  }

  const payload = parsed.data;

  try {
    const [originWarehouse, destWarehouse, pricingType, configDivisor] =
      await Promise.all([
        prisma.warehouse.findUnique({
          where: { id: payload.origin_warehouse_id },
        }),
        prisma.warehouse.findUnique({
          where: { id: payload.dest_warehouse_id },
        }),
        prisma.pricingType.findUnique({
          where: { id: payload.pricing_type_id },
        }),
        prisma.systemConfig.findUnique({
          where: { key: "VOLUMETRIC_DIVISOR" },
        }),
      ]);

    if (!originWarehouse || !originWarehouse.is_active) {
      return {
        success: false,
        error: "Warehouse asal tidak ditemukan atau tidak aktif.",
      };
    }
    if (!destWarehouse || !destWarehouse.is_active) {
      return {
        success: false,
        error: "Warehouse tujuan tidak ditemukan atau tidak aktif.",
      };
    }
    if (!pricingType || !pricingType.is_active) {
      return {
        success: false,
        error: "Jenis harga tidak ditemukan atau tidak aktif.",
      };
    }

    const volumetricDivisor = configDivisor
      ? Number(configDivisor.value) || 4000
      : 4000;

    let totalWeight = 0;
    let totalVolumetricWeight = 0;
    let totalVolumeCbm = 0;
    let totalQty = 0;

    for (const item of payload.items) {
      const cubicCm = item.length * item.width * item.height;
      totalWeight += item.weight * item.qty;
      totalVolumetricWeight += (cubicCm / volumetricDivisor) * item.qty;
      totalVolumeCbm += (cubicCm / 1_000_000) * item.qty;
      totalQty += item.qty;
    }

    const primaryItemType = payload.items[0]?.item_type ?? "General Cargo";

    let tariff = await prisma.tariffReference.findFirst({
      where: {
        origin_city: originWarehouse.city,
        dest_city: destWarehouse.city,
        pricing_type_id: payload.pricing_type_id,
        item_type: primaryItemType,
        is_active: true,
      },
    });

    if (!tariff) {
      tariff = await prisma.tariffReference.findFirst({
        where: {
          origin_city: originWarehouse.city,
          dest_city: destWarehouse.city,
          pricing_type_id: payload.pricing_type_id,
          is_active: true,
        },
      });
    }

    if (!tariff) {
      return {
        success: false,
        error: `Tarif referensi tidak ditemukan untuk rute ${originWarehouse.city} -> ${destWarehouse.city} (${pricingType.name}).`,
      };
    }

    const chargeableWeight = Math.max(
      totalWeight,
      totalVolumetricWeight,
      Number(tariff.min_weight),
    );
    const ratePerKg = Number(tariff.rate_per_kg);
    const calculatedTariffFee = chargeableWeight * ratePerKg;
    const finalFee = Math.max(calculatedTariffFee, Number(tariff.min_fee));
    const finalPriceNominal =
      payload.manual_price > 0 ? payload.manual_price : finalFee;

    const isPaidNow = payload.payment_option === "PAID_NOW";
    const cleanPayMethod = payload.payment_method?.trim() || "Tunai";
    const now = new Date();

    const txResult = await prisma.$transaction(async (tx) => {
      const resolvedSender = await resolveCustomerInTx(
        tx,
        payload.sender_mode,
        payload.sender_id,
        payload.sender_data,
        "Pengirim",
      );

      const resolvedReceiver = await resolveCustomerInTx(
        tx,
        payload.receiver_mode,
        payload.receiver_id,
        payload.receiver_data,
        "Penerima",
      );

      let shipmentNo = generateShipmentNo(
        originWarehouse.code,
        destWarehouse.code,
      );
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const collision = await tx.shipment.findUnique({
          where: { shipment_no: shipmentNo },
          select: { id: true },
        });
        if (!collision) break;
        shipmentNo = generateShipmentNo(
          originWarehouse.code,
          destWarehouse.code,
        );
      }

      const barcode = shipmentNo;

      const created = await tx.shipment.create({
        data: {
          shipment_no: shipmentNo,
          barcode,
          status: "DRAFT",
          origin_warehouse_id: payload.origin_warehouse_id,
          dest_warehouse_id: payload.dest_warehouse_id,
          sender_id: resolvedSender.id,
          receiver_id: resolvedReceiver.id,
          goods_description: payload.goods_description,
          weight: Number(totalWeight.toFixed(2)),
          volume: Number(totalVolumeCbm.toFixed(2)),
          qty: totalQty,
          pricing_type_id: payload.pricing_type_id,
          price_name_snap: pricingType.name,
          price_nominal_snap: Number(finalPriceNominal.toFixed(2)),
          manual_price: Number(payload.manual_price.toFixed(2)),
          reference_shipment_id: payload.reference_shipment_id || null,
        },
        include: {
          originWarehouse: true,
          destWarehouse: true,
          sender: true,
          receiver: true,
          pricingType: true,
        },
      });

      if (isPaidNow && finalPriceNominal > 0) {
        await tx.financeRecord.create({
          data: {
            shipment_id: created.id,
            record_type: "PAYMENT",
            amount: Number(finalPriceNominal.toFixed(2)),
            approval_status: "APPROVED",
            approved_by: session.userId,
            approved_at: now,
            notes: `Lunas saat pembuatan resi (${cleanPayMethod}) - ${originWarehouse.name}`,
          },
        });
      }

      const payStatusNote = isPaidNow
        ? `Status Bayar: LUNAS (${cleanPayMethod})`
        : "Status Bayar: BELUM TERBAYAR (Bayar saat ambil paket di tujuan)";

      await tx.warehouseMovement.create({
        data: {
          warehouse_id: payload.origin_warehouse_id,
          shipment_id: created.id,
          movement_type: "CREATED_DRAFT",
          actor_id: session.userId,
          notes: `Resi ${shipmentNo} dibuat (${totalQty} koli / ${totalWeight.toFixed(2)} kg). ${payStatusNote}`,
        },
      });

      await tx.trackingEvent.create({
        data: {
          shipment_id: created.id,
          status: "DRAFT",
          description: `${STATUS_DESCRIPTIONS.DRAFT} ${payStatusNote}.`,
          location: `${originWarehouse.name} (${originWarehouse.city})`,
        },
      });

      return {
        shipment: created,
        createdCustomers: [
          resolvedSender.createdCustomer,
          resolvedReceiver.createdCustomer,
        ].filter(
          (c): c is { id: string; name: string; phone: string } => c !== null,
        ),
      };
    });

    for (const newCust of txResult.createdCustomers) {
      await createAuditLog({
        userId: session.userId,
        action: "AUTO_CREATE_CUSTOMER",
        entityName: "Customer",
        entityId: newCust.id,
        newValues: {
          name: newCust.name,
          phone: newCust.phone,
          source_shipment_no: txResult.shipment.shipment_no,
        },
      });
    }

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_SHIPMENT",
      entityName: "Shipment",
      entityId: txResult.shipment.id,
      newValues: {
        shipment_no: txResult.shipment.shipment_no,
        barcode: txResult.shipment.barcode,
        origin_warehouse_id: txResult.shipment.origin_warehouse_id,
        dest_warehouse_id: txResult.shipment.dest_warehouse_id,
        weight: txResult.shipment.weight.toString(),
        volume: txResult.shipment.volume.toString(),
        qty: txResult.shipment.qty,
        price_nominal_snap: txResult.shipment.price_nominal_snap.toString(),
        manual_price: txResult.shipment.manual_price.toString(),
        payment_option: payload.payment_option,
        payment_method: isPaidNow ? cleanPayMethod : "PAY_ON_PICKUP",
      },
    });

    revalidatePath("/dashboard/shipments");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard/master");
    revalidatePath("/dashboard");
    return {
      success: true,
      data: {
        ...txResult.shipment,
        weight: txResult.shipment.weight.toNumber(),
        volume: txResult.shipment.volume.toNumber(),
        price_nominal_snap: txResult.shipment.price_nominal_snap.toNumber(),
        manual_price: txResult.shipment.manual_price.toNumber(),
      },
    };
  } catch (error: unknown) {
    console.error("Failed to create shipment:", error);
    const message =
      error instanceof Error && error.message.startsWith("VALIDATION:")
        ? error.message.replace("VALIDATION:", "").trim()
        : "Gagal membuat resi pengiriman. Terjadi kesalahan pada server.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function updateShipmentStatusAction(
  shipmentId: string,
  nextStatus: ShipmentStatus,
  notes?: string,
) {
  const session = await requirePermission("shipment:update");

  const parsed = updateStatusSchema.safeParse({
    shipment_id: shipmentId,
    next_status: nextStatus,
    notes,
  });

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Permintaan pembaruan status tidak valid.",
    };
  }

  try {
    const existing = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        originWarehouse: true,
        destWarehouse: true,
      },
    });

    if (!existing) {
      return { success: false, error: "Data resi tidak ditemukan." };
    }

    const allowedNext = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowedNext.includes(nextStatus)) {
      return {
        success: false,
        error: `Perubahan status dari ${existing.status} ke ${nextStatus} tidak diizinkan.`,
      };
    }

    const isDestStage =
      nextStatus === "ARRIVED_AT_DESTINATION" ||
      nextStatus === "OUT_FOR_DELIVERY" ||
      nextStatus === "DELIVERED";

    const activeWarehouse = isDestStage
      ? existing.destWarehouse
      : existing.originWarehouse;

    const cleanNotes = notes?.trim() || null;
    const eventDesc = cleanNotes
      ? `${STATUS_DESCRIPTIONS[nextStatus]} Catatan: ${cleanNotes}`
      : STATUS_DESCRIPTIONS[nextStatus];

    await prisma.$transaction(async (tx) => {
      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: nextStatus },
      });

      await tx.trackingEvent.create({
        data: {
          shipment_id: shipmentId,
          status: nextStatus,
          description: eventDesc,
          location: `${activeWarehouse.name} (${activeWarehouse.city})`,
        },
      });

      await tx.warehouseMovement.create({
        data: {
          warehouse_id: activeWarehouse.id,
          shipment_id: shipmentId,
          movement_type: `STATUS_${nextStatus}`,
          actor_id: session.userId,
          notes: eventDesc,
        },
      });
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_SHIPMENT_STATUS",
      entityName: "Shipment",
      entityId: shipmentId,
      oldValues: { status: existing.status },
      newValues: { status: nextStatus, notes: cleanNotes },
    });

    revalidatePath("/dashboard/shipments");
    revalidatePath(`/dashboard/shipments/${shipmentId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update shipment status:", error);
    return {
      success: false,
      error: "Gagal memperbarui status resi pengiriman.",
    };
  }
}
