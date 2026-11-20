"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  destroySession,
  getSession,
  updateActiveWarehouse,
} from "@/lib/session";

const changeOwnPasswordSchema = z
  .object({
    current_password: z
      .string()
      .min(1, "Password saat ini wajib diisi.")
      .max(100),
    new_password: z
      .string()
      .min(8, "Password baru minimal 8 karakter.")
      .max(100),
    confirm_password: z
      .string()
      .min(8, "Konfirmasi password minimal 8 karakter.")
      .max(100),
  })
  .refine((val) => val.new_password === val.confirm_password, {
    message: "Konfirmasi password baru tidak cocok.",
    path: ["confirm_password"],
  });

export async function switchActiveWarehouseAction(warehouseId: string) {
  await getCurrentSession();
  const success = await updateActiveWarehouse(warehouseId);
  if (success) {
    revalidatePath("/", "layout");
  }
  return { success };
}

export async function changeOwnPasswordAction(data: {
  current_password: string;
  new_password: string;
  confirm_password: string;
}) {
  const session = await getCurrentSession();

  const parsed = changeOwnPasswordSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data password tidak valid.",
    };
  }

  const { current_password, new_password } = parsed.data;

  if (current_password === new_password) {
    return {
      success: false,
      error: "Password baru tidak boleh sama dengan password saat ini.",
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        password_hash: true,
        is_active: true,
      },
    });

    if (!user || !user.is_active) {
      return {
        success: false,
        error: "Akun pengguna tidak ditemukan atau sudah tidak aktif.",
      };
    }

    const isCurrentValid = await bcrypt.compare(
      current_password,
      user.password_hash,
    );
    if (!isCurrentValid) {
      return {
        success: false,
        error: "Password saat ini salah. Silakan periksa kembali.",
      };
    }

    const nextHash = await bcrypt.hash(new_password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: nextHash },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CHANGE_OWN_PASSWORD",
      entityName: "User",
      entityId: user.id,
      newValues: { username: user.username },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to change own password:", error);
    return {
      success: false,
      error: "Terjadi kesalahan sistem saat memperbarui password.",
    };
  }
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await createAuditLog({
      userId: session.userId,
      action: "USER_LOGOUT",
      entityName: "User",
      entityId: session.userId,
      newValues: { username: session.username },
    });
  }

  await destroySession();
  redirect("/login");
}
