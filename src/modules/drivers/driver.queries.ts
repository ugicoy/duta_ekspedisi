import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface DriverItem {
  id: string;
  driver_code: string;
  name: string;
  phone: string;
  license_number: string;
  is_active: boolean;
  user_id: string | null;
  user: {
    id: string;
    username: string;
    full_name: string;
    email: string | null;
  } | null;
  created_at: Date;
  updated_at: Date;
}

export interface DriverUserOption {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
}

export async function getDrivers(): Promise<DriverItem[]> {
  await requirePermission("master:read");

  const drivers = await prisma.driver.findMany({
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
    orderBy: { created_at: "desc" },
  });

  return drivers;
}

export async function getAvailableDriverUsers(): Promise<DriverUserOption[]> {
  await requirePermission("master:read");

  // Get active users who have the "DRIVER" role and are not yet linked to any driver (or linked to current driver if editing, but for dropdown we can include unassigned users + any user already linked to drivers)
  const users = await prisma.user.findMany({
    where: {
      is_active: true,
      userRoles: {
        some: {
          role: {
            name: "DRIVER",
          },
        },
      },
    },
    select: {
      id: true,
      username: true,
      full_name: true,
      email: true,
    },
    orderBy: { full_name: "asc" },
  });

  return users;
}
