"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { generateManifestNo, generateTripCode } from "@/lib/code-generator";
import { prisma } from "@/lib/prisma";

const createTripSchema = z.object({
  origin_warehouse_id: z.string().uuid("Cabang keberangkatan tidak valid"),
  dest_warehouse_id: z.string().uuid("Cabang tujuan tidak valid").optional(),
  vehicle_id: z.string().uuid("Armada kendaraan tidak valid"),
  primary_driver_id: z.string().uuid("Supir utama tidak valid"),
});

const manifestEventSchema = z.object({
  trip_id: z.string().uuid("ID trip tidak valid"),
  event_type: z.string().min(2, "Tipe event wajib diisi").max(100),
  location_name: z.string().max(150).optional(),
  description: z.string().min(2, "Keterangan event wajib diisi").max(500),
});

export async function createTripAction(data: {
  origin_warehouse_id: string;
  dest_warehouse_id?: string;
  vehicle_id: string;
  primary_driver_id: string;
}) {
  const session = await requirePermission("trip:create");

  const parsed = createTripSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data trip tidak valid.",
    };
  }

  const {
    origin_warehouse_id,
    dest_warehouse_id,
    vehicle_id,
    primary_driver_id,
  } = parsed.data;

  try {
    const [
      warehouse,
      explicitDestWarehouse,
      fallbackDestWarehouse,
      vehicle,
      driver,
    ] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: origin_warehouse_id } }),
      dest_warehouse_id
        ? prisma.warehouse.findUnique({ where: { id: dest_warehouse_id } })
        : Promise.resolve(null),
      prisma.warehouse.findFirst({
        where: {
          is_active: true,
          id: { not: origin_warehouse_id },
        },
        orderBy: { name: "asc" },
      }),
      prisma.vehicle.findUnique({ where: { id: vehicle_id } }),
      prisma.driver.findUnique({ where: { id: primary_driver_id } }),
    ]);

    if (!warehouse || !warehouse.is_active) {
      return { success: false, error: "Gudang keberangkatan tidak aktif." };
    }
    if (!vehicle || vehicle.operational_status !== "ACTIVE") {
      return {
        success: false,
        error: "Armada tidak aktif atau sedang servis.",
      };
    }
    if (!driver || !driver.is_active) {
      return { success: false, error: "Supir tidak aktif." };
    }

    const destWarehouse = explicitDestWarehouse ?? fallbackDestWarehouse;
    const destCode =
      destWarehouse?.code ??
      (warehouse.code.toUpperCase() === "BL" ? "SB" : "BL");

    const createdTrip = await prisma.$transaction(async (tx) => {
      let tripCode = generateTripCode(warehouse.code, destCode);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const collision = await tx.trip.findUnique({
          where: { trip_code: tripCode },
          select: { id: true },
        });
        if (!collision) break;
        tripCode = generateTripCode(warehouse.code, destCode);
      }

      let manifestNo = generateManifestNo(warehouse.code, destCode);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const collision = await tx.manifest.findUnique({
          where: { manifest_no: manifestNo },
          select: { id: true },
        });
        if (!collision) break;
        manifestNo = generateManifestNo(warehouse.code, destCode);
      }

      const trip = await tx.trip.create({
        data: {
          trip_code: tripCode,
          status: "DRAFT",
          vehicle_id,
          primary_driver_id,
          manifest: {
            create: {
              manifest_no: manifestNo,
              status: "DRAFT",
              manifestEvents: {
                create: {
                  event_type: "MANIFEST_CREATED",
                  description: `Jadwal trip ${tripCode} dan manifest ${manifestNo} dibuat.`,
                  location_name: `${warehouse.name} (${warehouse.city})`,
                },
              },
            },
          },
        },
        include: { manifest: true },
      });

      return trip;
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_TRIP",
      entityName: "Trip",
      entityId: createdTrip.id,
      newValues: {
        trip_code: createdTrip.trip_code,
        manifest_no: createdTrip.manifest?.manifest_no,
        vehicle_id,
        primary_driver_id,
      },
    });

    revalidatePath("/dashboard/trips");
    return { success: true, data: { id: createdTrip.id } };
  } catch (error: unknown) {
    console.error("Failed to create trip:", error);
    return {
      success: false,
      error: "Gagal membuat jadwal trip dan manifest.",
    };
  }
}

