import { randomBytes } from "node:crypto";

const ALPHANUMERIC_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const RANDOM_CODE_LENGTH = 10;

export function generateAlphanumericToken(
  length: number = RANDOM_CODE_LENGTH,
): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += ALPHANUMERIC_CHARS[bytes[i] % ALPHANUMERIC_CHARS.length];
  }
  return result;
}

export function buildRoutePrefix(
  originWarehouseCode: string,
  destWarehouseCode: string,
): string {
  const origin = originWarehouseCode.trim().toUpperCase();
  const dest = destWarehouseCode.trim().toUpperCase();
  return `DE${origin}-${dest}`;
}

export function generateShipmentNo(
  originWarehouseCode: string,
  destWarehouseCode: string,
): string {
  const prefix = buildRoutePrefix(originWarehouseCode, destWarehouseCode);
  return `${prefix}${generateAlphanumericToken()}`;
}

export function generateKoliNo(
  originWarehouseCode: string,
  destWarehouseCode: string,
): string {
  const prefix = buildRoutePrefix(originWarehouseCode, destWarehouseCode);
  return `${prefix}-KOLI-${generateAlphanumericToken()}`;
}

export function generateManifestNo(
  originWarehouseCode: string,
  destWarehouseCode: string,
): string {
  const prefix = buildRoutePrefix(originWarehouseCode, destWarehouseCode);
  return `${prefix}-MANIFEST-${generateAlphanumericToken()}`;
}

export function generateTripCode(
  originWarehouseCode: string,
  destWarehouseCode: string,
): string {
  const prefix = buildRoutePrefix(originWarehouseCode, destWarehouseCode);
  return `${prefix}-TRIP-${generateAlphanumericToken()}`;
}
