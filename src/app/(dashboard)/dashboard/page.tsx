import Link from "next/link";
import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getCurrentSession();

  const activeWarehouse = session.warehouses.find(
    (w) => w.id === session.activeWarehouseId,
  );

  const canViewFinance =
    session.roles.includes("OWNER") ||
    session.roles.includes("SUPER_ADMIN") ||
    session.permissions.includes("finance:read");

  const [
    totalShipments,
    atOriginCount,
    inTransitCount,
    atDestCount,
    deliveredCount,
    activeKolisCount,
    activeTripsCount,
    approvedRevenueAgg,
    approvedExpenseAgg,
    recentShipments,
    activeTrips,
  ] = await Promise.all([
    prisma.shipment.count(),
    prisma.shipment.count({ where: { status: "RECEIVED_AT_ORIGIN" } }),
    prisma.shipment.count({
      where: { status: { in: ["MANIFESTED", "IN_TRANSIT"] } },
    }),
    prisma.shipment.count({
      where: {
        status: { in: ["ARRIVED_AT_DESTINATION", "OUT_FOR_DELIVERY"] },
      },
    }),
    prisma.shipment.count({ where: { status: "DELIVERED" } }),
    prisma.koli.count({ where: { status: { not: "UNPACKED" } } }),
    prisma.trip.count({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
    }),
    canViewFinance
      ? prisma.financeRecord.aggregate({
          where: { approval_status: "APPROVED" },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    canViewFinance
      ? prisma.tripExpense.aggregate({
          where: { approval_status: "APPROVED", status: "ACTIVE" },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    prisma.shipment.findMany({
      take: 5,
      orderBy: { created_at: "desc" },
      include: {
        originWarehouse: { select: { code: true, city: true } },
        destWarehouse: { select: { code: true, city: true } },
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
      },
    }),
    prisma.trip.findMany({
      take: 5,
      where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      orderBy: { created_at: "desc" },
      include: {
        vehicle: { select: { plate_number: true, vehicle_type: true } },
        primaryDriver: { select: { name: true } },
        manifest: { select: { manifest_no: true, status: true } },
      },
    }),
  ]);

  const approvedRevenue = approvedRevenueAgg._sum.amount?.toNumber() ?? 0;
  const approvedExpense = approvedExpenseAgg._sum.amount?.toNumber() ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Selamat Datang, {session.fullName}!
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Role:{" "}
            <strong className="text-slate-200">
              {session.roles.join(", ")}
            </strong>{" "}
            • Gudang Aktif:{" "}
            <strong className="text-blue-400">
              {activeWarehouse
                ? `${activeWarehouse.code} — ${activeWarehouse.name}`
                : "Belum dipilih"}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/shipments/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            + Buat Resi Baru
          </Link>
          <Link
            href="/dashboard/scan"
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Scan Barcode Gudang
          </Link>
        </div>
      </div>

      {/* KPI Operasional */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-xs font-medium text-slate-400">
            Total Resi Pengiriman
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-white">
            {totalShipments}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Terkirim (Delivered): {deliveredCount} resi
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-xs font-medium text-slate-400">
            Barang di Gudang Asal & Tujuan
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-blue-400">
            {atOriginCount + atDestCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Asal: {atOriginCount} • Tujuan: {atDestCount} • Koli Aktif:{" "}
            {activeKolisCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="text-xs font-medium text-slate-400">
            Dalam Perjalanan (Linehaul)
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-400">
            {inTransitCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Trip Aktif Berjalan: {activeTripsCount} armada
          </p>
        </div>

        {canViewFinance ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-xs font-medium text-slate-400">
              Pendapatan Tercatat (Approved)
            </div>
            <p className="mt-2 font-mono text-xl font-bold text-emerald-400">
              Rp {approvedRevenue.toLocaleString("id-ID")}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Uang Jalan Trip: Rp {approvedExpense.toLocaleString("id-ID")}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-xs font-medium text-slate-400">
              Gudang Operasional
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-emerald-400">
              {session.warehouses.length} Cabang
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Bali (BL) ⇄ Surabaya (SB)
            </p>
          </div>
        )}
      </div>

      {/* Ringkasan Resi Terbaru & Trip Aktif */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-white">Resi Terbaru</h2>
            <Link
              href="/dashboard/shipments"
              className="text-xs font-medium text-blue-400 hover:underline"
            >
              Lihat Semua →
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {recentShipments.length === 0 ? (
              <p className="px-5 py-6 text-xs italic text-slate-500">
                Belum ada transaksi pengiriman.
              </p>
            ) : (
              recentShipments.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-5 py-3 text-xs hover:bg-slate-800/40"
                >
                  <div>
                    <Link
                      href={`/dashboard/shipments/${s.id}`}
                      className="font-mono font-semibold text-blue-400 hover:underline"
                    >
                      {s.shipment_no}
                    </Link>
                    <div className="mt-0.5 text-slate-300">
                      {s.sender.name} → {s.receiver.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                      {s.status}
                    </span>
                    <div className="mt-1 font-mono text-[11px] text-slate-400">
                      {s.originWarehouse.code} → {s.destWarehouse.code}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-white">
              Trip & Manifest Aktif
            </h2>
            <Link
              href="/dashboard/trips"
              className="text-xs font-medium text-blue-400 hover:underline"
            >
              Kelola Trip →
            </Link>
          </div>
          <div className="divide-y divide-slate-800">
            {activeTrips.length === 0 ? (
              <p className="px-5 py-6 text-xs italic text-slate-500">
                Tidak ada jadwal trip aktif saat ini.
              </p>
            ) : (
              activeTrips.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between px-5 py-3 text-xs hover:bg-slate-800/40"
                >
                  <div>
                    <Link
                      href={`/dashboard/trips/${t.id}`}
                      className="font-mono font-semibold text-blue-400 hover:underline"
                    >
                      {t.trip_code}
                    </Link>
                    <div className="mt-0.5 text-slate-300">
                      {t.vehicle.plate_number} • Supir: {t.primaryDriver.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="rounded border border-amber-800/60 bg-amber-950/70 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                      {t.status}
                    </span>
                    {t.manifest && (
                      <div className="mt-1 font-mono text-[11px] text-slate-400">
                        {t.manifest.manifest_no}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
