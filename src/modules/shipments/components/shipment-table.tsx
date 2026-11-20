"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import type { ShipmentListItem } from "../shipment.queries";

interface ShipmentTableProps {
  initialShipments: ShipmentListItem[];
}

const STATUS_BADGE_MAP: Record<string, string> = {
  DRAFT: "border-slate-700 bg-slate-800/80 text-slate-300",
  BOOKED: "border-sky-800/60 bg-sky-950/80 text-sky-300",
  RECEIVED_AT_ORIGIN: "border-blue-800/60 bg-blue-950/80 text-blue-300",
  MANIFESTED: "border-indigo-800/60 bg-indigo-950/80 text-indigo-300",
  IN_TRANSIT: "border-amber-800/60 bg-amber-950/80 text-amber-300",
  ARRIVED_AT_DESTINATION: "border-cyan-800/60 bg-cyan-950/80 text-cyan-300",
  OUT_FOR_DELIVERY: "border-purple-800/60 bg-purple-950/80 text-purple-300",
  DELIVERED: "border-emerald-800/60 bg-emerald-950/80 text-emerald-300",
  RETURNED: "border-rose-800/60 bg-rose-950/80 text-rose-300",
  CANCELLED: "border-red-800/60 bg-red-950/80 text-red-400",
};

export function ShipmentTable({ initialShipments }: ShipmentTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const searchId = useId();
  const statusId = useId();

  const statuses = useMemo(() => {
    const unique = new Set(initialShipments.map((s) => s.status));
    return ["ALL", ...Array.from(unique)];
  }, [initialShipments]);

  const filteredShipments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialShipments.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" || item.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;

      return (
        item.shipment_no.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q) ||
        item.sender.name.toLowerCase().includes(q) ||
        item.receiver.name.toLowerCase().includes(q) ||
        item.goods_description.toLowerCase().includes(q)
      );
    });
  }, [initialShipments, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label
              htmlFor={searchId}
              className="block text-xs font-medium text-slate-400"
            >
              Cari Resi / Pengirim / Penerima
            </label>
            <input
              id={searchId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Contoh: DE-DPS-2026... atau nama customer"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500"
            />
          </div>

          <div className="sm:w-52">
            <label
              htmlFor={statusId}
              className="block text-xs font-medium text-slate-400"
            >
              Filter Status
            </label>
            <select
              id={statusId}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {statuses.map((st) => (
                <option key={st} value={st}>
                  {st === "ALL" ? "Semua Status" : st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Link
          href="/dashboard/shipments/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          + Buat Resi Baru
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">No. Resi</th>
                <th className="px-4 py-3 font-semibold">Rute Cabang</th>
                <th className="px-4 py-3 font-semibold">Pengirim → Penerima</th>
                <th className="px-4 py-3 font-semibold">Muatan</th>
                <th className="px-4 py-3 font-semibold">Layanan & Biaya</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredShipments.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center italic text-slate-500"
                  >
                    {initialShipments.length === 0
                      ? "Belum ada data resi pengiriman. Klik '+ Buat Resi Baru' untuk memulai."
                      : "Tidak ada resi yang cocok dengan filter pencarian."}
                  </td>
                </tr>
              ) : (
                filteredShipments.map((item) => {
                  const badgeClass =
                    STATUS_BADGE_MAP[item.status] ??
                    "border-slate-700 bg-slate-800 text-slate-300";

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/shipments/${item.id}`}
                          className="font-mono font-semibold text-blue-400 hover:underline"
                        >
                          {item.shipment_no}
                        </Link>
                        <div className="font-mono text-[11px] text-slate-500">
                          {item.barcode}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">
                          {item.originWarehouse.city} →{" "}
                          {item.destWarehouse.city}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.originWarehouse.code} →{" "}
                          {item.destWarehouse.code}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">
                          {item.sender.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          → {item.receiver.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[180px] truncate text-slate-200">
                          {item.goods_description}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {item.qty} koli • {item.weight} kg • {item.volume} m³
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-emerald-400">
                          Rp {item.price_nominal_snap.toLocaleString("id-ID")}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.price_name_snap}
                          {item.manual_price > 0 ? " (Manual)" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/shipments/${item.id}`}
                          className="inline-flex rounded-md border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                          Detail / Cetak
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