export async function assignShipmentToManifestAction(
  tripId: string,
  shipmentId: string,
) {
  const session = await requirePermission("manifest:create");

  try {
    const [trip, shipment] = await Promise.all([
      prisma.trip.findUnique({
        where: { id: tripId },
        include: { manifest: true },
      }),
      prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: { originWarehouse: true },
      }),
    ]);

    if (!trip || !trip.manifest) {
      return { success: false, error: "Trip atau manifest tidak ditemukan." };
    }
    if (trip.manifest.status !== "DRAFT") {
      return {
        success: false,
        error:
          "Manifest sudah dikunci atau berangkat, tidak dapat menambah muatan.",
      };
    }
    if (!shipment || shipment.status !== "RECEIVED_AT_ORIGIN") {
      return {
        success: false,
        error:
          "Hanya resi berstatus RECEIVED_AT_ORIGIN yang dapat dimuat ke manifest.",
      };
    }

    const manifestId = trip.manifest.id;
    const manifestNo = trip.manifest.manifest_no;

    await prisma.$transaction(async (tx) => {
      await tx.manifestItem.create({
        data: {
          manifest_id: manifestId,
          shipment_id: shipmentId,
        },
      });

      if (trip.status === "DRAFT") {
        await tx.trip.update({
          where: { id: tripId },
          data: { status: "LOADING" },
        });
      }

      await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: "MANIFESTED" },
      });

      await tx.trackingEvent.create({
        data: {
          shipment_id: shipmentId,
          status: "MANIFESTED",
          description: `Resi dimuat ke dalam manifest ${manifestNo} (Trip ${trip.trip_code}).`,
          location: `${shipment.originWarehouse.name} (${shipment.originWarehouse.city})`,
        },
      });

      await tx.warehouseMovement.create({
        data: {
          warehouse_id: shipment.origin_warehouse_id,
          shipment_id: shipmentId,
          movement_type: "LOADED_TO_MANIFEST",
          actor_id: session.userId,
          notes: `Dimuat ke manifest ${manifestNo}`,
        },
      });
    });

    await createAuditLog({
      userId: session.userId,
      action: "ASSIGN_SHIPMENT_MANIFEST",
      entityName: "Manifest",
      entityId: manifestId,
      newValues: { shipment_id: shipmentId, shipment_no: shipment.shipment_no },
    });

    revalidatePath("/dashboard/trips");
    revalidatePath(`/dashboard/trips/${tripId}`);
    revalidatePath("/dashboard/shipments");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to assign shipment to manifest:", error);
    return {
      success: false,
      error: "Gagal memuat resi ke dalam manifest.",
    };
  }
}

export async function removeShipmentFromManifestAction(
  tripId: string,
  manifestItemId: string,
) {
  const session = await requirePermission("manifest:create");

  try {
    const item = await prisma.manifestItem.findUnique({
      where: { id: manifestItemId },
      include: {
        manifest: true,
        shipment: { include: { originWarehouse: true } },
      },
    });

    if (!item) {
      return { success: false, error: "Item manifest tidak ditemukan." };
    }
    if (item.manifest.status !== "DRAFT") {
      return {
        success: false,
        error: "Manifest sudah dikunci, muatan tidak dapat dikeluarkan.",
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.manifestItem.delete({
        where: { id: manifestItemId },
      });

      await tx.shipment.update({
        where: { id: item.shipment_id },
        data: { status: "RECEIVED_AT_ORIGIN" },
      });

      await tx.trackingEvent.create({
        data: {
          shipment_id: item.shipment_id,
          status: "RECEIVED_AT_ORIGIN",
          description: `Resi dikeluarkan dari draft manifest ${item.manifest.manifest_no}.`,
          location: `${item.shipment.originWarehouse.name} (${item.shipment.originWarehouse.city})`,
        },
      });

      await tx.warehouseMovement.create({
        data: {
          warehouse_id: item.shipment.origin_warehouse_id,
          shipment_id: item.shipment_id,
          movement_type: "UNLOADED_FROM_MANIFEST",
          actor_id: session.userId,
          notes: `Dikeluarkan dari manifest ${item.manifest.manifest_no}`,
        },
      });
    });

    await createAuditLog({
      userId: session.userId,
      action: "REMOVE_SHIPMENT_MANIFEST",
      entityName: "Manifest",
      entityId: item.manifest_id,
      oldValues: { shipment_no: item.shipment.shipment_no },
    });

    revalidatePath("/dashboard/trips");
    revalidatePath(`/dashboard/trips/${tripId}`);
    revalidatePath("/dashboard/shipments");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to remove shipment from manifest:", error);
    return {
      success: false,
      error: "Gagal mengeluarkan resi dari manifest.",
    };
  }
}

