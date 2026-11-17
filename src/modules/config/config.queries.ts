import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface SystemConfigItem {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_at: Date;
  updated_by: string | null;
}

export async function getSystemConfigs(): Promise<SystemConfigItem[]> {
  await requirePermission("config:manage");

  const configs = await prisma.systemConfig.findMany({
    orderBy: { key: "asc" },
  });

  return configs;
}
