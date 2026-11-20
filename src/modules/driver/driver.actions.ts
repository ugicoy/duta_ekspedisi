"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireDriverTripAccess } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { uploadDataUrlToR2 } from "@/lib/r2";

const driverCheckpointSchema = z.object({
  trip_id: z.string().uuid("ID trip tidak valid"),
  checkpoint_type: z.enum([
    "TRANSIT_GILIMANUK",
    "TRANSIT_KETAPANG",
    "CUSTOM_TRANSIT",
  ]),
  custom_location: z.string().max(150).optional(),
  notes: z.string().max(400).optional(),
  photo_data_url: z
    .string()
    .min(20, "Foto bukti wajib diambil menggunakan kamera terlebih dahulu."),
});

export async function submitDriverPortTransitAction(data: {
  trip_id: string;
  checkpoint_type: "TRANSIT_GILIMANUK" | "TRANSIT_KETAPANG" | "CUSTOM_TRANSIT";
  custom_location?: string;
  notes?: string;
  photo_data_url: string;
}) {
  const parsed = driverCheckpointSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ?? "Data laporan transit tidak valid.",
    };
  }

  const { trip_id, checkpoint_type, custom_location, notes, photo_data_url } =
    parsed.data;

  const session = await requireDriverTripAccess(trip_id);

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: trip_id },
      include: {
        vehicle: true,
        primaryDriver: true,
        manifest: {
          include: {
            manifestItems: {
              where: { released_at: null },
              include: { shipment: true },
            },
          },
        },
      },
    });

    if (!trip || !trip.manifest) {
      return {
        success: false,
        error: "Data trip atau manifest tidak ditemukan.",
      };
    }

    if (trip.status === "CLOSED" || trip.status === "CANCELLED") {
      return {
        success: false,
        error: `Trip berstatus ${trip.status} sudah tidak aktif.`,
      };
    }

    let locationName = "Pelabuhan Gilimanuk";
    let statusMessage = "Transit in Pelabuhan Gilimanuk";
    let eventTypeCode = "TRANSIT_GILIMANUK";

    if (checkpoint_type === "TRANSIT_KETAPANG") {
      locationName = "Pelabuhan Ketapang";
      statusMessage = "Transit in Pelabuhan Ketapang";
      eventTypeCode = "TRANSIT_KETAPANG";
    } else if (checkpoint_type === "CUSTOM_TRANSIT") {
      const cleanCustom =
        custom_location?.trim() || "Pos Checkpoint Perjalanan";
      locationName = cleanCustom;
      statusMessage = `Transit in ${cleanCustom}`;
      eventTypeCode = "CHECKPOINT_TRANSIT";
    }

    const cleanNotes = notes?.trim();
    const fullDescription = cleanNotes
      ? `${statusMessage} (${cleanNotes}) — Armada ${trip.vehicle.plate_number}`
      : `${statusMessage} — Armada ${trip.vehicle.plate_number}`;

    // Upload foto ke Cloudflare R2
    const uploadedPhotoUrl = await uploadDataUrlToR2(
      photo_data_url,
      "transit",
      `${trip.trip_code}-${eventTypeCode}`,
    );

    const now = new Date();
    const manifest = trip.manifest;

    await prisma.$transaction(async (tx) => {
      // Jika trip masih READY_TO_DEPART, otomatis ubah ke DEPARTED agar seluruh resi berstatus IN_TRANSIT
      if (trip.status === "READY_TO_DEPART") {
        await tx.trip.update({
          where: { id: trip.id },
          data: { status: "DEPARTED", departure_time: now },
        });
        await tx.manifest.update({
          where: { id: manifest.id },
          data: { status: "DEPARTED" },
        });
      }

      const mnfEvent = await tx.manifestEvent.create({
        data: {
          manifest_id: manifest.id,
          event_type: eventTypeCode,
          description: fullDescription,
          location_name: locationName,
          photo_url: uploadedPhotoUrl,
        },
      });

      for (const item of manifest.manifestItems) {
        const nextShipmentStatus =
          item.shipment.status === "MANIFESTED"
            ? "IN_TRANSIT"
            : item.shipment.status;

        if (nextShipmentStatus !== item.shipment.status) {
          await tx.shipment.update({
            where: { id: item.shipment_id },
            data: { status: nextShipmentStatus },
          });
        }

        await tx.trackingEvent.create({
          data: {
            shipment_id: item.shipment_id,
            source_manifest_event_id: mnfEvent.id,
            status: nextShipmentStatus,
            description: fullDescription,
            location: locationName,
          },
        });
      }
    });

    await createAuditLog({
      userId: session.userId,
      action: "DRIVER_PORT_TRANSIT",
      entityName: "Manifest",
      entityId: manifest.id,
      newValues: {
        trip_code: trip.trip_code,
        event_type: eventTypeCode,
        location_name: locationName,
        photo_url: uploadedPhotoUrl,
        affected_shipments: manifest.manifestItems.length,
      },
    });

    revalidatePath("/driver");
    revalidatePath("/dashboard/trips");
    revalidatePath(`/dashboard/trips/${trip.id}`);
    revalidatePath("/dashboard/shipments");
    return {
      success: true,
      photoUrl: uploadedPhotoUrl,
      message: statusMessage,
    };
  } catch (error: unknown) {
    console.error("Failed to submit driver port transit:", error);
    const errMsg =
      error instanceof Error
        ? error.message
        : "Gagal mengirim foto & update status transit pelabuhan.";
    return { success: false, error: errMsg };
  }
}
