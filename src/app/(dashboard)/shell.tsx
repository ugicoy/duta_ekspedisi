"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { logoutAction, switchActiveWarehouseAction } from "./actions";

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

interface NavItem {
  href: string;
  label: string;
  icon: string;
  section: "UTAMA" | "OPERASIONAL" | "KEUANGAN & MASTER";
  requiredPermissions?: string[];
  requiredRoles?: string[];
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "📊",
    section: "UTAMA",
    exact: true,
  },
  {
    href: "/dashboard/reports",
    label: "Laporan & Ekspor",
    icon: "📈",
    section: "UTAMA",
    requiredPermissions: ["shipment:read", "trip:read", "finance:read"],
  },
  {
    href: "/dashboard/shipments",
    label: "Resi Pengiriman",
    icon: "📦",
    section: "OPERASIONAL",
    requiredPermissions: ["shipment:read", "shipment:create"],
  },
  {
    href: "/dashboard/scan",
    label: "Scan Barcode Gudang",
    icon: "📷",
    section: "OPERASIONAL",
    requiredPermissions: ["warehouse:scan"],
  },
  {
    href: "/dashboard/kolis",
    label: "Konsolidasi Koli",
    icon: "🧺",
    section: "OPERASIONAL",
    requiredPermissions: ["koli:manage", "shipment:read"],
  },
  {
    href: "/dashboard/trips",
    label: "Trip & Manifest",
    icon: "🚚",
    section: "OPERASIONAL",
    requiredPermissions: ["trip:read", "manifest:read"],
  },
  {
    href: "/driver",
    label: "Mode PWA Driver",
    icon: "📱",
    section: "OPERASIONAL",
  },
  {
    href: "/dashboard/delivery",
    label: "Serah Terima (POD)",
    icon: "✅",
    section: "OPERASIONAL",
    requiredPermissions: ["delivery:pod", "shipment:read"],
  },
  {
    href: "/dashboard/finance",
    label: "Keuangan & Biaya Trip",
    icon: "💰",
    section: "KEUANGAN & MASTER",
    requiredPermissions: [
      "finance:read",
      "finance:create",
      "finance:expense_create",
    ],
  },
  {
    href: "/dashboard/tariffs",
    label: "Referensi Tarif",
    icon: "🏷️",
    section: "KEUANGAN & MASTER",
    requiredPermissions: ["master:read", "master:manage", "config:manage"],
  },
  {
    href: "/dashboard/master",
    label: "Master Data",
    icon: "🗂️",
    section: "KEUANGAN & MASTER",
    requiredPermissions: ["master:read", "master:manage"],
  },
  {
    href: "/dashboard/master/config",
    label: "Pengaturan Sistem",
    icon: "⚙️",
    section: "KEUANGAN & MASTER",
    requiredPermissions: ["config:manage"],
  },
  {
    href: "/dashboard/users",
    label: "Manajemen User",
    icon: "👥",
    section: "KEUANGAN & MASTER",
    requiredPermissions: ["user:manage"],
    requiredRoles: ["OWNER", "SUPER_ADMIN", "MANAGER"],
  },
  {
    href: "/dashboard/audit",
    label: "Audit Log",
    icon: "🛡️",
    section: "KEUANGAN & MASTER",
    requiredPermissions: ["audit:read"],
    requiredRoles: ["OWNER", "SUPER_ADMIN", "MANAGER"],
  },
];

const SECTIONS: NavItem["section"][] = [
  "UTAMA",
  "OPERASIONAL",
  "KEUANGAN & MASTER",
];

export default function DashboardShell({
  children,
  user,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeWhId, setActiveWhId] = useState(user.activeWarehouseId);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);

  const isSuperUser =
    user.roles.includes("OWNER") || user.roles.includes("SUPER_ADMIN");

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if ((!item.requiredPermissions && !item.requiredRoles) || isSuperUser) {
      return true;
    }
    const hasPerm = item.requiredPermissions?.some((perm) =>
      user.permissions.includes(perm),
    );
    const hasRole = item.requiredRoles?.some((role) =>
      user.roles.includes(role),
    );
    return Boolean(hasPerm || hasRole);
  });

  const activeWarehouse = user.warehouses.find((w) => w.id === activeWhId);

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

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 md:flex-row">
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 md:hidden print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Buka menu navigasi"
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            ☰
          </button>
          <div>
            <div className="text-sm font-bold text-white">Duta Ekspedisi</div>
            <div className="text-[10px] text-slate-400">
              {activeWarehouse
                ? `${activeWarehouse.code} — ${activeWarehouse.name}`
                : "Bali ⇄ Surabaya"}
            </div>
          </div>
        </div>

        <Link
          href="/dashboard/scan"
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
        >
          📷 Scan
        </Link>
      </header>

      {/* Backdrop Mobile */}
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Tutup menu navigasi"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/65 md:hidden"
        />
      )}

      {/* Sidebar Desktop & Slide-over Mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-800 bg-slate-900 p-5 transition-transform duration-200 md:static md:translate-x-0 print:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Duta Ekspedisi</h2>
              <p className="text-xs text-slate-400">Bali ⇄ Surabaya Cargo</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Tutup sidebar"
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-white md:hidden"
            >
              ✕
            </button>
          </div>

          <div className="mb-5 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <label
              htmlFor="active-warehouse-select"
              className="mb-1 block text-[11px] font-medium text-slate-400"
            >
              Gudang Aktif
            </label>
            <select
              id="active-warehouse-select"
              value={activeWhId}
              onChange={handleWarehouseChange}
              disabled={isPending}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {user.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </div>

          <nav className="space-y-4">
            {SECTIONS.map((section) => {
              const sectionItems = visibleNavItems.filter(
                (item) => item.section === section,
              );
              if (sectionItems.length === 0) return null;

              return (
                <div key={section} className="space-y-1">
                  <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {section}
                  </div>
                  {sectionItems.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-blue-600 text-white"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 space-y-2.5 border-t border-slate-800 pt-4 text-xs text-slate-400">
          <div>
            <p className="font-semibold text-slate-200">{user.fullName}</p>
            <p className="text-[11px] text-blue-400">{user.roles.join(", ")}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setPwModalOpen(true);
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            🔑 Ganti Password
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="w-full rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-left text-xs font-medium text-red-300 transition hover:bg-red-900/60 hover:text-white disabled:opacity-50"
          >
            🚪 {isPending ? "Keluar..." : "Keluar (Logout)"}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 print:p-0">
        {children}
      </main>

      <ChangePasswordModal
        open={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
      />
    </div>
  );
}
