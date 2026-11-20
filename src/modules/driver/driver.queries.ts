import { getCurrentSession, isGlobalScopeSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface DriverActiveTripItem {
  id: string;
  trip_code: string;
  status: string;
  departure_time: Date | null;
  vehicle: {
    plate_number: string;
    vehicle_type: string;
  };
  primaryDriver: {
    id: string;
    name: string;
    phone: string;
  };
  manifest: {
    id: string;
    manifest_no: string;
    status: string;
    shipmentCount: number;
    totalQty: number;
    totalWeight: number;
    recentEvents: {
      id: string;
      event_type: string;
      description: string | null;
      location_name: string | null;
      photo_url: string | null;
      created_at: Date;
    }[];
  } | null;
}

export interface DriverPortalData {
  driverName: string;
  isSupervisorView: boolean;
  trips: DriverActiveTripItem[];
}

export async function getDriverPortalData(): Promise<DriverPortalData> {
  const session = await getCurrentSession();
  const isSupervisor =
    isGlobalScopeSession(session) ||
    session.roles.includes("ADMIN") ||
    session.roles.includes("WAREHOUSE_STAFF");

  const driverProfile = await prisma.driver.findUnique({
    where: { user_id: session.userId },
    select: { id: true, name: true },
  });

  if (!driverProfile && !isSupervisor) {
    return {
      driverName: session.fullName,
      isSupervisorView: false,
      trips: [],
    };
  }

  const trips = await prisma.trip.findMany({
    where: {
      ...(driverProfile && !isSupervisor
        ? { primary_driver_id: driverProfile.id }
        : {}),
      status: {
        in: ["READY_TO_DEPART", "DEPARTED", "ARRIVED"],
      },
    },
    orderBy: { updated_at: "desc" },
    include: {
      vehicle: {
        select: { plate_number: true, vehicle_type: true },
      },
      primaryDriver: {
        select: { id: true, name: true, phone: true },
      },
      manifest: {
        include: {
          manifestItems: {
            where: { released_at: null },
            include: {
              shipment: {
                select: { qty: true, weight: true },
              },
            },
          },
          manifestEvents: {
            orderBy: { created_at: "desc" },
            take: 8,
          },
        },
      },
    },
  });

  return {
    driverName: driverProfile?.name ?? session.fullName,
    isSupervisorView: isSupervisor,
    trips: trips.map((t) => ({
      id: t.id,
      trip_code: t.trip_code,
      status: t.status,
      departure_time: t.departure_time,
      vehicle: t.vehicle,
      primaryDriver: t.primaryDriver,
      manifest: t.manifest
        ? {
            id: t.manifest.id,
            manifest_no: t.manifest.manifest_no,
            status: t.manifest.status,
            shipmentCount: t.manifest.manifestItems.length,
            totalQty: t.manifest.manifestItems.reduce(
              (sum, i) => sum + i.shipment.qty,
              0,
            ),
            totalWeight: t.manifest.manifestItems.reduce(
              (sum, i) => sum + i.shipment.weight.toNumber(),
              0,
            ),
            recentEvents: t.manifest.manifestEvents.map((ev) => ({
              id: ev.id,
              event_type: ev.event_type,
              description: ev.description,
              location_name: ev.location_name,
              photo_url: ev.photo_url,
              created_at: ev.created_at,
            })),
          }
        : null,
    })),
  };
}
