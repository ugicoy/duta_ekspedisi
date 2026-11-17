import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";

export class ForbiddenError extends Error {
  constructor(
    message = "Access denied: insufficient permissions or warehouse scope.",
  ) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getCurrentSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requirePermission(
  permissionCode: string,
): Promise<SessionPayload> {
  const session = await getCurrentSession();

  // OWNER and SUPER_ADMIN have all permissions implicitly
  if (
    session.roles.includes("OWNER") ||
    session.roles.includes("SUPER_ADMIN")
  ) {
    return session;
  }

  if (!session.permissions.includes(permissionCode)) {
    throw new ForbiddenError(`Required permission: ${permissionCode}`);
  }

  return session;
}

export async function requireWarehouseAccess(
  warehouseId: string,
): Promise<SessionPayload> {
  const session = await getCurrentSession();

  // OWNER and SUPER_ADMIN have access to all warehouses
  if (
    session.roles.includes("OWNER") ||
    session.roles.includes("SUPER_ADMIN")
  ) {
    return session;
  }

  const hasAccess = session.warehouses.some((w) => w.id === warehouseId);
  if (!hasAccess) {
    throw new ForbiddenError(`Access denied to warehouse ID: ${warehouseId}`);
  }

  return session;
}

export async function requireActiveWarehouseAccess(): Promise<{
  session: SessionPayload;
  warehouseId: string;
}> {
  const session = await getCurrentSession();
  const warehouseId = session.activeWarehouseId;

  if (!warehouseId) {
    throw new ForbiddenError("No active warehouse selected.");
  }

  await requireWarehouseAccess(warehouseId);
  return { session, warehouseId };
}