export async function lockManifestAction(tripId: string) {
  const session = await requirePermission("manifest:lock");

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        manifest: {
          include: {
            manifestItems: { where: { released_at: null } },
          },
        },
      },
    });

    if (!trip || !trip.manifest) {
      return { success: false, error: "Trip atau manifest tidak ditemukan." };
    }
    if (trip.manifest.status !== "DRAFT") {
      return { success: false, error: "Manifest tidak dalam status DRAFT." };
    }
    if (trip.manifest.manifestItems.length === 0) {
      return {
        success: false,
        error:
          "Manifest masih kosong. Masukkan minimal 1 resi sebelum mengunci.",
      };
    }

    const manifestId = trip.manifest.id;

    await prisma.$transaction(async (tx) => {
      await tx.manifest.update({
        where: { id: manifestId },
        data: { status: "LOCKED" },
      });

      await tx.trip.update({
        where: { id: tripId },
        data: { status: "READY_TO_DEPART" },
      });

      await tx.manifestEvent.create({
        data: {
          manifest_id: manifestId,
          event_type: "MANIFEST_LOCKED",
          description: `Manifest dikunci (${trip.manifest?.manifestItems.length ?? 0} resi). Armada siap berangkat.`,
        },
      });
    });

    await createAuditLog({
      userId: session.userId,
      action: "LOCK_MANIFEST",
      entityName: "Manifest",
      entityId: manifestId,
      newValues: { status: "LOCKED", trip_status: "READY_TO_DEPART" },
    });

    revalidatePath("/dashboard/trips");
    revalidatePath(`/dashboard/trips/${tripId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to lock manifest:", error);
    return { success: false, error: "Gagal mengunci manifest." };
  }
}

export async function departTripAction(tripId: string, locationName?: string) {
  const session = await requirePermission("trip:depart_arrive");

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        vehicle: true,
        primaryDriver: true,
        manifest: {
          include: {
            manifestItems: {
              where: { released_at: null },
              include: { shipment: { include: { originWarehouse: true } } },
            },
          },
        },
      },
    });

    if (!trip || !trip.manifest) {
      return { success: false, error: "Trip tidak ditemukan." };
    }
    if (trip.status !== "READY_TO_DEPART") {
      return {
        success: false,
        error: "Kunci manifest terlebih dahulu sebelum memberangkatkan armada.",
      };
    }

    const manifest = trip.manifest;
    const now = new Date();
    const cleanLocation = locationName?.trim() || "Gudang Keberangkatan";

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: tripId },
        data: { status: "DEPARTED", departure_time: now },
      });

      await tx.manifest.update({
        where: { id: manifest.id },
        data: { status: "DEPARTED" },
      });

      const mnfEvent = await tx.manifestEvent.create({
        data: {
          manifest_id: manifest.id,
          event_type: "DEPARTED",
          description: `Armada ${trip.vehicle.plate_number} (Supir: ${trip.primaryDriver.name}) berangkat menuju kota tujuan.`,
          location_name: cleanLocation,
        },
      });

      for (const item of manifest.manifestItems) {
        await tx.shipment.update({
          where: { id: item.shipment_id },
          data: { status: "IN_TRANSIT" },
        });

        await tx.trackingEvent.create({
          data: {
            shipment_id: item.shipment_id,
            source_manifest_event_id: mnfEvent.id,
            status: "IN_TRANSIT",
            description: `Dalam perjalanan linehaul (${trip.trip_code} / ${trip.vehicle.plate_number}).`,
            location: cleanLocation,
          },
        });

        await tx.warehouseMovement.create({
          data: {
            warehouse_id: item.shipment.origin_warehouse_id,
            shipment_id: item.shipment_id,
            movement_type: "OUTBOUND_LINEHAUL",
            actor_id: session.userId,
            notes: `Berangkat via ${trip.trip_code}`,
          },
        });
      }
    });

    await createAuditLog({
      userId: session.userId,
      action: "DEPART_TRIP",
      entityName: "Trip",
      entityId: tripId,
      newValues: {
        status: "DEPARTED",
        departure_time: now.toISOString(),
        shipment_count: manifest.manifestItems.length,
      },
    });

    revalidatePath("/dashboard/trips");
    revalidatePath(`/dashboard/trips/${tripId}`);
    revalidatePath("/dashboard/shipments");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to depart trip:", error);
    return { success: false, error: "Gagal mencatat keberangkatan armada." };
  }
}

export async function arriveTripAction(tripId: string, locationName?: string) {
  const session = await requirePermission("trip:depart_arrive");

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        vehicle: true,
        manifest: {
          include: {
            manifestItems: {
              where: { released_at: null },
              include: { shipment: { include: { destWarehouse: true } } },
            },
          },
        },
      },
    });

    if (!trip || !trip.manifest) {
      return { success: false, error: "Trip tidak ditemukan." };
    }
    if (trip.status !== "DEPARTED") {
      return {
        success: false,
        error: "Hanya trip berstatus DEPARTED yang dapat ditandai tiba.",
      };
    }

    const manifest = trip.manifest;
    const now = new Date();
    const cleanLocation = locationName?.trim() || "Gudang Tujuan";

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: tripId },
        data: { status: "ARRIVED", arrival_time: now },
      });

      await tx.manifest.update({
        where: { id: manifest.id },
        data: { status: "ARRIVED" },
      });

      const mnfEvent = await tx.manifestEvent.create({
        data: {
          manifest_id: manifest.id,
          event_type: "ARRIVED",
          description: `Armada ${trip.vehicle.plate_number} telah tiba di tujuan.`,
          location_name: cleanLocation,
        },
      });

      for (const item of manifest.manifestItems) {
        await tx.shipment.update({
          where: { id: item.shipment_id },
          data: { status: "ARRIVED_AT_DESTINATION" },
        });

        await tx.trackingEvent.create({
          data: {
            shipment_id: item.shipment_id,
            source_manifest_event_id: mnfEvent.id,
            status: "ARRIVED_AT_DESTINATION",
            description: `Barang tiba di gudang tujuan (${item.shipment.destWarehouse.name}).`,
            location: `${item.shipment.destWarehouse.name} (${item.shipment.destWarehouse.city})`,
          },
        });

        await tx.warehouseMovement.create({
          data: {
            warehouse_id: item.shipment.dest_warehouse_id,
            shipment_id: item.shipment_id,
            movement_type: "INBOUND_DEST_WAREHOUSE",
            actor_id: session.userId,
            notes: `Tiba via ${trip.trip_code}`,
          },
        });
      }
    });

    await createAuditLog({
      userId: session.userId,
      action: "ARRIVE_TRIP",
      entityName: "Trip",
      entityId: tripId,
      newValues: {
        status: "ARRIVED",
        arrival_time: now.toISOString(),
        shipment_count: manifest.manifestItems.length,
      },
    });

    revalidatePath("/dashboard/trips");
    revalidatePath(`/dashboard/trips/${tripId}`);
    revalidatePath("/dashboard/shipments");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to arrive trip:", error);
    return { success: false, error: "Gagal mencatat kedatangan armada." };
  }
}

export async function closeTripAction(tripId: string) {
  const session = await requirePermission("trip:depart_arrive");

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { manifest: true },
    });

    if (!trip || !trip.manifest) {
      return { success: false, error: "Trip tidak ditemukan." };
    }
    if (trip.status !== "ARRIVED") {
      return {
        success: false,
        error: "Hanya trip berstatus ARRIVED yang dapat ditutup.",
      };
    }

    const manifestId = trip.manifest.id;

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: tripId },
        data: { status: "CLOSED" },
      });

      await tx.manifest.update({
        where: { id: manifestId },
        data: { status: "CLOSED" },
      });

      await tx.manifestEvent.create({
        data: {
          manifest_id: manifestId,
          event_type: "TRIP_CLOSED",
          description: "Proses bongkar muat selesai dan trip telah ditutup.",
        },
      });
    });

    await createAuditLog({
      userId: session.userId,
      action: "CLOSE_TRIP",
      entityName: "Trip",
      entityId: tripId,
      newValues: { status: "CLOSED" },
    });

    revalidatePath("/dashboard/trips");
    revalidatePath(`/dashboard/trips/${tripId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to close trip:", error);
    return { success: false, error: "Gagal menutup trip." };
  }
}

