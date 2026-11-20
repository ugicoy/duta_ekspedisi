"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const PRIVILEGED_ROLES = ["OWNER", "SUPER_ADMIN"];

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(50)
    .regex(
      /^[a-z0-9._-]+$/,
      "Username hanya boleh huruf kecil, angka, titik, garis bawah, atau strip",
    ),
  full_name: z.string().min(2, "Nama lengkap minimal 2 karakter").max(150),
  password: z.string().min(8, "Password minimal 8 karakter").max(100),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(100)
    .optional()
    .or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  role_ids: z
    .array(z.string().uuid("ID role tidak valid"))
    .min(1, "Pilih minimal 1 role untuk user"),
  warehouse_ids: z.array(z.string().uuid("ID gudang tidak valid")).default([]),
});

const updateUserSchema = z.object({
  user_id: z.string().uuid("ID user tidak valid"),
  full_name: z.string().min(2, "Nama lengkap minimal 2 karakter").max(150),
  email: z
    .string()
    .email("Format email tidak valid")
    .max(100)
    .optional()
    .or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  new_password: z
    .string()
    .min(8, "Password baru minimal 8 karakter")
    .max(100)
    .optional()
    .or(z.literal("")),
  is_active: z.boolean(),
  role_ids: z
    .array(z.string().uuid("ID role tidak valid"))
    .min(1, "Pilih minimal 1 role untuk user"),
  warehouse_ids: z.array(z.string().uuid("ID gudang tidak valid")).default([]),
});

async function assertUserManagerSession() {
  const session = await getCurrentSession();
  const isPrivileged =
    session.roles.includes("OWNER") || session.roles.includes("SUPER_ADMIN");
  const isAllowed =
    isPrivileged ||
    session.roles.includes("MANAGER") ||
    session.permissions.includes("user:manage");

  if (!isAllowed) {
    throw new Error(
      "UNAUTHORIZED: Anda tidak memiliki hak akses manajemen user.",
    );
  }

  return { session, isPrivileged };
}

export async function createUserAction(data: {
  username: string;
  full_name: string;
  password: string;
  email?: string;
  phone?: string;
  role_ids: string[];
  warehouse_ids: string[];
}) {
  try {
    const { session, isPrivileged } = await assertUserManagerSession();

    const parsed = createUserSchema.safeParse({
      ...data,
      username: data.username.trim().toLowerCase(),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data user tidak valid.",
      };
    }

    const payload = parsed.data;
    const cleanEmail = payload.email?.trim() || null;
    const cleanPhone = payload.phone?.trim() || null;

    const selectedRoles = await prisma.role.findMany({
      where: { id: { in: payload.role_ids } },
    });

    if (selectedRoles.length !== payload.role_ids.length) {
      return { success: false, error: "Sebagian role tidak ditemukan." };
    }

    if (
      !isPrivileged &&
      selectedRoles.some((r) => PRIVILEGED_ROLES.includes(r.name))
    ) {
      return {
        success: false,
        error:
          "Role Manager tidak diizinkan memberikan hak akses OWNER atau SUPER_ADMIN.",
      };
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username: payload.username },
    });
    if (existingUsername) {
      return {
        success: false,
        error: `Username "${payload.username}" sudah digunakan.`,
      };
    }

    if (cleanEmail) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });
      if (existingEmail) {
        return {
          success: false,
          error: `Email "${cleanEmail}" sudah terdaftar pada akun lain.`,
        };
      }
    }

    const passwordHash = await bcrypt.hash(payload.password, 12);

    const createdUser = await prisma.user.create({
      data: {
        username: payload.username,
        password_hash: passwordHash,
        full_name: payload.full_name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        is_active: true,
        userRoles: {
          create: payload.role_ids.map((roleId) => ({
            role_id: roleId,
          })),
        },
        userWarehouses: {
          create: payload.warehouse_ids.map((whId) => ({
            warehouse_id: whId,
          })),
        },
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_USER",
      entityName: "User",
      entityId: createdUser.id,
      newValues: {
        username: createdUser.username,
        full_name: createdUser.full_name,
        email: createdUser.email,
        roles: selectedRoles.map((r) => r.name),
        warehouse_count: payload.warehouse_ids.length,
      },
    });

    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to create user:", error);
    const message =
      error instanceof Error && error.message.startsWith("UNAUTHORIZED:")
        ? error.message.replace("UNAUTHORIZED:", "").trim()
        : "Gagal membuat akun user baru.";
    return { success: false, error: message };
  }
}

