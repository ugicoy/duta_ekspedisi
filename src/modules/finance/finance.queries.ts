import type { ApprovalStatus } from "@/generated/prisma/enums";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface FinanceRecordItem {
  id: string;
  shipment_id: string;
  record_type: string;
  amount: number;
  approval_status: ApprovalStatus;
  approved_at: Date | null;
  reverses_record_id: string | null;
  notes: string | null;
  created_at: Date;
  shipment: {
    id: string;
    shipment_no: string;
    price_nominal_snap: number;
    sender: { name: string };
    receiver: { name: string };
  };
  reversesRecord: {
    id: string;
    record_type: string;
    amount: number;
  } | null;
}

export interface TripExpenseItem {
  id: string;
  trip_id: string;
  amount: number;
  status: string;
  approval_status: ApprovalStatus;
  approved_at: Date | null;
  notes: string | null;
  created_at: Date;
  trip: {
    id: string;
    trip_code: string;
    status: string;
    vehicle: { plate_number: string };
    primaryDriver: { name: string };
  };
}

export interface FinancePageData {
  summary: {
    approvedRevenue: number;
    pendingRevenue: number;
    approvedExpenses: number;
    pendingExpenses: number;
  };
  financeRecords: FinanceRecordItem[];
  tripExpenses: TripExpenseItem[];
  shipments: {
    id: string;
    shipment_no: string;
    price_nominal_snap: number;
    senderName: string;
    receiverName: string;
    paidAmount: number;
  }[];
  trips: {
    id: string;
    trip_code: string;
    status: string;
    plateNumber: string;
    driverName: string;
  }[];
}

export async function getFinancePageData(): Promise<FinancePageData> {
  await requirePermission("finance:read");

  const [
    approvedRevAgg,
    pendingRevAgg,
    approvedExpAgg,
    pendingExpAgg,
    records,
    expenses,
    shipments,
    trips,
  ] = await Promise.all([
    prisma.financeRecord.aggregate({
      where: { approval_status: "APPROVED" },
      _sum: { amount: true },
    }),
    prisma.financeRecord.aggregate({
      where: { approval_status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.tripExpense.aggregate({
      where: { approval_status: "APPROVED", status: "ACTIVE" },
      _sum: { amount: true },
    }),
    prisma.tripExpense.aggregate({
      where: { approval_status: "PENDING", status: "ACTIVE" },
      _sum: { amount: true },
    }),
    prisma.financeRecord.findMany({
      take: 50,
      orderBy: { created_at: "desc" },
      include: {
        shipment: {
          select: {
            id: true,
            shipment_no: true,
            price_nominal_snap: true,
            sender: { select: { name: true } },
            receiver: { select: { name: true } },
          },
        },
        reversesRecord: {
          select: {
            id: true,
            record_type: true,
            amount: true,
          },
        },
      },
    }),
    prisma.tripExpense.findMany({
      take: 50,
      orderBy: { created_at: "desc" },
      include: {
        trip: {
          select: {
            id: true,
            trip_code: true,
            status: true,
            vehicle: { select: { plate_number: true } },
            primaryDriver: { select: { name: true } },
          },
        },
      },
    }),
    prisma.shipment.findMany({
      take: 100,
      where: { status: { not: "CANCELLED" } },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        shipment_no: true,
        price_nominal_snap: true,
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
        financeRecords: {
          where: { approval_status: "APPROVED" },
          select: { amount: true },
        },
      },
    }),
    prisma.trip.findMany({
      take: 100,
      where: { status: { not: "CANCELLED" } },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        trip_code: true,
        status: true,
        vehicle: { select: { plate_number: true } },
        primaryDriver: { select: { name: true } },
      },
    }),
  ]);

  return {
    summary: {
      approvedRevenue: approvedRevAgg._sum.amount?.toNumber() ?? 0,
      pendingRevenue: pendingRevAgg._sum.amount?.toNumber() ?? 0,
      approvedExpenses: approvedExpAgg._sum.amount?.toNumber() ?? 0,
      pendingExpenses: pendingExpAgg._sum.amount?.toNumber() ?? 0,
    },
    financeRecords: records.map((r) => ({
      id: r.id,
      shipment_id: r.shipment_id,
      record_type: r.record_type,
      amount: r.amount.toNumber(),
      approval_status: r.approval_status,
      approved_at: r.approved_at,
      reverses_record_id: r.reverses_record_id,
      notes: r.notes,
      created_at: r.created_at,
      shipment: {
        id: r.shipment.id,
        shipment_no: r.shipment.shipment_no,
        price_nominal_snap: r.shipment.price_nominal_snap.toNumber(),
        sender: r.shipment.sender,
        receiver: r.shipment.receiver,
      },
      reversesRecord: r.reversesRecord
        ? {
            id: r.reversesRecord.id,
            record_type: r.reversesRecord.record_type,
            amount: r.reversesRecord.amount.toNumber(),
          }
        : null,
    })),
    tripExpenses: expenses.map((e) => ({
      id: e.id,
      trip_id: e.trip_id,
      amount: e.amount.toNumber(),
      status: e.status,
      approval_status: e.approval_status,
      approved_at: e.approved_at,
      notes: e.notes,
      created_at: e.created_at,
      trip: {
        id: e.trip.id,
        trip_code: e.trip.trip_code,
        status: e.trip.status,
        vehicle: e.trip.vehicle,
        primaryDriver: e.trip.primaryDriver,
      },
    })),
    shipments: shipments.map((s) => ({
      id: s.id,
      shipment_no: s.shipment_no,
      price_nominal_snap: s.price_nominal_snap.toNumber(),
      senderName: s.sender.name,
      receiverName: s.receiver.name,
      paidAmount: s.financeRecords.reduce(
        (sum, fr) => sum + fr.amount.toNumber(),
        0,
      ),
    })),
    trips: trips.map((t) => ({
      id: t.id,
      trip_code: t.trip_code,
      status: t.status,
      plateNumber: t.vehicle.plate_number,
      driverName: t.primaryDriver.name,
    })),
  };
}
