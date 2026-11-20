"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import {
  approveFinanceRecordAction,
  approveTripExpenseAction,
  createTripExpenseAction,
} from "../finance.actions";
import type { FinancePageData } from "../finance.queries";

interface FinanceManagerProps {
  data: FinancePageData;
}

const APPROVAL_BADGE: Record<string, string> = {
  PENDING: "border-amber-800/60 bg-amber-950/80 text-amber-300",
  APPROVED: "border-emerald-800/60 bg-emerald-950/80 text-emerald-300",
  REJECTED: "border-red-800/60 bg-red-950/80 text-red-300",
};

export function FinanceManager({ data }: FinanceManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"REVENUE" | "EXPENSE" | "REPORT">(
    "REVENUE",
  );
  const [error, setError] = useState<string | null>(null);

  // State Form Pengeluaran Operasional Trip
  const [tripId, setTripId] = useState(data.trips[0]?.id ?? "");
  const [expAmount, setExpAmount] = useState("");
  const [expNotes, setExpNotes] = useState("");

  const tripSelectId = useId();
  const expAmtId = useId();
  const expNoteId = useId();

  const unpaidShipmentsSummary = useMemo(() => {
    const unpaid = data.shipments.filter(
      (s) => s.price_nominal_snap - s.paidAmount > 0,
    );
    const totalUnpaid = unpaid.reduce(
      (sum, s) => sum + Math.max(s.price_nominal_snap - s.paidAmount, 0),
      0,
    );
    return { count: unpaid.length, totalUnpaid };
  }, [data.shipments]);

  const handleFinanceApproval = (
    recordId: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    setError(null);
    startTransition(async () => {
      const res = await approveFinanceRecordAction(recordId, decision);
      if (!res.success) {
        setError(res.error ?? "Gagal memproses approval.");
        return;
      }
      router.refresh();
    });
  };

  const handleCreateExpense = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(expAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Masukkan nominal pengeluaran operasional yang valid.");
      return;
    }

    startTransition(async () => {
      const res = await createTripExpenseAction({
        trip_id: tripId,
        amount: parsedAmount,
        notes: expNotes,
      });

      if (!res.success) {
        setError(res.error ?? "Gagal mencatat pengeluaran operasional.");
        return;
      }

      setExpAmount("");
      setExpNotes("");
      router.refresh();
    });
  };

  const handleExpenseApproval = (
    expenseId: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    setError(null);
    startTransition(async () => {
      const res = await approveTripExpenseAction(expenseId, decision);
      if (!res.success) {
        setError(res.error ?? "Gagal memproses approval pengeluaran.");
        return;
      }
      router.refresh();
    });
  };

  const netOperatingMargin =
    data.summary.approvedRevenue - data.summary.approvedExpenses;

  return (
    <div className="space-y-6">
      {/* Kartu Ringkasan Keuangan */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs font-medium text-slate-400">
            Uang Masuk dari Paket
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
            Rp {data.summary.approvedRevenue.toLocaleString("id-ID")}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Piutang (Bayar Ambil): Rp{" "}
            {unpaidShipmentsSummary.totalUnpaid.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs font-medium text-slate-400">
            Pengeluaran Operasional
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-amber-400">
            Rp {data.summary.approvedExpenses.toLocaleString("id-ID")}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Pending Approval: Rp{" "}
            {data.summary.pendingExpenses.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs font-medium text-slate-400">
            Selisih Bersih Operasional
          </div>
          <div
            className={`mt-1 font-mono text-lg font-bold ${
              netOperatingMargin >= 0 ? "text-blue-400" : "text-red-400"
            }`}
          >
            Rp {netOperatingMargin.toLocaleString("id-ID")}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Uang Masuk − Pengeluaran Approved
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs font-medium text-slate-400">
            Paket Belum Lunas (Ambil)
          </div>
          <div className="mt-1 font-mono text-lg font-bold text-white">
            {unpaidShipmentsSummary.count} Resi
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Menunggu pelunasan di gudang tujuan
          </div>
        </div>
      </div>

      {/* Navigasi Tab */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => {
            setActiveTab("REVENUE");
            setError(null);
          }}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "REVENUE"
              ? "bg-blue-600 text-white"
              : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          1. Uang Masuk Paket ({data.financeRecords.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("EXPENSE");
            setError(null);
          }}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "EXPENSE"
              ? "bg-blue-600 text-white"
              : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          2. Pengeluaran Operasional ({data.tripExpenses.length})
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("REPORT");
            setError(null);
          }}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
            activeTab === "REPORT"
              ? "bg-blue-600 text-white"
              : "bg-slate-900 text-slate-400 hover:text-white"
          }`}
        >
          3. Laporan Keuangan
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/70 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* TAB 1: Uang Masuk Paket (Otomatis dari Resi & POD) */}
      {activeTab === "REVENUE" && (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Riwayat Uang Masuk dari Pengiriman Paket
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Data pemasukan tercatat otomatis saat resi diterbitkan lunas
                atau saat pelunasan pengambilan paket di gudang tujuan.
              </p>
            </div>
            <Link
              href="/dashboard/shipments/new"
              className="self-start rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              + Buat Resi Baru
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">No. Resi</th>
                    <th className="px-4 py-3 font-semibold">
                      Pengirim / Penerima
                    </th>
                    <th className="px-4 py-3 font-semibold">Nominal Masuk</th>
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.financeRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center italic text-slate-500"
                      >
                        Belum ada pemasukan uang dari paket.
                      </td>
                    </tr>
                  ) : (
                    data.financeRecords.map((rec) => {
                      const badgeClass =
                        APPROVAL_BADGE[rec.approval_status] ??
                        "border-slate-700 bg-slate-800 text-slate-300";

                      return (
                        <tr key={rec.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-[11px] text-slate-400">
                            {new Date(rec.created_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <Link
                              href={`/dashboard/shipments/${rec.shipment.id}`}
                              className="font-semibold text-blue-400 hover:underline"
                            >
                              {rec.shipment.shipment_no}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">
                              {rec.shipment.sender.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              → {rec.shipment.receiver.name}
                            </div>
                          </td>
                          <td
                            className={`px-4 py-3 font-mono font-semibold ${
                              rec.amount >= 0
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            Rp {rec.amount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {rec.notes ?? "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                            >
                              {rec.approval_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {rec.approval_status === "PENDING" ? (
                              <div className="inline-flex gap-1.5">
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleFinanceApproval(rec.id, "APPROVED")
                                  }
                                  className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleFinanceApproval(rec.id, "REJECTED")
                                  }
                                  className="rounded border border-red-800/60 bg-red-950/60 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-900/60 disabled:opacity-50"
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                Tercatat
                              </span>
                            )}
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
      )}

      {/* TAB 2: Pengeluaran Operasional */}
      {activeTab === "EXPENSE" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-sm font-semibold text-white">
              Input Pengeluaran Operasional (Trip / BBM / Feri / Bongkar Muat)
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Catat pengeluaran operasional armada atau cabang. Pengeluaran akan
              masuk antrean{" "}
              <span className="font-mono text-amber-400">PENDING</span> hingga
              disetujui Manajer/Owner.
            </p>

            <form
              onSubmit={handleCreateExpense}
              className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end"
            >
              <div>
                <label
                  htmlFor={tripSelectId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Kode Trip / Operasional
                </label>
                <select
                  id={tripSelectId}
                  required
                  value={tripId}
                  onChange={(e) => setTripId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {data.trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.trip_code} • {t.plateNumber} ({t.driverName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={expAmtId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Nominal Pengeluaran (Rp)
                </label>
                <input
                  id={expAmtId}
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Contoh: 1500000"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor={expNoteId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Rincian Pengeluaran
                </label>
                <input
                  id={expNoteId}
                  type="text"
                  required
                  value={expNotes}
                  onChange={(e) => setExpNotes(e.target.value)}
                  placeholder="BBM Solar + Tiket Feri Ketapang-Gilimanuk"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {isPending ? "Menyimpan..." : "+ Catat Pengeluaran"}
              </button>
            </form>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Kode Trip</th>
                    <th className="px-4 py-3 font-semibold">Armada & Supir</th>
                    <th className="px-4 py-3 font-semibold">Nominal Biaya</th>
                    <th className="px-4 py-3 font-semibold">Rincian</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Approval
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.tripExpenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center italic text-slate-500"
                      >
                        Belum ada catatan pengeluaran operasional.
                      </td>
                    </tr>
                  ) : (
                    data.tripExpenses.map((exp) => {
                      const badgeClass =
                        APPROVAL_BADGE[exp.approval_status] ??
                        "border-slate-700 bg-slate-800 text-slate-300";

                      return (
                        <tr key={exp.id} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 text-[11px] text-slate-400">
                            {new Date(exp.created_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            <Link
                              href={`/dashboard/trips/${exp.trip.id}`}
                              className="font-semibold text-blue-400 hover:underline"
                            >
                              {exp.trip.trip_code}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">
                              {exp.trip.vehicle.plate_number}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {exp.trip.primaryDriver.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-amber-400">
                            Rp {exp.amount.toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {exp.notes ?? "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                            >
                              {exp.approval_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {exp.approval_status === "PENDING" ? (
                              <div className="inline-flex gap-1.5">
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleExpenseApproval(exp.id, "APPROVED")
                                  }
                                  className="rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleExpenseApproval(exp.id, "REJECTED")
                                  }
                                  className="rounded border border-red-800/60 bg-red-950/60 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-900/60 disabled:opacity-50"
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                -
                              </span>
                            )}
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
      )}

      {/* TAB 3: Laporan Keuangan */}
      {activeTab === "REPORT" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-col justify-between gap-2 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Laporan Ringkasan Keuangan Operasional
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Rekapitulasi total uang masuk dari paket, piutang belum lunas,
                  serta pengeluaran operasional yang telah disetujui.
                </p>
              </div>
              <Link
                href="/dashboard/reports"
                className="self-start rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Ekspor CSV / Laporan Lengkap →
              </Link>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-950/70 uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Pos Keuangan</th>
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      Nominal (Rp)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-emerald-400">
                      (+) Pemasukan Paket Lunas
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      Pembayaran paket lunas di awal & pelunasan saat ambil
                      paket (Approved)
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-400">
                      Rp {data.summary.approvedRevenue.toLocaleString("id-ID")}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-amber-400">
                      (−) Pengeluaran Operasional
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      Biaya perjalanan trip, BBM, penyeberangan feri &
                      operasional (Approved)
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-400">
                      Rp {data.summary.approvedExpenses.toLocaleString("id-ID")}
                    </td>
                  </tr>
                  <tr className="bg-slate-950/60 font-bold text-white">
                    <td className="px-4 py-3.5">
                      Laba / Selisih Kas Bersih Operasional
                    </td>
                    <td className="px-4 py-3.5 font-normal text-slate-400">
                      Total Pemasukan Paket dikurangi Total Pengeluaran
                      Operasional
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-mono text-sm ${
                        netOperatingMargin >= 0
                          ? "text-blue-400"
                          : "text-rose-400"
                      }`}
                    >
                      Rp {netOperatingMargin.toLocaleString("id-ID")}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-300">
                      Catatan Piutang (Bayar Saat Ambil Paket)
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {unpaidShipmentsSummary.count} resi aktif yang akan
                      dilunasi penerima di gudang tujuan
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-300">
                      Rp{" "}
                      {unpaidShipmentsSummary.totalUnpaid.toLocaleString(
                        "id-ID",
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