export async function updateUserAction(data: {
  user_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  new_password?: string;
  is_active: boolean;
  role_ids: string[];
  warehouse_ids: string[];
}) {
  try {
    const { session, isPrivileged } = await assertUserManagerSession();

    const parsed = updateUserSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Data pembaruan tidak valid.",
      };
    }

    const payload = parsed.data;
    const cleanEmail = payload.email?.trim() || null;
    const cleanPhone = payload.phone?.trim() || null;
    const cleanNewPassword = payload.new_password?.trim() || "";

    if (payload.user_id === session.userId && !payload.is_active) {
      return {
        success: false,
        error: "Anda tidak dapat menonaktifkan akun Anda sendiri.",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: payload.user_id },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!targetUser) {
      return { success: false, error: "Akun user tidak ditemukan." };
    }

    const targetHasPrivilegedRole = targetUser.userRoles.some((ur) =>
      PRIVILEGED_ROLES.includes(ur.role.name),
    );

    const selectedRoles = await prisma.role.findMany({
      where: { id: { in: payload.role_ids } },
    });

    if (selectedRoles.length !== payload.role_ids.length) {
      return { success: false, error: "Sebagian role tidak ditemukan." };
    }

    const assignsPrivilegedRole = selectedRoles.some((r) =>
      PRIVILEGED_ROLES.includes(r.name),
    );

    if (!isPrivileged && (targetHasPrivilegedRole || assignsPrivilegedRole)) {
      return {
        success: false,
        error:
          "Role Manager tidak diizinkan mengubah atau memberikan role OWNER / SUPER_ADMIN.",
      };
    }

    if (cleanEmail) {
      const duplicateEmail = await prisma.user.findFirst({
        where: {
          email: cleanEmail,
          id: { not: payload.user_id },
        },
      });
      if (duplicateEmail) {
        return {
          success: false,
          error: `Email "${cleanEmail}" sudah digunakan oleh akun lain.`,
        };
      }
    }

    const passwordHash = cleanNewPassword
      ? await bcrypt.hash(cleanNewPassword, 12)
      : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: payload.user_id },
        data: {
          full_name: payload.full_name.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          is_active: payload.is_active,
          ...(passwordHash ? { password_hash: passwordHash } : {}),
        },
      });

      await tx.userRole.deleteMany({
        where: { user_id: payload.user_id },
      });

      await tx.userRole.createMany({
        data: payload.role_ids.map((roleId) => ({
          user_id: payload.user_id,
          role_id: roleId,
        })),
      });

      await tx.userWarehouse.deleteMany({
        where: { user_id: payload.user_id },
      });

      if (payload.warehouse_ids.length > 0) {
        await tx.userWarehouse.createMany({
          data: payload.warehouse_ids.map((whId) => ({
            user_id: payload.user_id,
            warehouse_id: whId,
          })),
        });
      }
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_USER",
      entityName: "User",
      entityId: payload.user_id,
      oldValues: {
        full_name: targetUser.full_name,
        is_active: targetUser.is_active,
        roles: targetUser.userRoles.map((ur) => ur.role.name),
      },
      newValues: {
        full_name: payload.full_name.trim(),
        is_active: payload.is_active,
        roles: selectedRoles.map((r) => r.name),
        warehouse_count: payload.warehouse_ids.length,
        password_changed: Boolean(passwordHash),
      },
    });

    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to update user:", error);
    const message =
      error instanceof Error && error.message.startsWith("UNAUTHORIZED:")
        ? error.message.replace("UNAUTHORIZED:", "").trim()
        : "Gagal memperbarui data user.";
    return { success: false, error: message };
  }
}

export async function toggleUserStatusAction(userId: string) {
  try {
    const { session, isPrivileged } = await assertUserManagerSession();

    if (userId === session.userId) {
      return {
        success: false,
        error: "Anda tidak dapat menonaktifkan akun Anda sendiri.",
      };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { include: { role: true } },
      },
    });

    if (!targetUser) {
      return { success: false, error: "User tidak ditemukan." };
    }

    const targetHasPrivilegedRole = targetUser.userRoles.some((ur) =>
      PRIVILEGED_ROLES.includes(ur.role.name),
    );

    if (!isPrivileged && targetHasPrivilegedRole) {
      return {
        success: false,
        error:
          "Role Manager tidak diizinkan menonaktifkan akun OWNER / SUPER_ADMIN.",
      };
    }

    const nextActive = !targetUser.is_active;

    await prisma.user.update({
      where: { id: userId },
      data: { is_active: nextActive },
    });

    await createAuditLog({
      userId: session.userId,
      action: "TOGGLE_USER_STATUS",
      entityName: "User",
      entityId: userId,
      oldValues: { is_active: targetUser.is_active },
      newValues: { is_active: nextActive },
    });

    revalidatePath("/dashboard/users");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to toggle user status:", error);
    const message =
      error instanceof Error && error.message.startsWith("UNAUTHORIZED:")
        ? error.message.replace("UNAUTHORIZED:", "").trim()
        : "Gagal mengubah status aktif user.";
    return { success: false, error: message };
  }
}
