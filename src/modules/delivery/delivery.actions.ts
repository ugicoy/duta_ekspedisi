"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { uploadDataUrlToR2 } from "@/lib/r2";

const createPodSchema = z.object({
  shipment_ids: z
    .array(z.string().uuid("ID resi tidak valid"))
    .min(1, "Scan atau pilih minimal 1 resi untuk serah terima"),
  recipient_name: z.string().max(150).optional(),
  recipient_phone: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
  photo_data_url: z.string().optional().nullable(),
  collect_unpaid_confirmed: z.boolean().default(false),
  payment_method: z.string().max(50).optional().default("Tunai"),
});

export async function createDeliveryProofAction(data: {
  shipment_ids: string[];
  recipient_name?: string;
  recipient_phone?: string;
  notes?: string;
  photo_data_url?: string | null;
  collect_unpaid_confirmed?: boolean;
  payment_method?: string;
}) {
  const session = await requirePermission("delivery:pod");

  const parsed = createPodSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Data bukti serah terima tidak valid.",
    };
  }

  const {
    shipment_ids,
    recipient_name,
    recipient_phone,
    notes,
    photo_data_url,
    collect_unpaid_confirmed,
    payment_method,
  } = parsed.data;

  try {
    const shipments = await prisma.shipment.findMany({
      where: { id: { in: shipment_ids } },
      include: {
        destWarehouse: true,
        receiver: true,
        financeRecords: {
          where: { approval_status: "APPROVED" },
          select: { amount: true },
        },
      },
    });

    if (shipments.length !== shipment_ids.length) {
      return {
        success: false,
        error: "Sebagian resi yang dipilih tidak ditemukan.",
      };
    }

    const invalidShipment = shipments.find(
      (s) =>
        s.status !== "ARRIVED_AT_DESTINATION" &&
        s.status !== "OUT_FOR_DELIVERY",
    );
    if (invalidShipment) {
      return {
        success: false,
        error: `Resi ${invalidShipment.shipment_no} berstatus ${invalidShipment.status} dan belum siap diserahterimakan.`,
      };
    }

    const unpaidShipments = shipments
      .map((s) => {
        const totalFee = s.price_nominal_snap.toNumber();
        const paid = s.financeRecords.reduce(
          (sum, fr) => sum + fr.amount.toNumber(),
          0,
        );
        const remaining = Math.max(totalFee - paid, 0);
        return { shipment: s, remaining };
      })
      .filter((item) => item.remaining > 0);

    if (unpaidShipments.length > 0 && !collect_unpaid_confirmed) {
      const totalDue = unpaidShipments.reduce(
        (sum, item) => sum + item.remaining,
        0,
      );
      return {
        success: false,
        error: `Ada ${unpaidShipments.length} resi BELUM TERBAYAR (Total tagihan Rp ${totalDue.toLocaleString("id-ID")}). Centang konfirmasi pelunasan pembayaran sebelum menyerahkan paket.`,
      };
    }

    const primaryShipment = shipments[0];
    const resolvedRecipientName =
      recipient_name?.trim() || primaryShipment.receiver.name;
    const resolvedRecipientPhone =
      recipient_phone?.trim() || primaryShipment.receiver.phone;

    const firstWarehouse = primaryShipment.destWarehouse;
    const whCode = firstWarehouse.code.toUpperCase();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const cleanNotes = notes?.trim() || null;
    const cleanPayMethod = payment_method?.trim() || "Tunai";
    const now = new Date();

    let uploadedPodPhotoUrl: string | null = null;
    if (photo_data_url?.startsWith("data:image/")) {
      uploadedPodPhotoUrl = await uploadDataUrlToR2(
        photo_data_url,
        "pod",
        `POD-${whCode}-${primaryShipment.shipment_no}`,
      );
    }

    const createdPod = await prisma.$transaction(async (tx) => {
      const podPrefix = `POD-${whCode}-`;
      const seqRecord = await tx.numberSequence.findUnique({
        where: { prefix: podPrefix },
      });

      const nextVal = seqRecord ? seqRecord.next_val : 1;
      if (seqRecord) {
        await tx.numberSequence.update({
          where: { prefix: podPrefix },
          data: { next_val: nextVal + 1 },
        });
      } else {
        await tx.numberSequence.create({
          data: {
            prefix: podPrefix,
            next_val: 2,
            description: `Nomor Bukti Serah Terima (POD) ${firstWarehouse.name}`,
          },
        });
      }

      const proofNumber = `${podPrefix}${dateStr}-${String(nextVal).padStart(4, "0")}`;

      const pod = await tx.deliveryProof.create({
        data: {
          proof_number: proofNumber,
          proof_type: "WAREHOUSE_PICKUP",
          recipient_name: resolvedRecipientName,
          recipient_phone: resolvedRecipientPhone,
          actor_id: session.userId,
          photo_url: uploadedPodPhotoUrl,
          notes: cleanNotes,
          deliveryProofItems: {
            create: shipments.map((s) => ({
              shipment_id: s.id,
            })),
          },
        },
      });

      for (const item of unpaidShipments) {
        await tx.financeRecord.create({
          data: {
            shipment_id: item.shipment.id,
            record_type: "PAYMENT",
            amount: Number(item.remaining.toFixed(2)),
            approval_status: "APPROVED",
            approved_by: session.userId,
            approved_at: now,
            notes: `Pelunasan saat ambil paket (${cleanPayMethod}) • POD ${proofNumber} - ${item.shipment.destWarehouse.name}`,
          },
        });
      }

      for (const s of shipments) {
        const wasUnpaid = unpaidShipments.some((u) => u.shipment.id === s.id);
        const paymentDesc = wasUnpaid
          ? ` Pelunasan tagihan diterima (${cleanPayMethod}).`
          : "";

        await tx.shipment.update({
          where: { id: s.id },
          data: { status: "DELIVERED" },
        });

        await tx.trackingEvent.create({
          data: {
            shipment_id: s.id,
            status: "DELIVERED",
            description: `Barang telah diambil di gudang tujuan oleh ${resolvedRecipientName} • No. POD: ${proofNumber}.${paymentDesc}`,
            location: `${s.destWarehouse.name} (${s.destWarehouse.city})`,
          },
        });

        await tx.warehouseMovement.create({
          data: {
            warehouse_id: s.dest_warehouse_id,
            shipment_id: s.id,
            movement_type: "DELIVERED_POD",
            actor_id: session.userId,
            notes: `Ambil di tempat (${proofNumber}) oleh ${resolvedRecipientName}.${paymentDesc}`,
          },
        });
      }

      return pod;
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_DELIVERY_PROOF",
      entityName: "DeliveryProof",
      entityId: createdPod.id,
      newValues: {
        proof_number: createdPod.proof_number,
        proof_type: "WAREHOUSE_PICKUP",
        recipient_name: resolvedRecipientName,
        recipient_phone: resolvedRecipientPhone,
        photo_url: uploadedPodPhotoUrl,
        shipment_count: shipments.length,
        collected_unpaid_count: unpaidShipments.length,
      },
    });

    revalidatePath("/dashboard/delivery");
    revalidatePath("/dashboard/shipments");
    revalidatePath("/dashboard/finance");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to create delivery proof:", error);
    const errMsg =
      error instanceof Error
        ? error.message
        : "Gagal menyimpan bukti serah terima barang.";
    return {
      success: false,
      error: errMsg,
    };
  }
}
