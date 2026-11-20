"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { ReportsPageData } from "../report.queries";

interface ReportsManagerProps {
  data: ReportsPageData;
}

function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: string[][],
) {
  const escapeCell = (cell: string) =>
    `"${String(cell ?? "").replace(/"/g, '""')}"`;
  const csvContent =
    "\uFEFF" +
    [
      headers.map(escapeCell).join(","),
      ...rows.map((row) => row.map(escapeCell).join(",")),
    ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReportsManager({ data }: ReportsManagerProps) {
  const [activeTab, setActiveTab] = useState<"SHIPMENTS" | "TRIPS" | "FINANCE">(
    "SHIPMENTS",
  );
  const [routeFilter, setRouteFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const routeFieldId = useId();
  const statusFieldId = useId();

  const filteredShipments = data.shipments.filter((s) => {
    if (
      routeFilter === "BL-SB" &&
      !(s.origin_code === "BL" && s.dest_code === "SB")
    ) {
      return false;
    }
    if (
      routeFilter === "SB-BL" &&
      !(s.origin_code === "SB" && s.dest_code === "BL")
    ) {
      return false;
    }
    if (statusFilter !== "ALL" && s.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleExportShipmentsCsv = () => {
    const headers = [
      "No Resi",
      "Tanggal",
      "Asal",
      "Tujuan",
      "Pengirim",
      "Penerima",
      "Deskripsi Barang",
      "Qty",
      "Berat (Kg)",
      "Volume (m3)",
      "Jenis Tarif",
      ...(data.canViewFinance ? ["Nominal Tercatat (Rp)"] : []),
      "Status",
    ];

    const rows = filteredShipments.map((s) => [
      s.shipment_no,
      new Date(s.created_at).toLocaleDateString("id-ID"),
      `${s.origin_code} - ${s.origin_city}`,
      `${s.dest_code} - ${s.dest_city}`,
      s.sender_name,
      s.receiver_name,
      s.goods_description,
      String(s.qty),
      String(s.weight),
      String(s.volume),
      s.pricing_name,
      ...(data.canViewFinance ? [String(s.price_nominal)] : []),
      s.status,
    ]);

    const dateTag = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`laporan-pengiriman-${dateTag}.csv`, headers, rows);
  };

  const handleExportTripsCsv = () => {
    const headers = [
      "Kode Trip",
      "No Manifest",
      "No Polisi",
      "Jenis Armada",
      "Primary Driver",
      "Status Trip",
      "Jumlah Resi",
      "Total Berat (Kg)",
      ...(data.canViewFinance ? ["Uang Keberangkatan Approved (Rp)"] : []),
    ];

    const rows = data.trips.map((t) => [
      t.trip_code,
      t.manifest_no,
      t.plate_number,
      t.vehicle_type,
      t.driver_name,
      t.status,
      String(t.shipment_count),
      t.total_weight.toFixed(2),
      ...(data.canViewFinance ? [String(t.approved_expense)] : []),
    ]);

    const dateTag = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`laporan-armada-trip-${dateTag}.csv`, headers, rows);
  };

  const handleExportFinanceCsv = () => {
    const headers = [
      "Bulan",
      "Pendapatan Tercatat Approved (Rp)",
      "Koreksi / Reversal (Rp)",
      "Uang Keberangkatan Trip Approved (Rp)",
    ];

    const rows = data.financeSummary.monthlyRecap.map((m) => [
      m.month,
      String(m.approved_revenue),
      String(m.reversals_or_adjustments),
      String(m.approved_trip_expenses),
    ]);

    const dateTag = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`rekap-keuangan-mvp-${dateTag}.csv`, headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Ringkasan Operasional & Gudang */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] font-medium text-slate-400">
            Total Transaksi Resi
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-white">
            {data.operationalSummary.totalShipments}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {data.operationalSummary.totalWeightKg.toFixed(1)} kg total
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] font-medium text-slate-400">
            Di Gudang Asal
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-blue-400">
            {data.operationalSummary.inWarehouseOrigin}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Koli aktif: {data.operationalSummary.activeKolis}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] font-medium text-slate-400">
            Dalam Perjalanan
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-amber-400">
            {data.operationalSummary.inTransit}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Manifested / In Transit
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] font-medium text-slate-400">
            Siap Diambil (Tujuan)
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-cyan-400">
            {data.operationalSummary.inWarehouseDest}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Menunggu POD pickup
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] font-medium text-slate-400">
            Selesai (Delivered)
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
            {data.operationalSummary.delivered}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Sudah serah terima
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-[11px] font-medium text-slate-400">
            Retur / Batal
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-rose-400">
            {data.operationalSummary.problematic}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Cancelled / Returned
          </div>
        </div>
      </div>

      {/* Tab Navigasi & Tombol Ekspor */}
      <div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-3 sm:flex-row sm:items-center print:hidden">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("SHIPMENTS")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "SHIPMENTS"
                ? "bg-blue-600 text-white"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Laporan Pengiriman & Gudang ({filteredShipments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("TRIPS")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === "TRIPS"
                ? "bg-blue-600 text-white"
                : "bg-slate-900 text-slate-400 hover:text-white"
            }`}
          >
            Laporan Armada & Trip ({data.trips.length})
          </button>

          {data.canViewFinance && (
            <button
              type="button"
              onClick={() => setActiveTab("FINANCE")}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
                activeTab === "FINANCE"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              Rekap Keuangan MVP
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (activeTab === "SHIPMENTS") handleExportShipmentsCsv();
              else if (activeTab === "TRIPS") handleExportTripsCsv();
              else handleExportFinanceCsv();
            }}
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            ⬇ Ekspor CSV / Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            🖨 Cetak / PDF
          </button>
        </div>
      </div>

      {activeTab === "SHIPMENTS" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-2 print:hidden">
            <div>
              <label
                htmlFor={routeFieldId}
                className="block text-xs font-medium text-slate-400"
              >
                Filter Arah Rute
              </label>
              <select
                id={routeFieldId}
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="ALL">Semua Rute (Bali ⇄ Surabaya)</option>
                <option value="BL-SB">Bali (BL) → Surabaya (SB)</option>
                <option value="SB-BL">Surabaya (SB) → Bali (BL)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor={statusFieldId}
                className="block text-xs font-medium text-slate-400"
              >
                Filter Status Pengiriman
              </label>
              <select
                id={statusFieldId}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="ALL">Semua Status</option>
                <option value="DRAFT">DRAFT</option>
                <option value="RECEIVED_AT_ORIGIN">RECEIVED_AT_ORIGIN</option>
                <option value="MANIFESTED">MANIFESTED</option>
                <option value="IN_TRANSIT">IN_TRANSIT</option>
                <option value="ARRIVED_AT_DESTINATION">
                  ARRIVED_AT_DESTINATION
                </option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="RETURNED">RETURNED</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">No. Resi</th>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Rute</th>
                    <th className="px-4 py-3 font-semibold">
                      Pengirim → Penerima
                    </th>
                    <th className="px-4 py-3 font-semibold">Berat / Qty</th>
                    <th className="px-4 py-3 font-semibold">Jenis Tarif</th>
                    {data.canViewFinance && (
                      <th className="px-4 py-3 font-semibold">Nominal</th>
                    )}
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredShipments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={data.canViewFinance ? 8 : 7}
                        className="px-4 py-8 text-center italic text-slate-500"
                      >
                        Tidak ada data pengiriman pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    filteredShipments.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-mono">
                          <Link
                            href={`/dashboard/shipments/${s.id}`}
                            className="font-semibold text-blue-400 hover:underline"
                          >
                            {s.shipment_no}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-400">
                          {new Date(s.created_at).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {s.origin_code} → {s.dest_code}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white">{s.sender_name}</div>
                          <div className="text-[11px] text-slate-400">
                            → {s.receiver_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          {s.weight} kg ({s.qty} koli)
                        </td>
                        <td className="px-4 py-3">{s.pricing_name}</td>
                        {data.canViewFinance && (
                          <td className="px-4 py-3 font-mono text-emerald-400">
                            Rp {s.price_nominal.toLocaleString("id-ID")}
                          </td>
                        )}
                        <td className="px-4 py-3 font-mono text-[11px]">
                          {s.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "TRIPS" && (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Kode Trip</th>
                  <th className="px-4 py-3 font-semibold">No. Manifest</th>
                  <th className="px-4 py-3 font-semibold">Armada & Supir</th>
                  <th className="px-4 py-3 font-semibold">Muatan Manifest</th>
                  {data.canViewFinance && (
                    <th className="px-4 py-3 font-semibold">
                      Uang Keberangkatan
                    </th>
                  )}
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.trips.length === 0 ? (
                  <tr>
                    <td
                      colSpan={data.canViewFinance ? 6 : 5}
                      className="px-4 py-8 text-center italic text-slate-500"
                    >
                      Belum ada riwayat perjalanan armada.
                    </td>
                  </tr>
                ) : (
                  data.trips.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono">
                        <Link
                          href={`/dashboard/trips/${t.id}`}
                          className="font-semibold text-blue-400 hover:underline"
                        >
                          {t.trip_code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {t.manifest_no}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">
                          {t.plate_number} ({t.vehicle_type})
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Supir: {t.driver_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {t.shipment_count} resi • {t.total_weight.toFixed(2)} kg
                      </td>
                      {data.canViewFinance && (
                        <td className="px-4 py-3 font-mono text-amber-400">
                          Rp {t.approved_expense.toLocaleString("id-ID")}
                        </td>
                      )}
                      <td className="px-4 py-3 font-mono text-[11px]">
                        {t.status}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "FINANCE" && data.canViewFinance && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs font-medium text-slate-400">
                Pendapatan Tercatat (Approved)
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                Rp {data.financeSummary.approvedRevenue.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs font-medium text-slate-400">
                Total Koreksi / Reversal
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-rose-400">
                Rp{" "}
                {data.financeSummary.totalCorrections.toLocaleString("id-ID")}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-xs font-medium text-slate-400">
                Total Uang Keberangkatan Trip
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-amber-400">
                Rp{" "}
                {data.financeSummary.approvedTripExpenses.toLocaleString(
                  "id-ID",
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase text-slate-400">
                Pendapatan Berdasarkan Jenis Harga
              </div>
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Jenis Harga</th>
                    <th className="px-4 py-2.5">Jumlah Catatan</th>
                    <th className="px-4 py-2.5 text-right">Total Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.financeSummary.revenueByPricingType.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-center italic text-slate-500"
                      >
                        Belum ada pendapatan disetujui.
                      </td>
                    </tr>
                  ) : (
                    data.financeSummary.revenueByPricingType.map((item) => (
                      <tr key={item.name}>
                        <td className="px-4 py-2.5 font-medium text-white">
                          {item.name}
                        </td>
                        <td className="px-4 py-2.5 font-mono">{item.count}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                          Rp {item.total.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase text-slate-400">
                Rekap Keuangan Bulanan (MVP)
              </div>
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Bulan</th>
                    <th className="px-4 py-2.5 text-right">Pendapatan</th>
                    <th className="px-4 py-2.5 text-right">Uang Jalan Trip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.financeSummary.monthlyRecap.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-center italic text-slate-500"
                      >
                        Belum ada data rekap bulanan.
                      </td>
                    </tr>
                  ) : (
                    data.financeSummary.monthlyRecap.map((m) => (
                      <tr key={m.month}>
                        <td className="px-4 py-2.5 font-mono font-semibold text-white">
                          {m.month}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                          Rp {m.approved_revenue.toLocaleString("id-ID")}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-amber-400">
                          Rp {m.approved_trip_expenses.toLocaleString("id-ID")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
