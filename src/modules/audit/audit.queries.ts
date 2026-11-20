import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface AuditLogItem {
  id: string;
  action: string;
  entity_name: string;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  created_at: Date;
  user: {
    id: string;
    username: string;
    full_name: string;
  } | null;
}

export async function getAuditLogs(): Promise<AuditLogItem[]> {
  await requirePermission("audit:read");

  const logs = await prisma.auditLog.findMany({
    take: 150,
    orderBy: { created_at: "desc" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          full_name: true,
        },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entity_name: log.entity_name,
    entity_id: log.entity_id,
    old_values: log.old_values,
    new_values: log.new_values,
    ip_address: log.ip_address,
    created_at: log.created_at,
    user: log.user,
  }));
}
