import type { VehicleStatus } from "@/generated/prisma/enums";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface VehicleItem {
  id: string;
  vehicle_code: string;
  plate_number: string;
  vehicle_type: string;
  capacity_weight: number | string;
  capacity_volume: number | string;
  operational_status: VehicleStatus;
  created_at: Date;
  updated_at: Date;
}

export async function getVehicles(): Promise<VehicleItem[]> {
  await requirePermission("master:read");

  const vehicles = await prisma.vehicle.findMany({
    orderBy: { created_at: "desc" },
  });

  return vehicles.map((v) => ({
    ...v,
    capacity_weight: v.capacity_weight.toNumber(),
    capacity_volume: v.capacity_volume.toNumber(),
  }));
}
