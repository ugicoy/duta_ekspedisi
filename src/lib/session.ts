import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export interface WarehousePayload {
  id: string;
  code: string;
  name: string;
}

export interface SessionPayload {
  userId: string;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
  warehouses: WarehousePayload[];
  activeWarehouseId: string;
  [key: string]: unknown;
}

const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET ||
    "default-secret-key-at-least-32-chars-long-for-security",
);

const COOKIE_NAME = "duta_session";

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SECRET_KEY);
}

export async function decryptSession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decryptSession(token);
}

export async function updateActiveWarehouse(
  warehouseId: string,
): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  // Verify user has access to this warehouse (unless OWNER or SUPER_ADMIN)
  const isPrivileged =
    session.roles.includes("OWNER") || session.roles.includes("SUPER_ADMIN");
  const hasAccess =
    isPrivileged || session.warehouses.some((w) => w.id === warehouseId);

  if (!hasAccess) return false;

  session.activeWarehouseId = warehouseId;
  await createSession(session);
  return true;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
