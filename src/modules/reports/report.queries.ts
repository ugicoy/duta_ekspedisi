import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface ShipmentReportRow {
  id: string;
  shipment_no: string;
  created_at: Date;
  origin_code: string;
  origin_city: string;
  dest_code: string;
  dest_city: string;
  sender_name: string;
  receiver_name: string;
  goods_description: string;
  qty: number;
  weight: number;
  volume: number;
  pricing_name: string;
  price_nominal: number;
  status: string;
}

export interface TripReportRow {
  id: string;
  trip_code: string;
  manifest_no: string;
  plate_number: string;
  vehicle_type: string;
  driver_name: string;
  status: string;
  departure_time: Date | null;
  arrival_time: Date | null;
  shipment_count: number;
  total_weight: number;
  approved_expense: number;
}

export interface MonthlyFinanceRecapRow {
  month: string;
  approved_revenue: number;
  reversals_or_adjustments: number;
  approved_trip_expenses: number;
}

export interface ReportsPageData {
  canViewFinance: boolean;
  isGlobalScope: boolean;
  warehouses: { id: string; code: string; name: string }[];
  operationalSummary: {
    totalShipments: number;
    inWarehouseOrigin: number;
    inTransit: number;
    inWarehouseDest: number;
    delivered: number;
    problematic: number;
    activeKolis: number;
    totalWeightKg: number;
  };
  financeSummary: {
    approvedRevenue: number;
    revenueByPricingType: { name: string; total: number; count: number }[];
    totalCorrections: number;
    approvedTripExpenses: number;
    monthlyRecap: MonthlyFinanceRecapRow[];
  };
  shipments: ShipmentReportRow[];
  trips: TripReportRow[];
}

