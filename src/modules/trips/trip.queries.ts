import type {
  ManifestStatus,
  ShipmentStatus,
  TripStatus,
} from "@/generated/prisma/enums";
import {
  getScopedWarehouseIds,
  isGlobalScopeSession,
  requireDriverTripAccess,
  requirePermission,
} from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface TripListItem {
  id: string;
  trip_code: string;
  status: TripStatus;
  departure_time: Date | null;
  arrival_time: Date | null;
  created_at: Date;
  vehicle: {
    id: string;
    vehicle_code: string;
    plate_number: string;
    vehicle_type: string;
    capacity_weight: number;
    capacity_volume: number;
  };
  primaryDriver: {
    id: string;
    driver_code: string;
    name: string;
    phone: string;
  };
  manifest: {
    id: string;
    manifest_no: string;
    status: ManifestStatus;
    itemCount: number;
    totalWeight: number;
    totalQty: number;
  } | null;
}

export interface TripFormOptions {
  warehouses: {
    id: string;
    code: string;
    name: string;
    city: string;
  }[];
  vehicles: {
    id: string;
    vehicle_code: string;
    plate_number: string;
    vehicle_type: string;
    capacity_weight: number;
  }[];
  drivers: {
    id: string;
    driver_code: string;
    name: string;
    phone: string;
  }[];
}

export interface EligibleShipmentItem {
  id: string;
  shipment_no: string;
  goods_description: string;
  qty: number;
  weight: number;
  volume: number;
  originWarehouse: { code: string; city: string };
  destWarehouse: { code: string; city: string };
  sender: { name: string };
  receiver: { name: string };
}

export interface TripDetailData {
  id: string;
  trip_code: string;
  status: TripStatus;
  departure_time: Date | null;
  arrival_time: Date | null;
  created_at: Date;
  vehicle: {
    id: string;
    vehicle_code: string;
    plate_number: string;
    vehicle_type: string;
    capacity_weight: number;
    capacity_volume: number;
  };
  primaryDriver: {
    id: string;
    driver_code: string;
    name: string;
    phone: string;
    license_number: string;
  };
  manifest: {
    id: string;
    manifest_no: string;
    status: ManifestStatus;
    manifestItems: {
      id: string;
      assigned_at: Date;
      shipment: {
        id: string;
        shipment_no: string;
        barcode: string;
        status: ShipmentStatus;
        goods_description: string;
        qty: number;
        weight: number;
        volume: number;
        price_nominal_snap: number;
        originWarehouse: { code: string; name: string; city: string };
        destWarehouse: { code: string; name: string; city: string };
        sender: { name: string };
        receiver: { name: string };
      };
    }[];
    manifestEvents: {
      id: string;
      event_type: string;
      description: string | null;
      location_name: string | null;
      created_at: Date;
    }[];
  } | null;
}

export async function getTrips(): Promise<TripListItem[]> {
  const session = await requirePermission("trip:read");

  const isDriverOnly =
    session.roles.includes("DRIVER") &&
    !isGlobalScopeSession(session) &&
    !session.roles.includes("ADMIN") &&
    !session.roles.includes("WAREHOUSE_STAFF");

  let driverFilter: { primary_driver_id: string } | undefined;

  if (isDriverOnly) {
    const driver = await prisma.driver.findUnique({
      where: { user_id: session.userId },
      select: { id: true },
    });

    if (!driver) {
      return [];
    }

    driverFilter = { primary_driver_id: driver.id };
  }

  const trips = await prisma.trip.findMany({
    where: driverFilter,
    orderBy: { created_at: "desc" },
    include: {
      vehicle: true,
      primaryDriver: true,
      manifest: {
        include: {
          manifestItems: {
            where: { released_at: null },
            include: {
              shipment: {
                select: { weight: true, qty: true },
              },
            },
          },
        },
      },
    },
  });

  return trips.map((trip) => {
    const activeItems = trip.manifest?.manifestItems ?? [];
    const totalWeight = activeItems.reduce(
      (sum, item) => sum + item.shipment.weight.toNumber(),
      0,
    );
    const totalQty = activeItems.reduce(
      (sum, item) => sum + item.shipment.qty,
      0,
    );

    return {
      id: trip.id,
      trip_code: trip.trip_code,
      status: trip.status,
      departure_time: trip.departure_time,
      arrival_time: trip.arrival_time,
      created_at: trip.created_at,
      vehicle: {
        id: trip.vehicle.id,
        vehicle_code: trip.vehicle.vehicle_code,
        plate_number: trip.vehicle.plate_number,
        vehicle_type: trip.vehicle.vehicle_type,
        capacity_weight: trip.vehicle.capacity_weight.toNumber(),
        capacity_volume: trip.vehicle.capacity_volume.toNumber(),
      },
      primaryDriver: {
        id: trip.primaryDriver.id,
        driver_code: trip.primaryDriver.driver_code,
        name: trip.primaryDriver.name,
        phone: trip.primaryDriver.phone,
      },
      manifest: trip.manifest
        ? {
            id: trip.manifest.id,
            manifest_no: trip.manifest.manifest_no,
            status: trip.manifest.status,
            itemCount: activeItems.length,
            totalWeight,
            totalQty,
          }
        : null,
    };
  });
}

