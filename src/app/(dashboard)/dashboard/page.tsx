import { getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getCurrentSession();

  const activeWarehouse = session.warehouses.find(
    (w) => w.id === session.activeWarehouseId,
  );

  // Fetch some summary stats for the active warehouse or overall
  const [totalShipments, activeTrips, totalWarehouses] = await Promise.all([
    prisma.shipment.count(),
    prisma.trip.count({
      where: {
        status: {
          notIn: ["CLOSED", "CANCELLED"],
        },
      },
    }),
    prisma.warehouse.count({ where: { is_active: true } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Selamat Datang, {session.fullName}!
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Anda masuk sebagai{" "}
          <strong className="text-slate-200">{session.roles.join(", ")}</strong>{" "}
          di Gudang Aktif:{" "}
          <strong className="text-blue-400">
            {activeWarehouse
              ? `${activeWarehouse.code} - ${activeWarehouse.name}`
              : "Belum dipilih"}
          </strong>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">
              Total Pengiriman (Resi)
            </span>
            <span className="rounded-lg bg-blue-600/20 p-2.5 text-blue-400">
              📦
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{totalShipments}</p>
          <p className="mt-1 text-xs text-slate-500">
            Seluruh Resi Bali ⇄ Surabaya
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">
              Trip Aktif / Dalam Perjalanan
            </span>
            <span className="rounded-lg bg-amber-600/20 p-2.5 text-amber-400">
              🚚
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{activeTrips}</p>
          <p className="mt-1 text-xs text-slate-500">
            Trip belum ditutup atau dibatalkan
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">
              Gudang Aktif Operasional
            </span>
            <span className="rounded-lg bg-emerald-600/20 p-2.5 text-emerald-400">
              🏢
            </span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">
            {totalWarehouses}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Bali (BL) & Surabaya (SB)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-white mb-4">
          Informasi Sesi & Hak Akses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <span className="block font-medium text-slate-400 mb-1">
              Daftar Permission Aktif:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-3 rounded-lg border border-slate-800 bg-slate-950">
              {session.permissions.length > 0 ? (
                session.permissions.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300"
                  >
                    {p}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">
                  Tidak ada permission khusus
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="block font-medium text-slate-400 mb-1">
              Daftar Gudang Akses User:
            </span>
            <div className="space-y-2 max-h-36 overflow-y-auto p-3 rounded-lg border border-slate-800 bg-slate-950">
              {session.warehouses.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-slate-300">
                    {w.code} - {w.name}
                  </span>
                  {w.id === session.activeWarehouseId && (
                    <span className="rounded bg-blue-600/20 px-1.5 py-0.5 text-[10px] text-blue-400 font-medium">
                      Aktif
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
