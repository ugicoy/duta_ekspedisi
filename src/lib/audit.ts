import { prisma } from "@/lib/prisma";

interface CreateAuditLogParams {
  userId: string;
  action: string;
  entityName: string;
  entityId?: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string;
}

export async function createAuditLog({
  userId,
  action,
  entityName,
  entityId,
  oldValues,
  newValues,
  ipAddress,
}: CreateAuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        entity_name: entityName,
        entity_id: entityId || null,
        old_values: oldValues ? (oldValues as object) : undefined,
        new_values: newValues ? (newValues as object) : undefined,
        ip_address: ipAddress || null,
      },
    });
  } catch (error) {
    // Audit log failures should not block main transactional workflow, but log to console
    console.error("Failed to create audit log:", error);
  }
}
