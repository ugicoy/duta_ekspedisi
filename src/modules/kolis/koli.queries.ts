import type { KoliStatus } from "@/generated/prisma/enums";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface KoliListItem {
  id: string;
  koli_no: string;
  barcode: string;
  status: KoliStatus;
  created_at: Date;
  totalWeight: number;
  totalQty: number;
  items: {
    id: string;
    assigned_at: Date;
    shipment: {
      id: string;
      shipment_no: string;
      goods_description: string;
      qty: number;
      weight: number;
      originWarehouse: { code: string; city: string };
      destWarehouse: { code: string; city: string };
      receiver: { name: string };
    };
  }[];
}

export interface KoliFormData {
  warehouses: {
    id: string;
    code: string;
    name: string;
    city: string;
  }[];
  eligibleShipments: {
    id: string;
    shipment_no: string;
    goods_description: string;
    qty: number;
    weight: number;
    origin_warehouse_id: string;
    originWarehouse: { code: string; city: string };
    destWarehouse: { code: string; city: string };
    sender: { name: string };
    receiver: { name: string };
  }[];
}

export async function getKolis(): Promise<KoliListItem[]> {
  await requirePermission("shipment:read");

  const kolis = await prisma.koli.findMany({
    orderBy: { created_at: "desc" },
    include: {
      koliItems: {
        where: { released_at: null },
        include: {
          shipment: {
            select: {
              id: true,
              shipment_no: true,
              goods_description: true,
              qty: true,
              weight: true,
              originWarehouse: { select: { code: true, city: true } },
              destWarehouse: { select: { code: true, city: true } },
              receiver: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return kolis.map((koli) => {
    const items = koli.koliItems.map((ki) => ({
      id: ki.id,
      assigned_at: ki.assigned_at,
      shipment: {
        ...ki.shipment,
        weight: ki.shipment.weight.toNumber(),
      },
    }));

    const totalWeight = items.reduce(
      (sum, item) => sum + item.shipment.weight,
      0,
    );
    const totalQty = items.reduce((sum, item) => sum + item.shipment.qty, 0);

    return {
      id: koli.id,
      koli_no: koli.koli_no,
      barcode: koli.barcode,
      status: koli.status,
      created_at: koli.created_at,
      totalWeight,
      totalQty,
      items,
    };
  });
}

export async function getKoliFormData(): Promise<KoliFormData> {
  await requirePermission("shipment:read");

  const [warehouses, shipments] = await Promise.all([
    prisma.warehouse.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, city: true },
    }),
    prisma.shipment.findMany({
      where: {
        status: "RECEIVED_AT_ORIGIN",
        koliItems: {
          none: { released_at: null },
        },
      },
      orderBy: { created_at: "asc" },
      include: {
        originWarehouse: { select: { code: true, city: true } },
        destWarehouse: { select: { code: true, city: true } },
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
      },
    }),
  ]);

  return {
    warehouses,
    eligibleShipments: shipments.map((s) => ({
      id: s.id,
      shipment_no: s.shipment_no,
      goods_description: s.goods_description,
      qty: s.qty,
      weight: s.weight.toNumber(),
      origin_warehouse_id: s.origin_warehouse_id,
      originWarehouse: s.originWarehouse,
      destWarehouse: s.destWarehouse,
      sender: s.sender,
      receiver: s.receiver,
    })),
  };
}
