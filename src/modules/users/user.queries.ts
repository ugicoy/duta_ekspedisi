import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface ManagedUserItem {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: Date;
  roles: {
    id: string;
    name: string;
  }[];
  warehouses: {
    id: string;
    code: string;
    name: string;
    city: string;
  }[];
  driver: {
    id: string;
    driver_code: string;
  } | null;
}

export interface UsersPageData {
  currentUserId: string;
  canManagePrivilegedRoles: boolean;
  users: ManagedUserItem[];
  availableRoles: {
    id: string;
    name: string;
    description: string | null;
  }[];
  availableWarehouses: {
    id: string;
    code: string;
    name: string;
    city: string;
  }[];
}

export async function getUsersPageData(): Promise<UsersPageData> {
  const session = await getCurrentSession();

  const isPrivileged =
    session.roles.includes("OWNER") || session.roles.includes("SUPER_ADMIN");
  const isAllowed =
    isPrivileged ||
    session.roles.includes("MANAGER") ||
    session.permissions.includes("user:manage");

  if (!isAllowed) {
    throw new Error(
      "Akses ditolak: Hanya Owner, Super Admin, dan Manager yang dapat mengelola user.",
    );
  }

  const [users, roles, warehouses] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ is_active: "desc" }, { created_at: "desc" }],
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        is_active: true,
        created_at: true,
        userRoles: {
          include: {
            role: {
              select: { id: true, name: true },
            },
          },
        },
        userWarehouses: {
          include: {
            warehouse: {
              select: { id: true, code: true, name: true, city: true },
            },
          },
        },
        driver: {
          select: { id: true, driver_code: true },
        },
      },
    }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true },
    }),
    prisma.warehouse.findMany({
      where: { is_active: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, city: true },
    }),
  ]);

  return {
    currentUserId: session.userId,
    canManagePrivilegedRoles: isPrivileged,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone,
      is_active: u.is_active,
      created_at: u.created_at,
      roles: u.userRoles.map((ur) => ur.role),
      warehouses: u.userWarehouses.map((uw) => uw.warehouse),
      driver: u.driver,
    })),
    availableRoles: roles,
    availableWarehouses: warehouses,
  };
}
