"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const driverSchema = z.object({
  driver_code: z.string().min(2, "Kode driver minimal 2 karakter"),
  name: z.string().min(3, "Nama driver minimal 3 karakter"),
  phone: z.string().min(10, "Nomor telepon minimal 10 digit"),
  license_number: z.string().min(3, "Nomor SIM minimal 3 karakter"),
  user_id: z.string().uuid().nullable().optional(),
});

export type DriverInput = z.infer<typeof driverSchema>;

export async function createDriverAction(data: DriverInput) {
  const session = await requirePermission("master:manage");

  const parsed = driverSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data driver tidak valid.",
    };
  }

  try {
    const newDriver = await prisma.driver.create({
      data: {
        driver_code: parsed.data.driver_code,
        name: parsed.data.name,
        phone: parsed.data.phone,
        license_number: parsed.data.license_number,
        user_id: parsed.data.user_id || null,
        is_active: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_DRIVER",
      entityName: "Driver",
      entityId: newDriver.id,
      newValues: newDriver,
    });

    revalidatePath("/dashboard/master/drivers");
    return {
      success: true,
      data: newDriver,
    };
  } catch (error: unknown) {
    console.error("Failed to create driver:", error);
    return {
      success: false,
      error:
        "Gagal menyimpan data driver. Pastikan kode driver / nomor SIM belum terdaftar, atau user login sudah terpaut ke driver lain.",
    };
  }
}

export async function updateDriverAction(id: string, data: DriverInput) {
  const session = await requirePermission("master:manage");

  const parsed = driverSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data driver tidak valid.",
    };
  }

  try {
    const existing = await prisma.driver.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Driver tidak ditemukan." };
    }

    const updated = await prisma.driver.update({
      where: { id },
      data: {
        driver_code: parsed.data.driver_code,
        name: parsed.data.name,
        phone: parsed.data.phone,
        license_number: parsed.data.license_number,
        user_id: parsed.data.user_id || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_DRIVER",
      entityName: "Driver",
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    revalidatePath("/dashboard/master/drivers");
    return {
      success: true,
      data: updated,
    };
  } catch (error: unknown) {
    console.error("Failed to update driver:", error);
    return {
      success: false,
      error:
        "Gagal memperbarui data driver. Pastikan kode / SIM / user login tidak bentrok.",
    };
  }
}

export async function toggleDriverStatusAction(id: string, is_active: boolean) {
  const session = await requirePermission("master:manage");

  try {
    const existing = await prisma.driver.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Driver tidak ditemukan." };
    }

    const updated = await prisma.driver.update({
      where: { id },
      data: { is_active },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            email: true,
          },
        },
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "TOGGLE_DRIVER_STATUS",
      entityName: "Driver",
      entityId: id,
      oldValues: { is_active: existing.is_active },
      newValues: { is_active: updated.is_active },
    });

    revalidatePath("/dashboard/master/drivers");
    return {
      success: true,
      data: updated,
    };
  } catch (error: unknown) {
    console.error("Failed to toggle driver status:", error);
    return {
      success: false,
      error: "Gagal mengubah status keaktifan driver.",
    };
  }
}
