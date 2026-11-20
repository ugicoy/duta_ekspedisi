"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const scanInputSchema = z.object({
  warehouse_id: z.string().uuid("Pilih gudang aktif terlebih dahulu"),
  barcode: z
    .string()
    .min(2, "Scan atau ketik kode barcode / nomor resi / koli"),
  scan_mode: z.enum(["INBOUND_ORIGIN", "INBOUND_DEST", "VERIFY_CHECK"]),
});

export type ScanMode = "INBOUND_ORIGIN" | "INBOUND_DEST" | "VERIFY_CHECK";

export interface ScanActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  scannedCode?: string;
  entityType?: "SHIPMENT" | "KOLI";
  newStatus?: string;
}

export async function processBarcodeScanAction(data: {
  warehouse_id: string;
  barcode: string;
  scan_mode: ScanMode;
}): Promise<ScanActionResponse> {
  const session = await requirePermission("warehouse:scan");

  const parsed = scanInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Input pemindaian tidak valid.",
    };
  }

  const cleanCode = parsed.data.barcode.trim().toUpperCase();
  const { warehouse_id, scan_mode } = parsed.data;

  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouse_id },
    });

    if (!warehouse || !warehouse.is_active) {
      return {
        success: false,
        error: "Gudang operasional tidak ditemukan atau tidak aktif.",
      };
    }

    const [shipment, koli] = await Promise.all([
      prisma.shipment.findFirst({
        where: {
          OR: [{ barcode: cleanCode }, { shipment_no: cleanCode }],
        },
        include: {
          originWarehouse: true,
          destWarehouse: true,
        },
      }),
      prisma.koli.findFirst({
        where: {
          OR: [{ barcode: cleanCode }, { koli_no: cleanCode }],
        },
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
      }),
    ]);

    // 1. Barcode tidak ditemukan di Shipment maupun Koli
    if (!shipment && !koli) {
      const errMsg = `Kode "${cleanCode}" tidak terdaftar sebagai Resi maupun Koli.`;
      await prisma.scanLog.create({
        data: {
          warehouse_id,
          scan_result: "NOT_FOUND",
          scanned_by: session.userId,
          error_message: errMsg,
        },
      });

      revalidatePath("/dashboard/scan");
      return {
        success: false,
        error: errMsg,
        scannedCode: cleanCode,
      };
    }

    // 2. Pemindaian Resi (Shipment)
    if (shipment) {
      if (scan_mode === "VERIFY_CHECK") {
        await prisma.scanLog.create({
          data: {
            warehouse_id,
            shipment_id: shipment.id,
            scan_result: "VERIFIED",
            scanned_by: session.userId,
          },
        });

        revalidatePath("/dashboard/scan");
        return {
          success: true,
          message: `Verifikasi fisik Resi ${shipment.shipment_no} berhasil (Status saat ini: ${shipment.status}).`,
          scannedCode: shipment.shipment_no,
          entityType: "SHIPMENT",
          newStatus: shipment.status,
        };
      }

      if (scan_mode === "INBOUND_ORIGIN") {
        if (shipment.origin_warehouse_id !== warehouse_id) {
          const errMsg = `Resi ${shipment.shipment_no} terdaftar untuk gudang asal ${shipment.originWarehouse.code}, bukan ${warehouse.code}.`;
          await prisma.scanLog.create({
            data: {
              warehouse_id,
              shipment_id: shipment.id,
              scan_result: "REJECTED",
              scanned_by: session.userId,
              error_message: errMsg,
            },
          });
          revalidatePath("/dashboard/scan");
          return {
            success: false,
            error: errMsg,
            scannedCode: shipment.shipment_no,
          };
        }

        if (shipment.status !== "DRAFT" && shipment.status !== "BOOKED") {
          const errMsg = `Resi ${shipment.shipment_no} sudah berstatus ${shipment.status}, tidak dapat di-scan inbound asal ulang.`;
          await prisma.scanLog.create({
            data: {
              warehouse_id,
              shipment_id: shipment.id,
              scan_result: "REJECTED",
              scanned_by: session.userId,
              error_message: errMsg,
            },
          });
          revalidatePath("/dashboard/scan");
          return {
            success: false,
            error: errMsg,
            scannedCode: shipment.shipment_no,
          };
        }

        await prisma.$transaction(async (tx) => {
          await tx.shipment.update({
            where: { id: shipment.id },
            data: { status: "RECEIVED_AT_ORIGIN" },
          });

          await tx.trackingEvent.create({
            data: {
              shipment_id: shipment.id,
              status: "RECEIVED_AT_ORIGIN",
              description: `Barcode dipindai masuk di gudang asal (${warehouse.name}).`,
              location: `${warehouse.name} (${warehouse.city})`,
            },
          });

          await tx.warehouseMovement.create({
            data: {
              warehouse_id,
              shipment_id: shipment.id,
              movement_type: "SCAN_INBOUND_ORIGIN",
              actor_id: session.userId,
              notes: `Scan barcode masuk gudang asal (${cleanCode})`,
            },
          });

          await tx.scanLog.create({
            data: {
              warehouse_id,
              shipment_id: shipment.id,
              scan_result: "SUCCESS",
              scanned_by: session.userId,
            },
          });
        });

        await createAuditLog({
          userId: session.userId,
          action: "SCAN_SHIPMENT_INBOUND_ORIGIN",
          entityName: "Shipment",
          entityId: shipment.id,
          oldValues: { status: shipment.status },
          newValues: { status: "RECEIVED_AT_ORIGIN", warehouse_id },
        });

        revalidatePath("/dashboard/scan");
        revalidatePath("/dashboard/shipments");
        revalidatePath(`/dashboard/shipments/${shipment.id}`);
        return {
          success: true,
          message: `Resi ${shipment.shipment_no} berhasil diterima di ${warehouse.name} (RECEIVED_AT_ORIGIN).`,
          scannedCode: shipment.shipment_no,
          entityType: "SHIPMENT",
          newStatus: "RECEIVED_AT_ORIGIN",
        };
      }

      // scan_mode === "INBOUND_DEST"
      if (shipment.dest_warehouse_id !== warehouse_id) {
        const errMsg = `Resi ${shipment.shipment_no} ditujukan ke gudang ${shipment.destWarehouse.code}, bukan ${warehouse.code}.`;
        await prisma.scanLog.create({
          data: {
            warehouse_id,
            shipment_id: shipment.id,
            scan_result: "REJECTED",
            scanned_by: session.userId,
            error_message: errMsg,
          },
        });
        revalidatePath("/dashboard/scan");
        return {
          success: false,
          error: errMsg,
          scannedCode: shipment.shipment_no,
        };
      }

      if (
        shipment.status !== "IN_TRANSIT" &&
        shipment.status !== "MANIFESTED"
      ) {
        const errMsg = `Resi ${shipment.shipment_no} berstatus ${shipment.status}, belum dalam perjalanan menuju gudang tujuan.`;
        await prisma.scanLog.create({
          data: {
            warehouse_id,
            shipment_id: shipment.id,
            scan_result: "REJECTED",
            scanned_by: session.userId,
            error_message: errMsg,
          },
        });
        revalidatePath("/dashboard/scan");
        return {
          success: false,
          error: errMsg,
          scannedCode: shipment.shipment_no,
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.shipment.update({
          where: { id: shipment.id },
          data: { status: "ARRIVED_AT_DESTINATION" },
        });

        await tx.trackingEvent.create({
          data: {
            shipment_id: shipment.id,
            status: "ARRIVED_AT_DESTINATION",
            description: `Barcode dipindai tiba di gudang tujuan (${warehouse.name}).`,
            location: `${warehouse.name} (${warehouse.city})`,
          },
        });

        await tx.warehouseMovement.create({
          data: {
            warehouse_id,
            shipment_id: shipment.id,
            movement_type: "SCAN_INBOUND_DEST",
            actor_id: session.userId,
            notes: `Scan barcode tiba di gudang tujuan (${cleanCode})`,
          },
        });

        await tx.scanLog.create({
          data: {
            warehouse_id,
            shipment_id: shipment.id,
            scan_result: "SUCCESS",
            scanned_by: session.userId,
          },
        });
      });

      await createAuditLog({
        userId: session.userId,
        action: "SCAN_SHIPMENT_INBOUND_DEST",
        entityName: "Shipment",
        entityId: shipment.id,
        oldValues: { status: shipment.status },
        newValues: { status: "ARRIVED_AT_DESTINATION", warehouse_id },
      });

      revalidatePath("/dashboard/scan");
      revalidatePath("/dashboard/shipments");
      revalidatePath(`/dashboard/shipments/${shipment.id}`);
      revalidatePath("/dashboard/delivery");
      return {
        success: true,
        message: `Resi ${shipment.shipment_no} berhasil dipindai tiba di ${warehouse.name} (ARRIVED_AT_DESTINATION).`,
        scannedCode: shipment.shipment_no,
        entityType: "SHIPMENT",
        newStatus: "ARRIVED_AT_DESTINATION",
      };
    }

    // 3. Pemindaian Koli Konsolidasi
    if (koli) {
      if (scan_mode === "VERIFY_CHECK") {
        await prisma.scanLog.create({
          data: {
            warehouse_id,
            koli_id: koli.id,
            scan_result: "VERIFIED",
            scanned_by: session.userId,
          },
        });

        revalidatePath("/dashboard/scan");
        return {
          success: true,
          message: `Verifikasi Koli ${koli.koli_no} berhasil (Status: ${koli.status}, berisi ${koli.koliItems.length} resi aktif).`,
          scannedCode: koli.koli_no,
          entityType: "KOLI",
          newStatus: koli.status,
        };
      }

      if (scan_mode === "INBOUND_ORIGIN") {
        const errMsg = `Koli ${koli.koli_no} sudah dikemas (${koli.status}). Gunakan mode "Terima Gudang Tujuan" atau "Cek Fisik".`;
        await prisma.scanLog.create({
          data: {
            warehouse_id,
            koli_id: koli.id,
            scan_result: "REJECTED",
            scanned_by: session.userId,
            error_message: errMsg,
          },
        });
        revalidatePath("/dashboard/scan");
        return {
          success: false,
          error: errMsg,
          scannedCode: koli.koli_no,
        };
      }

      // scan_mode === "INBOUND_DEST" untuk Koli
      if (koli.status === "UNPACKED" || koli.status === "RECEIVED") {
        const errMsg = `Koli ${koli.koli_no} sudah berstatus ${koli.status}.`;
        await prisma.scanLog.create({
          data: {
            warehouse_id,
            koli_id: koli.id,
            scan_result: "REJECTED",
            scanned_by: session.userId,
            error_message: errMsg,
          },
        });
        revalidatePath("/dashboard/scan");
        return {
          success: false,
          error: errMsg,
          scannedCode: koli.koli_no,
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.koli.update({
          where: { id: koli.id },
          data: { status: "RECEIVED" },
        });

        for (const item of koli.koliItems) {
          if (
            item.shipment.dest_warehouse_id === warehouse_id &&
            (item.shipment.status === "IN_TRANSIT" ||
              item.shipment.status === "MANIFESTED")
          ) {
            await tx.shipment.update({
              where: { id: item.shipment_id },
              data: { status: "ARRIVED_AT_DESTINATION" },
            });

            await tx.trackingEvent.create({
              data: {
                shipment_id: item.shipment_id,
                status: "ARRIVED_AT_DESTINATION",
                description: `Tiba di gudang tujuan (${warehouse.name}) via pemindaian Koli ${koli.koli_no}.`,
                location: `${warehouse.name} (${warehouse.city})`,
              },
            });

            await tx.warehouseMovement.create({
              data: {
                warehouse_id,
                shipment_id: item.shipment_id,
                movement_type: "SCAN_KOLI_INBOUND_DEST",
                actor_id: session.userId,
                notes: `Scan Koli ${koli.koli_no} tiba di gudang tujuan`,
              },
            });
          }
        }

        await tx.scanLog.create({
          data: {
            warehouse_id,
            koli_id: koli.id,
            scan_result: "SUCCESS",
            scanned_by: session.userId,
          },
        });
      });

      await createAuditLog({
        userId: session.userId,
        action: "SCAN_KOLI_INBOUND_DEST",
        entityName: "Koli",
        entityId: koli.id,
        oldValues: { status: koli.status },
        newValues: { status: "RECEIVED", warehouse_id },
      });

      revalidatePath("/dashboard/scan");
      revalidatePath("/dashboard/kolis");
      revalidatePath("/dashboard/shipments");
      revalidatePath("/dashboard/delivery");
      return {
        success: true,
        message: `Koli ${koli.koli_no} berhasil dipindai tiba di ${warehouse.name} (RECEIVED).`,
        scannedCode: koli.koli_no,
        entityType: "KOLI",
        newStatus: "RECEIVED",
      };
    }

    return { success: false, error: "Gagal memproses barcode." };
  } catch (error: unknown) {
    console.error("Failed to process barcode scan:", error);
    return {
      success: false,
      error: "Terjadi kesalahan server saat memproses pemindaian barcode.",
    };
  }
}
