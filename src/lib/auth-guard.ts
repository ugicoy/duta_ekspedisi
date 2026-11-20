import { redirect } from "next/navigation";
import { prisma } from "./prisma";
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

export function isGlobalScopeSession(session: SessionPayload): boolean {
  return (
    session.roles.includes("OWNER") ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("MANAGER")
  );
}

export function getScopedWarehouseIds(
  session: SessionPayload,
): string[] | null {
  if (isGlobalScopeSession(session)) {
    return null;
  }
  return session.warehouses.map((w) => w.id);
}

export async function requirePermission(
  permissionCode: string,
): Promise<SessionPayload> {
  const session = await getCurrentSession();

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

export async function requireDriverTripAccess(
  tripId: string,
): Promise<SessionPayload> {
  const session = await getCurrentSession();

  const isDriverOnly =
    session.roles.includes("DRIVER") &&
    !isGlobalScopeSession(session) &&
    !session.roles.includes("ADMIN") &&
    !session.roles.includes("WAREHOUSE_STAFF");

  if (!isDriverOnly) {
    return session;
  }

  const driver = await prisma.driver.findUnique({
    where: { user_id: session.userId },
    select: { id: true },
  });

  if (!driver) {
    throw new ForbiddenError(
      "Akun driver belum terhubung dengan profil supir.",
    );
  }

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { primary_driver_id: true },
  });

  if (!trip || trip.primary_driver_id !== driver.id) {
    throw new ForbiddenError(
      "Akses ditolak: Anda hanya dapat mengakses trip yang ditugaskan kepada Anda.",
    );
  }

  return session;
}
