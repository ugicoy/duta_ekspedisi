import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface ScanLogItem {
  id: string;
  scan_result: string;
  error_message: string | null;
  created_at: Date;
  warehouse: {
    id: string;
    code: string;
    name: string;
    city: string;
  };
  shipment: {
    id: string;
    shipment_no: string;
    barcode: string;
    status: string;
  } | null;
  koli: {
    id: string;
    koli_no: string;
    barcode: string;
    status: string;
  } | null;
}

export interface ScanPageData {
  warehouses: {
    id: string;
    code: string;
    name: string;
    city: string;
  }[];
  recentLogs: ScanLogItem[];
}

export async function getScanPageData(): Promise<ScanPageData> {
  await requirePermission("warehouse:scan");

  const [warehouses, recentLogs] = await Promise.all([
    prisma.warehouse.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, city: true },
    }),
    prisma.scanLog.findMany({
      take: 50,
      orderBy: { created_at: "desc" },
      include: {
        warehouse: {
          select: { id: true, code: true, name: true, city: true },
        },
        shipment: {
          select: {
            id: true,
            shipment_no: true,
            barcode: true,
            status: true,
          },
        },
        koli: {
          select: {
            id: true,
            koli_no: true,
            barcode: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return {
    warehouses,
    recentLogs,
  };
}