export async function addManifestEventAction(data: {
  trip_id: string;
  event_type: string;
  location_name?: string;
  description: string;
}) {
  const session = await requirePermission("manifest:event");

  const parsed = manifestEventSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ?? "Data event manifest tidak valid.",
    };
  }

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: parsed.data.trip_id },
      include: {
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
      return { success: false, error: "Trip atau manifest tidak ditemukan." };
    }

    const manifest = trip.manifest;
    const cleanLoc = parsed.data.location_name?.trim() || null;

    await prisma.$transaction(async (tx) => {
      const ev = await tx.manifestEvent.create({
        data: {
          manifest_id: manifest.id,
          event_type: parsed.data.event_type.toUpperCase(),
          description: parsed.data.description,
          location_name: cleanLoc,
        },
      });

      if (trip.status === "DEPARTED") {
        for (const item of manifest.manifestItems) {
          await tx.trackingEvent.create({
            data: {
              shipment_id: item.shipment_id,
              source_manifest_event_id: ev.id,
              status: item.shipment.status,
              description: parsed.data.description,
              location: cleanLoc,
            },
          });
        }
      }
    });

    await createAuditLog({
      userId: session.userId,
      action: "ADD_MANIFEST_EVENT",
      entityName: "Manifest",
      entityId: manifest.id,
      newValues: {
        event_type: parsed.data.event_type,
        location_name: cleanLoc,
        description: parsed.data.description,
      },
    });

    revalidatePath(`/dashboard/trips/${parsed.data.trip_id}`);
    revalidatePath("/dashboard/shipments");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to add manifest event:", error);
    return { success: false, error: "Gagal mencatat log perjalanan manifest." };
  }
}
