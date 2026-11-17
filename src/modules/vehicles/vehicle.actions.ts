"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { VehicleStatus } from "@/generated/prisma/enums";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const vehicleSchema = z.object({
  vehicle_code: z.string().min(2, "Kode kendaraan minimal 2 karakter"),
  plate_number: z.string().min(3, "Nomor plat minimal 3 karakter"),
  vehicle_type: z.string().min(2, "Tipe kendaraan minimal 2 karakter"),
  capacity_weight: z.coerce
    .number()
    .positive("Kapasitas berat harus bernilai positif"),
  capacity_volume: z.coerce
    .number()
    .positive("Kapasitas volume harus bernilai positif"),
  operational_status: z
    .enum(["ACTIVE", "MAINTENANCE", "INACTIVE"])
    .default("ACTIVE"),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export async function createVehicleAction(data: VehicleInput) {
  const session = await requirePermission("master:manage");

  const parsed = vehicleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data kendaraan tidak valid.",
    };
  }

  try {
    const newVehicle = await prisma.vehicle.create({
      data: {
        vehicle_code: parsed.data.vehicle_code,
        plate_number: parsed.data.plate_number,
        vehicle_type: parsed.data.vehicle_type,
        capacity_weight: parsed.data.capacity_weight,
        capacity_volume: parsed.data.capacity_volume,
        operational_status: parsed.data.operational_status,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_VEHICLE",
      entityName: "Vehicle",
      entityId: newVehicle.id,
      newValues: {
        ...newVehicle,
        capacity_weight: newVehicle.capacity_weight.toString(),
        capacity_volume: newVehicle.capacity_volume.toString(),
      },
    });

    revalidatePath("/dashboard/master/vehicles");
    return {
      success: true,
      data: {
        ...newVehicle,
        capacity_weight: newVehicle.capacity_weight.toNumber(),
        capacity_volume: newVehicle.capacity_volume.toNumber(),
      },
    };
  } catch (error: unknown) {
    console.error("Failed to create vehicle:", error);
    return {
      success: false,
      error:
        "Gagal menyimpan data kendaraan. Pastikan kode / plat nomor belum terdaftar.",
    };
  }
}

export async function updateVehicleAction(id: string, data: VehicleInput) {
  const session = await requirePermission("master:manage");

  const parsed = vehicleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data kendaraan tidak valid.",
    };
  }

  try {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Kendaraan tidak ditemukan." };
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        vehicle_code: parsed.data.vehicle_code,
        plate_number: parsed.data.plate_number,
        vehicle_type: parsed.data.vehicle_type,
        capacity_weight: parsed.data.capacity_weight,
        capacity_volume: parsed.data.capacity_volume,
        operational_status: parsed.data.operational_status,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_VEHICLE",
      entityName: "Vehicle",
      entityId: id,
      oldValues: {
        ...existing,
        capacity_weight: existing.capacity_weight.toString(),
        capacity_volume: existing.capacity_volume.toString(),
      },
      newValues: {
        ...updated,
        capacity_weight: updated.capacity_weight.toString(),
        capacity_volume: updated.capacity_volume.toString(),
      },
    });

    revalidatePath("/dashboard/master/vehicles");
    return {
      success: true,
      data: {
        ...updated,
        capacity_weight: updated.capacity_weight.toNumber(),
        capacity_volume: updated.capacity_volume.toNumber(),
      },
    };
  } catch (error: unknown) {
    console.error("Failed to update vehicle:", error);
    return { success: false, error: "Gagal memperbarui data kendaraan." };
  }
}

export async function updateVehicleStatusAction(
  id: string,
  operational_status: VehicleStatus,
) {
  const session = await requirePermission("master:manage");

  try {
    const existing = await prisma.vehicle.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Kendaraan tidak ditemukan." };
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: { operational_status },
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_VEHICLE_STATUS",
      entityName: "Vehicle",
      entityId: id,
      oldValues: { operational_status: existing.operational_status },
      newValues: { operational_status: updated.operational_status },
    });

    revalidatePath("/dashboard/master/vehicles");
    return {
      success: true,
      data: {
        ...updated,
        capacity_weight: updated.capacity_weight.toNumber(),
        capacity_volume: updated.capacity_volume.toNumber(),
      },
    };
  } catch (error: unknown) {
    console.error("Failed to update vehicle status:", error);
    return {
      success: false,
      error: "Gagal mengubah status operasional kendaraan.",
    };
  }
}