export async function getReportsPageData(): Promise<ReportsPageData> {
  const session = await getCurrentSession();

  const isGlobalScope =
    session.roles.includes("OWNER") ||
    session.roles.includes("SUPER_ADMIN") ||
    session.roles.includes("MANAGER");

  const canViewFinance =
    session.roles.includes("OWNER") ||
    session.roles.includes("SUPER_ADMIN") ||
    session.permissions.includes("finance:read");

  const allowedWarehouseIds = session.warehouses.map((w) => w.id);

  if (
    !isGlobalScope &&
    !canViewFinance &&
    !session.permissions.includes("shipment:read") &&
    !session.permissions.includes("trip:read")
  ) {
    throw new Error("Akses ditolak untuk halaman laporan.");
  }

  const shipmentScopeFilter = isGlobalScope
    ? {}
    : {
        OR: [
          { origin_warehouse_id: { in: allowedWarehouseIds } },
          { dest_warehouse_id: { in: allowedWarehouseIds } },
        ],
      };

  const [shipments, activeKolis, trips, financeRecords, tripExpenses] =
    await Promise.all([
      prisma.shipment.findMany({
        where: shipmentScopeFilter,
        orderBy: { created_at: "desc" },
        take: 300,
        include: {
          originWarehouse: { select: { code: true, city: true } },
          destWarehouse: { select: { code: true, city: true } },
          sender: { select: { name: true } },
          receiver: { select: { name: true } },
        },
      }),
      prisma.koli.count({
        where: { status: { not: "UNPACKED" } },
      }),
      prisma.trip.findMany({
        orderBy: { created_at: "desc" },
        take: 150,
        include: {
          vehicle: { select: { plate_number: true, vehicle_type: true } },
          primaryDriver: { select: { name: true } },
          manifest: {
            select: {
              manifest_no: true,
              manifestItems: {
                where: { released_at: null },
                include: {
                  shipment: { select: { weight: true } },
                },
              },
            },
          },
          tripExpenses: {
            where: { approval_status: "APPROVED", status: "ACTIVE" },
            select: { amount: true },
          },
        },
      }),
      canViewFinance
        ? prisma.financeRecord.findMany({
            where: {
              approval_status: "APPROVED",
              ...(isGlobalScope ? {} : { shipment: shipmentScopeFilter }),
            },
            include: {
              shipment: { select: { price_name_snap: true } },
            },
          })
        : Promise.resolve([]),
      canViewFinance
        ? prisma.tripExpense.findMany({
            where: { approval_status: "APPROVED", status: "ACTIVE" },
          })
        : Promise.resolve([]),
    ]);

  let inWarehouseOrigin = 0;
  let inTransit = 0;
  let inWarehouseDest = 0;
  let delivered = 0;
  let problematic = 0;
  let totalWeightKg = 0;

  for (const s of shipments) {
    totalWeightKg += s.weight.toNumber();
    if (
      s.status === "DRAFT" ||
      s.status === "BOOKED" ||
      s.status === "RECEIVED_AT_ORIGIN"
    ) {
      inWarehouseOrigin += 1;
    } else if (s.status === "MANIFESTED" || s.status === "IN_TRANSIT") {
      inTransit += 1;
    } else if (
      s.status === "ARRIVED_AT_DESTINATION" ||
      s.status === "OUT_FOR_DELIVERY"
    ) {
      inWarehouseDest += 1;
    } else if (s.status === "DELIVERED") {
      delivered += 1;
    } else if (s.status === "CANCELLED" || s.status === "RETURNED") {
      problematic += 1;
    }
  }

  let approvedRevenue = 0;
  let totalCorrections = 0;
  const pricingMap = new Map<string, { total: number; count: number }>();
  const monthlyMap = new Map<
    string,
    {
      approved_revenue: number;
      reversals_or_adjustments: number;
      approved_trip_expenses: number;
    }
  >();

  for (const fr of financeRecords) {
    const amt = fr.amount.toNumber();
    approvedRevenue += amt;
    if (fr.record_type === "REVERSAL" || fr.record_type === "ADJUSTMENT") {
      totalCorrections += amt;
    }

    const pName = fr.shipment.price_name_snap;
    const prevP = pricingMap.get(pName) ?? { total: 0, count: 0 };
    pricingMap.set(pName, { total: prevP.total + amt, count: prevP.count + 1 });

    const monthKey = fr.created_at.toISOString().slice(0, 7);
    const prevM = monthlyMap.get(monthKey) ?? {
      approved_revenue: 0,
      reversals_or_adjustments: 0,
      approved_trip_expenses: 0,
    };
    monthlyMap.set(monthKey, {
      ...prevM,
      approved_revenue: prevM.approved_revenue + amt,
      reversals_or_adjustments:
        prevM.reversals_or_adjustments +
        (fr.record_type !== "PAYMENT" ? amt : 0),
    });
  }

  let approvedTripExpenses = 0;
  for (const exp of tripExpenses) {
    const amt = exp.amount.toNumber();
    approvedTripExpenses += amt;

    const monthKey = exp.created_at.toISOString().slice(0, 7);
    const prevM = monthlyMap.get(monthKey) ?? {
      approved_revenue: 0,
      reversals_or_adjustments: 0,
      approved_trip_expenses: 0,
    };
    monthlyMap.set(monthKey, {
      ...prevM,
      approved_trip_expenses: prevM.approved_trip_expenses + amt,
    });
  }

  const monthlyRecap: MonthlyFinanceRecapRow[] = Array.from(
    monthlyMap.entries(),
  )
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, val]) => ({
      month,
      ...val,
    }));

  return {
    canViewFinance,
    isGlobalScope,
    warehouses: session.warehouses,
    operationalSummary: {
      totalShipments: shipments.length,
      inWarehouseOrigin,
      inTransit,
      inWarehouseDest,
      delivered,
      problematic,
      activeKolis,
      totalWeightKg,
    },
    financeSummary: {
      approvedRevenue,
      revenueByPricingType: Array.from(pricingMap.entries()).map(
        ([name, val]) => ({
          name,
          total: val.total,
          count: val.count,
        }),
      ),
      totalCorrections,
      approvedTripExpenses,
      monthlyRecap,
    },
    shipments: shipments.map((s) => ({
      id: s.id,
      shipment_no: s.shipment_no,
      created_at: s.created_at,
      origin_code: s.originWarehouse.code,
      origin_city: s.originWarehouse.city,
      dest_code: s.destWarehouse.code,
      dest_city: s.destWarehouse.city,
      sender_name: s.sender.name,
      receiver_name: s.receiver.name,
      goods_description: s.goods_description,
      qty: s.qty,
      weight: s.weight.toNumber(),
      volume: s.volume.toNumber(),
      pricing_name: s.price_name_snap,
      price_nominal: s.price_nominal_snap.toNumber(),
      status: s.status,
    })),
    trips: trips.map((t) => {
      const activeItems = t.manifest?.manifestItems ?? [];
      const totalTripWeight = activeItems.reduce(
        (sum, mi) => sum + mi.shipment.weight.toNumber(),
        0,
      );
      const totalExpense = t.tripExpenses.reduce(
        (sum, te) => sum + te.amount.toNumber(),
        0,
      );
      return {
        id: t.id,
        trip_code: t.trip_code,
        manifest_no: t.manifest?.manifest_no ?? "-",
        plate_number: t.vehicle.plate_number,
        vehicle_type: t.vehicle.vehicle_type,
        driver_name: t.primaryDriver.name,
        status: t.status,
        departure_time: t.departure_time,
        arrival_time: t.arrival_time,
        shipment_count: activeItems.length,
        total_weight: totalTripWeight,
        approved_expense: totalExpense,
      };
    }),
  };
}
