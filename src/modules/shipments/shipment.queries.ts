import type { ShipmentStatus } from "@/generated/prisma/enums";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface ShipmentListItem {
  id: string;
  shipment_no: string;
  barcode: string;
  status: ShipmentStatus;
  origin_warehouse_id: string;
  dest_warehouse_id: string;
  sender_id: string;
  receiver_id: string;
  goods_description: string;
  weight: number;
  volume: number;
  qty: number;
  pricing_type_id: string;
  price_name_snap: string;
  price_nominal_snap: number;
  manual_price: number;
  paidAmount: number;
  remainingAmount: number;
  isPaid: boolean;
  reference_shipment_id: string | null;
  created_at: Date;
  updated_at: Date;
  originWarehouse: {
    id: string;
    code: string;
    name: string;
    city: string;
  };
  destWarehouse: {
    id: string;
    code: string;
    name: string;
    city: string;
  };
  sender: {
    id: string;
    name: string;
  };
  receiver: {
    id: string;
    name: string;
  };
  pricingType: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ShipmentDetail extends ShipmentListItem {
  originWarehouse: {
    id: string;
    code: string;
    name: string;
    city: string;
    address: string;
  };
  destWarehouse: {
    id: string;
    code: string;
    name: string;
    city: string;
    address: string;
  };
  sender: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string;
  };
  receiver: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string;
  };
  paymentRecords: {
    id: string;
    record_type: string;
    amount: number;
    notes: string | null;
    created_at: Date;
  }[];
  trackingEvents: {
    id: string;
    status: ShipmentStatus;
    description: string;
    location: string | null;
    created_at: Date;
  }[];
  warehouseMoves: {
    id: string;
    movement_type: string;
    notes: string | null;
    created_at: Date;
    warehouse: {
      id: string;
      code: string;
      name: string;
      city: string;
    };
  }[];
}

export interface ShipmentFormData {
  warehouses: {
    id: string;
    code: string;
    name: string;
    city: string;
  }[];
  customers: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string;
  }[];
  pricingTypes: {
    id: string;
    code: string;
    name: string;
  }[];
  tariffs: {
    id: string;
    origin_city: string;
    dest_city: string;
    pricing_type_id: string;
    item_type: string;
    rate_per_kg: number;
    rate_per_cbm: number;
    min_weight: number;
    min_volume: number;
    min_fee: number;
  }[];
  volumetricDivisor: number;
}

export async function getShipments(): Promise<ShipmentListItem[]> {
  await requirePermission("shipment:read");

  const shipments = await prisma.shipment.findMany({
    orderBy: { created_at: "desc" },
    include: {
      originWarehouse: {
        select: { id: true, code: true, name: true, city: true },
      },
      destWarehouse: {
        select: { id: true, code: true, name: true, city: true },
      },
      sender: {
        select: { id: true, name: true },
      },
      receiver: {
        select: { id: true, name: true },
      },
      pricingType: {
        select: { id: true, code: true, name: true },
      },
      financeRecords: {
        where: { approval_status: "APPROVED" },
        select: { amount: true },
      },
    },
  });

  return shipments.map((item) => {
    const totalFee = item.price_nominal_snap.toNumber();
    const paidAmount = item.financeRecords.reduce(
      (sum, fr) => sum + fr.amount.toNumber(),
      0,
    );
    const remainingAmount = Math.max(totalFee - paidAmount, 0);

    return {
      ...item,
      weight: item.weight.toNumber(),
      volume: item.volume.toNumber(),
      price_nominal_snap: totalFee,
      manual_price: item.manual_price.toNumber(),
      paidAmount,
      remainingAmount,
      isPaid: remainingAmount <= 0 && totalFee > 0,
    };
  });
}

export async function getShipmentById(
  id: string,
): Promise<ShipmentDetail | null> {
  await requirePermission("shipment:read");

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      originWarehouse: {
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          address: true,
        },
      },
      destWarehouse: {
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          address: true,
        },
      },
      sender: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
        },
      },
      pricingType: {
        select: { id: true, code: true, name: true },
      },
      financeRecords: {
        where: { approval_status: "APPROVED" },
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          record_type: true,
          amount: true,
          notes: true,
          created_at: true,
        },
      },
      trackingEvents: {
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          status: true,
          description: true,
          location: true,
          created_at: true,
        },
      },
      warehouseMoves: {
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          movement_type: true,
          notes: true,
          created_at: true,
          warehouse: {
            select: { id: true, code: true, name: true, city: true },
          },
        },
      },
    },
  });

  if (!shipment) return null;

  const totalFee = shipment.price_nominal_snap.toNumber();
  const paymentRecords = shipment.financeRecords.map((fr) => ({
    id: fr.id,
    record_type: fr.record_type,
    amount: fr.amount.toNumber(),
    notes: fr.notes,
    created_at: fr.created_at,
  }));
  const paidAmount = paymentRecords.reduce((sum, fr) => sum + fr.amount, 0);
  const remainingAmount = Math.max(totalFee - paidAmount, 0);

  return {
    ...shipment,
    weight: shipment.weight.toNumber(),
    volume: shipment.volume.toNumber(),
    price_nominal_snap: totalFee,
    manual_price: shipment.manual_price.toNumber(),
    paidAmount,
    remainingAmount,
    isPaid: remainingAmount <= 0 && totalFee > 0,
    paymentRecords,
  };
}

export async function getShipmentFormData(): Promise<ShipmentFormData> {
  await requirePermission("shipment:create");

  const [warehouses, customers, pricingTypes, tariffs, configDivisor] =
    await Promise.all([
      prisma.warehouse.findMany({
        where: { is_active: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true, city: true },
      }),
      prisma.customer.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
        },
      }),
      prisma.pricingType.findMany({
        where: { is_active: true },
        orderBy: { name: "asc" },
        select: { id: true, code: true, name: true },
      }),
      prisma.tariffReference.findMany({
        where: { is_active: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.systemConfig.findUnique({
        where: { key: "VOLUMETRIC_DIVISOR" },
      }),
    ]);

  return {
    warehouses,
    customers,
    pricingTypes,
    tariffs: tariffs.map((t) => ({
      id: t.id,
      origin_city: t.origin_city,
      dest_city: t.dest_city,
      pricing_type_id: t.pricing_type_id,
      item_type: t.item_type,
      rate_per_kg: t.rate_per_kg.toNumber(),
      rate_per_cbm: t.rate_per_cbm.toNumber(),
      min_weight: t.min_weight.toNumber(),
      min_volume: t.min_volume.toNumber(),
      min_fee: t.min_fee.toNumber(),
    })),
    volumetricDivisor: configDivisor
      ? Number(configDivisor.value) || 4000
      : 4000,
  };
}
