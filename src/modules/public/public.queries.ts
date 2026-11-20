import { prisma } from "@/lib/prisma";

export interface PublicTariffItem {
  id: string;
  origin_city: string;
  dest_city: string;
  pricing_type_id: string;
  pricing_type_name: string;
  pricing_type_code: string;
  item_type: string;
  rate_per_kg: number;
  rate_per_cbm: number;
  min_weight: number;
  min_volume: number;
  min_fee: number;
}

export interface PublicWarehouseItem {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
}

export interface PublicSiteSettings {
  companyName: string;
  volumetricDivisor: number;
  csWhatsapp: string;
  baliAddress: string;
  surabayaAddress: string;
  operationalHours: string;
}

export interface PublicPortalInitialData {
  settings: PublicSiteSettings;
  warehouses: PublicWarehouseItem[];
  tariffs: PublicTariffItem[];
}

export interface PublicTrackingTimelineItem {
  id: string;
  status: string;
  description: string;
  location: string | null;
  created_at: string;
  photo_url: string | null;
}

export interface PublicTrackingResult {
  shipment_no: string;
  status: string;
  origin_city: string;
  origin_warehouse: string;
  dest_city: string;
  dest_warehouse: string;
  sender_name: string;
  receiver_name: string;
  goods_description: string;
  qty: number;
  weight: number;
  volume: number;
  service_name: string;
  created_at: string;
  updated_at: string;
  pod: {
    proof_number: string;
    recipient_name: string;
    signed_at: string;
    photo_url: string | null;
  } | null;
  timeline: PublicTrackingTimelineItem[];
}

export async function getPublicPortalInitialData(): Promise<PublicPortalInitialData> {
  const [configs, warehouses, tariffs] = await Promise.all([
    prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            "COMPANY_NAME",
            "VOLUMETRIC_DIVISOR",
            "CS_WHATSAPP",
            "WAREHOUSE_BALI_ADDRESS",
            "WAREHOUSE_SBY_ADDRESS",
            "OPERATIONAL_HOURS",
          ],
        },
      },
    }),
    prisma.warehouse.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        city: true,
      },
    }),
    prisma.tariffReference.findMany({
      where: { is_active: true },
      include: { pricing_type: true },
      orderBy: [{ origin_city: "asc" }, { dest_city: "asc" }],
    }),
  ]);

  const configMap = new Map(configs.map((c) => [c.key, c.value]));
  const parsedDivisor = Number(configMap.get("VOLUMETRIC_DIVISOR") ?? "4000");

  return {
    settings: {
      companyName: configMap.get("COMPANY_NAME") || "Duta Ekspedisi",
      volumetricDivisor:
        Number.isFinite(parsedDivisor) && parsedDivisor > 0
          ? parsedDivisor
          : 4000,
      csWhatsapp:
        (configMap.get("CS_WHATSAPP") || "6281234567890").replace(/\D/g, "") ||
        "6281234567890",
      baliAddress:
        configMap.get("WAREHOUSE_BALI_ADDRESS") ||
        "Jl. Mahendradatta / Cargo Denpasar, Bali",
      surabayaAddress:
        configMap.get("WAREHOUSE_SBY_ADDRESS") ||
        "Pergudangan Margomulyo / Perak, Surabaya",
      operationalHours:
        configMap.get("OPERATIONAL_HOURS") || "Senin - Sabtu, 08.00 - 17.00",
    },
    warehouses,
    tariffs: tariffs.map((t) => ({
      id: t.id,
      origin_city: t.origin_city,
      dest_city: t.dest_city,
      pricing_type_id: t.pricing_type_id,
      pricing_type_name: t.pricing_type.name,
      pricing_type_code: t.pricing_type.code,
      item_type: t.item_type,
      rate_per_kg: t.rate_per_kg.toNumber(),
      rate_per_cbm: t.rate_per_cbm.toNumber(),
      min_weight: t.min_weight.toNumber(),
      min_volume: t.min_volume.toNumber(),
      min_fee: t.min_fee.toNumber(),
    })),
  };
}

export async function findPublicShipmentByNo(
  rawShipmentNo: string,
): Promise<PublicTrackingResult | null> {
  const cleanNo = rawShipmentNo.trim();
  if (!cleanNo) return null;

  const shipment = await prisma.shipment.findFirst({
    where: {
      OR: [
        { shipment_no: { equals: cleanNo, mode: "insensitive" } },
        { barcode: { equals: cleanNo, mode: "insensitive" } },
      ],
    },
    include: {
      originWarehouse: { select: { name: true, city: true } },
      destWarehouse: { select: { name: true, city: true } },
      sender: { select: { name: true } },
      receiver: { select: { name: true } },
      pricingType: { select: { name: true } },
      trackingEvents: {
        orderBy: { created_at: "desc" },
        include: {
          sourceManifestEvent: {
            select: { photo_url: true },
          },
        },
      },
      deliveryProofItems: {
        orderBy: { created_at: "desc" },
        take: 1,
        include: {
          deliveryProof: {
            select: {
              proof_number: true,
              recipient_name: true,
              signed_at: true,
              photo_url: true,
            },
          },
        },
      },
    },
  });

  if (!shipment) return null;

  const latestPod = shipment.deliveryProofItems[0]?.deliveryProof ?? null;

  return {
    shipment_no: shipment.shipment_no,
    status: shipment.status,
    origin_city: shipment.originWarehouse.city,
    origin_warehouse: shipment.originWarehouse.name,
    dest_city: shipment.destWarehouse.city,
    dest_warehouse: shipment.destWarehouse.name,
    sender_name: shipment.sender.name,
    receiver_name: shipment.receiver.name,
    goods_description: shipment.goods_description,
    qty: shipment.qty,
    weight: shipment.weight.toNumber(),
    volume: shipment.volume.toNumber(),
    service_name: shipment.price_name_snap || shipment.pricingType.name,
    created_at: shipment.created_at.toISOString(),
    updated_at: shipment.updated_at.toISOString(),
    pod: latestPod
      ? {
          proof_number: latestPod.proof_number,
          recipient_name: latestPod.recipient_name,
          signed_at: latestPod.signed_at.toISOString(),
          photo_url: latestPod.photo_url,
        }
      : null,
    timeline: shipment.trackingEvents.map((ev) => ({
      id: ev.id,
      status: ev.status,
      description: ev.description,
      location: ev.location,
      created_at: ev.created_at.toISOString(),
      photo_url: ev.sourceManifestEvent?.photo_url ?? null,
    })),
  };
}
