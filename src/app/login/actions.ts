"use server";

"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, type SessionPayload } from "@/lib/session";

export interface LoginState {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = formData.get("username")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!username || !password) {
    return { error: "Username dan password wajib diisi." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        userWarehouses: {
          include: {
            warehouse: true,
          },
        },
      },
    });

    if (!user || !user.is_active) {
      return { error: "Username atau password salah, atau akun tidak aktif." };
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return { error: "Username atau password salah." };
    }

    // Extract roles
    const roles = user.userRoles.map((ur) => ur.role.name);

    // Extract unique permissions
    const permissionSet = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionSet.add(rp.permission.code);
      }
    }
    const permissions = Array.from(permissionSet);

    // Extract warehouses assigned to user
    const warehouses = user.userWarehouses.map((uw) => ({
      id: uw.warehouse.id,
      code: uw.warehouse.code,
      name: uw.warehouse.name,
    }));

    // If user has no specific warehouses assigned (e.g. OWNER/SUPER_ADMIN), fetch all active warehouses
    let effectiveWarehouses = warehouses;
    if (
      effectiveWarehouses.length === 0 ||
      roles.includes("OWNER") ||
      roles.includes("SUPER_ADMIN")
    ) {
      const allActiveWarehouses = await prisma.warehouse.findMany({
        where: { is_active: true },
        select: { id: true, code: true, name: true },
      });
      effectiveWarehouses = allActiveWarehouses;
    }

    const activeWarehouseId = effectiveWarehouses[0]?.id || "";

    const sessionPayload: SessionPayload = {
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      roles,
      permissions,
      warehouses: effectiveWarehouses,
      activeWarehouseId,
    };

    const isDriverOnly =
      sessionPayload.roles.includes("DRIVER") &&
      !sessionPayload.roles.includes("OWNER") &&
      !sessionPayload.roles.includes("SUPER_ADMIN") &&
      !sessionPayload.roles.includes("MANAGER") &&
      !sessionPayload.roles.includes("ADMIN") &&
      !sessionPayload.roles.includes("WAREHOUSE_STAFF");

    redirect(isDriverOnly ? "/driver" : "/dashboard");

    await createSession(sessionPayload);
  } catch (err: unknown) {
    console.error("Login error:", err);
    return { error: "Terjadi kesalahan sistem saat proses login." };
  }

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const { destroySession } = await import("@/lib/session");
  await destroySession();
  redirect("/login");
}