export async function getTripFormOptions(): Promise<TripFormOptions> {
  await requirePermission("trip:read");

  const [warehouses, vehicles, drivers] = await Promise.all([
    prisma.warehouse.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, city: true },
    }),
    prisma.vehicle.findMany({
      where: { operational_status: "ACTIVE" },
      orderBy: { vehicle_code: "asc" },
      select: {
        id: true,
        vehicle_code: true,
        plate_number: true,
        vehicle_type: true,
        capacity_weight: true,
      },
    }),
    prisma.driver.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, driver_code: true, name: true, phone: true },
    }),
  ]);

  return {
    warehouses,
    vehicles: vehicles.map((v) => ({
      ...v,
      capacity_weight: v.capacity_weight.toNumber(),
    })),
    drivers,
  };
}

export async function getTripById(id: string): Promise<TripDetailData | null> {
  await requirePermission("trip:read");
  await requireDriverTripAccess(id);

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      vehicle: true,
      primaryDriver: true,
      manifest: {
        include: {
          manifestItems: {
            where: { released_at: null },
            orderBy: { assigned_at: "desc" },
            include: {
              shipment: {
                include: {
                  originWarehouse: {
                    select: { code: true, name: true, city: true },
                  },
                  destWarehouse: {
                    select: { code: true, name: true, city: true },
                  },
                  sender: { select: { name: true } },
                  receiver: { select: { name: true } },
                },
              },
            },
          },
          manifestEvents: {
            orderBy: { created_at: "desc" },
          },
        },
      },
    },
  });

  if (!trip) return null;

  return {
    id: trip.id,
    trip_code: trip.trip_code,
    status: trip.status,
    departure_time: trip.departure_time,
    arrival_time: trip.arrival_time,
    created_at: trip.created_at,
    vehicle: {
      id: trip.vehicle.id,
      vehicle_code: trip.vehicle.vehicle_code,
      plate_number: trip.vehicle.plate_number,
      vehicle_type: trip.vehicle.vehicle_type,
      capacity_weight: trip.vehicle.capacity_weight.toNumber(),
      capacity_volume: trip.vehicle.capacity_volume.toNumber(),
    },
    primaryDriver: {
      id: trip.primaryDriver.id,
      driver_code: trip.primaryDriver.driver_code,
      name: trip.primaryDriver.name,
      phone: trip.primaryDriver.phone,
      license_number: trip.primaryDriver.license_number,
    },
    manifest: trip.manifest
      ? {
          id: trip.manifest.id,
          manifest_no: trip.manifest.manifest_no,
          status: trip.manifest.status,
          manifestItems: trip.manifest.manifestItems.map((mi) => ({
            id: mi.id,
            assigned_at: mi.assigned_at,
            shipment: {
              id: mi.shipment.id,
              shipment_no: mi.shipment.shipment_no,
              barcode: mi.shipment.barcode,
              status: mi.shipment.status,
              goods_description: mi.shipment.goods_description,
              qty: mi.shipment.qty,
              weight: mi.shipment.weight.toNumber(),
              volume: mi.shipment.volume.toNumber(),
              price_nominal_snap: mi.shipment.price_nominal_snap.toNumber(),
              originWarehouse: mi.shipment.originWarehouse,
              destWarehouse: mi.shipment.destWarehouse,
              sender: mi.shipment.sender,
              receiver: mi.shipment.receiver,
            },
          })),
          manifestEvents: trip.manifest.manifestEvents,
        }
      : null,
  };
}

export async function getEligibleShipmentsForManifest(): Promise<
  EligibleShipmentItem[]
> {
  const session = await requirePermission("manifest:read");
  const scopedWarehouseIds = getScopedWarehouseIds(session);

  const shipments = await prisma.shipment.findMany({
    where: {
      status: "RECEIVED_AT_ORIGIN",
      ...(scopedWarehouseIds
        ? { origin_warehouse_id: { in: scopedWarehouseIds } }
        : {}),
    },
    orderBy: { created_at: "asc" },
    include: {
      originWarehouse: { select: { code: true, city: true } },
      destWarehouse: { select: { code: true, city: true } },
      sender: { select: { name: true } },
      receiver: { select: { name: true } },
    },
  });

  return shipments.map((s) => ({
    id: s.id,
    shipment_no: s.shipment_no,
    goods_description: s.goods_description,
    qty: s.qty,
    weight: s.weight.toNumber(),
    volume: s.volume.toNumber(),
    originWarehouse: s.originWarehouse,
    destWarehouse: s.destWarehouse,
    sender: s.sender,
    receiver: s.receiver,
  }));
}
