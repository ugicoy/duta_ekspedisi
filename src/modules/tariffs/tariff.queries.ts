import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface PricingTypeItem {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TariffReferenceItem {
  id: string;
  origin_city: string;
  dest_city: string;
  pricing_type_id: string;
  pricing_type?: PricingTypeItem;
  item_type: string;
  rate_per_kg: number;
  rate_per_cbm: number;
  min_weight: number;
  min_volume: number;
  min_fee: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WarehouseCityOption {
  id: string;
  code: string;
  name: string;
  city: string;
}

export async function getPricingTypes(): Promise<PricingTypeItem[]> {
  await requirePermission("master:read");

  const pricingTypes = await prisma.pricingType.findMany({
    orderBy: { name: "asc" },
  });

  return pricingTypes;
}

export async function getTariffReferences(): Promise<TariffReferenceItem[]> {
  await requirePermission("master:read");

  const tariffs = await prisma.tariffReference.findMany({
    include: {
      pricing_type: true,
    },
    orderBy: [{ origin_city: "asc" }, { dest_city: "asc" }],
  });

  return tariffs.map((t) => ({
    ...t,
    rate_per_kg: t.rate_per_kg.toNumber(),
    rate_per_cbm: t.rate_per_cbm.toNumber(),
    min_weight: t.min_weight.toNumber(),
    min_volume: t.min_volume.toNumber(),
    min_fee: t.min_fee.toNumber(),
    pricing_type: t.pricing_type
      ? {
          ...t.pricing_type,
        }
      : undefined,
  }));
}

export async function getActiveWarehouseOptions(): Promise<
  WarehouseCityOption[]
> {
  await requirePermission("master:read");

  return prisma.warehouse.findMany({
    where: { is_active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      city: true,
    },
  });
}
