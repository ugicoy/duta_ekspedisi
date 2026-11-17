import Link from "next/link";
import { requirePermission } from "@/lib/auth-guard";

export default async function MasterDashboardPage() {
  await requirePermission("master:read");

  const modules = [
    {
      title: "Manajemen Customer",
      description:
        "Kelola data pengirim & penerima (sender/receiver) cargo Bali ⇄ Surabaya.",
      href: "/dashboard/master/customers",
      icon: "👥",
      badge: "Customer & B2B",
    },
    {
      title: "Manajemen Kendaraan (Vehicle)",
      description:
        "Kelola armada truk, plat nomor, jenis kendaraan, dan kapasitas muatan.",
      href: "/dashboard/master/vehicles",
      icon: "🚛",
      badge: "Fleet Ops",
    },
    {
      title: "Manajemen Supir (Driver)",
      description:
        "Kelola data pengemudi, nomor SIM, kontak, dan tautan akun login driver.",
      href: "/dashboard/master/drivers",
      icon: "🧑‍✈️",
      badge: "Driver Portal",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Master Data Management
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Pusat pengelolaan data referensi sistem ekspedisi kargo Bali ⇄
          Surabaya.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-lg transition-all hover:border-blue-500/50 hover:bg-slate-850 hover:shadow-blue-500/10"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{m.icon}</span>
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                  {m.badge}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
                {m.title}
              </h2>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {m.description}
              </p>
            </div>
            <div className="mt-6 flex items-center text-xs font-medium text-blue-400">
              Kelola Modul →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
