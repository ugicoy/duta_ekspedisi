"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { switchActiveWarehouseAction } from "./actions";

interface WarehouseItem {
  id: string;
  code: string;
  name: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
  user: {
    userId: string;
    username: string;
    fullName: string;
    roles: string[];
    permissions: string[];
    warehouses: WarehouseItem[];
    activeWarehouseId: string;
  };
}

export default function DashboardShell({
  children,
  user,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeWhId, setActiveWhId] = useState(user.activeWarehouseId);

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setActiveWhId(newId);
    startTransition(async () => {
      const res = await switchActiveWarehouseAction(newId);
      if (res.success) {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="w-64 border-r border-slate-800 bg-slate-900 p-6 flex flex-col justify-between">
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Duta Ekspedisi</h2>
            <p className="text-xs text-slate-400">Bali ⇄ Surabaya Cargo</p>
          </div>

          <div className="mb-6 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <label
              htmlFor="active-warehouse-select"
              className="block text-[11px] font-medium text-slate-400 mb-1"
            >
              Gudang Aktif
            </label>
            <select
              id="active-warehouse-select"
              value={activeWhId}
              onChange={handleWarehouseChange}
              disabled={isPending}
              className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {user.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>

          <nav className="space-y-1.5">
            <Link
              href="/dashboard"
              className={`block px-3 py-2 rounded text-sm font-medium transition-colors ${
                pathname === "/dashboard"
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              📊 Dashboard
            </Link>
            <Link
              href="/dashboard/master"
              className={`block px-3 py-2 rounded text-sm font-medium transition-colors ${
                pathname.startsWith("/dashboard/master")
                  ? "bg-blue-600 text-white"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              🗂️ Master Data
            </Link>
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-200">{user.fullName}</p>
          <p className="text-[11px] text-blue-400">{user.roles.join(", ")}</p>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
