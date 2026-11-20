"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { BarcodeLabelGraphic } from "@/components/barcode-label-graphic";
import type { ShipmentStatus } from "@/generated/prisma/enums";
import { updateShipmentStatusAction } from "../shipment.actions";
import type { ShipmentDetail as ShipmentDetailType } from "../shipment.queries";

interface ShipmentDetailProps {
  shipment: ShipmentDetailType;
}

interface NextActionOption {
  status: ShipmentStatus;
  label: string;
  style: string;
}

const NEXT_ACTIONS_BY_STATUS: Partial<
  Record<ShipmentStatus, NextActionOption[]>
> = {
  DRAFT: [
    {
      status: "BOOKED",
      label: "Konfirmasi Booking",
      style: "bg-sky-600 text-white hover:bg-sky-500",
    },
    {
      status: "RECEIVED_AT_ORIGIN",
      label: "Terima Barang di Gudang Asal",
      style: "bg-blue-600 text-white hover:bg-blue-500",
    },
    {
      status: "CANCELLED",
      label: "Batalkan Resi",
      style:
        "border border-red-800/60 bg-red-950/60 text-red-300 hover:bg-red-900/60",
    },
  ],
  BOOKED: [
    {
      status: "RECEIVED_AT_ORIGIN",
      label: "Terima Barang di Gudang Asal",
      style: "bg-blue-600 text-white hover:bg-blue-500",
    },
    {
      status: "CANCELLED",
      label: "Batalkan Resi",
      style:
        "border border-red-800/60 bg-red-950/60 text-red-300 hover:bg-red-900/60",
    },
  ],
  RECEIVED_AT_ORIGIN: [
    {
      status: "CANCELLED",
      label: "Batalkan Resi",
      style:
        "border border-red-800/60 bg-red-950/60 text-red-300 hover:bg-red-900/60",
    },
  ],
  ARRIVED_AT_DESTINATION: [
    {
      status: "OUT_FOR_DELIVERY",
      label: "Proses Antar ke Penerima",
      style: "bg-purple-600 text-white hover:bg-purple-500",
    },
    {
      status: "DELIVERED",
      label: "Tandai Terkirim (Delivered)",
      style: "bg-emerald-600 text-white hover:bg-emerald-500",
    },
  ],
  OUT_FOR_DELIVERY: [
    {
      status: "DELIVERED",
      label: "Tandai Terkirim (Delivered)",
      style: "bg-emerald-600 text-white hover:bg-emerald-500",
    },
    {
      status: "RETURNED",
      label: "Tandai Retur",
      style:
        "border border-rose-800/60 bg-rose-950/60 text-rose-300 hover:bg-rose-900/60",
    },
  ],
};

export function ShipmentDetail({ shipment }: ShipmentDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  const notesId = useId();
  const availableActions = NEXT_ACTIONS_BY_STATUS[shipment.status] ?? [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("created") === "1") {
      setJustCreated(true);
    }
  }, []);

  const handleStatusChange = (nextStatus: ShipmentStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await updateShipmentStatusAction(
        shipment.id,
        nextStatus,
        notes,
      );
      if (!res.success) {
        setError(res.error ?? "Gagal memperbarui status resi.");
        return;
      }
      setNotes("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 print:space-y-0">
      {/* Banner Resi Baru Terbit - Disembunyikan saat cetak */}
      {justCreated && (
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-emerald-700 bg-emerald-950/70 p-4 sm:flex-row sm:items-center print:hidden">
          <div>
            <div className="text-xs font-bold text-emerald-300">
              Resi {shipment.shipment_no} Berhasil Diterbitkan!
            </div>
            <p className="mt-0.5 text-xs text-emerald-200/80">
              Format label printer 100mm × 150mm (4×6 inci) siap dicetak dan
              ditempel pada paket.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
            >
              🖨️ Cetak Label Resi (100×150mm)
            </button>
            <Link
              href="/dashboard/shipments/new"
              className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-900/60"
            >
              + Buat Resi Lagi
            </Link>
          </div>
        </div>
      )}

      {/* Action Bar - Disembunyikan saat cetak */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link
          href="/dashboard/shipments"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white"
        >
          ← Kembali ke Daftar Resi
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/shipments/new"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            + Buat Resi Baru
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <span>🖨️</span>
            <span>Cetak Label Resi (100×150mm)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/70 px-4 py-3 text-xs text-red-300 print:hidden">
          {error}
        </div>
      )}

      {/* Panel Kontrol Status Gudang - Disembunyikan saat cetak */}
      {availableActions.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 print:hidden">
          <h2 className="text-sm font-semibold text-white">
            Aksi Operasional Gudang
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Status saat ini:{" "}
            <span className="font-mono font-semibold text-blue-400">
              {shipment.status}
            </span>
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor={notesId}
                className="block text-xs font-medium text-slate-300"
              >
                Catatan Operasional (Opsional)
              </label>
              <input
                id={notesId}
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Diterima di dock 2 oleh petugas shift pagi"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {availableActions.map((act) => (
                <button
                  key={act.status}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleStatusChange(act.status)}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 ${act.style}`}
                >
                  {isPending ? "Memproses..." : act.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lembar Resi / Label Thermal 100mm x 150mm (4x6 inci) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 print:w-[94mm] print:rounded-none print:border-2 print:border-black print:bg-white print:p-2 print:text-black">
        {/* Header Label & Barcode */}
        <div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start print:flex-col print:gap-1.5 print:border-black print:pb-2">
          <div className="print:w-full">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-400 print:text-[9px] print:text-black">
                DUTA EKSPEDISI • BALI ⇄ SURABAYA
              </div>
              <span className="hidden rounded border border-black px-1.5 py-0.5 font-mono text-[9px] font-bold print:inline-block">
                {shipment.originWarehouse.code} → {shipment.destWarehouse.code}
              </span>
            </div>
            <h2 className="mt-1 font-mono text-xl font-bold text-white print:mt-0.5 print:text-sm print:text-black">
              {shipment.shipment_no}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400 print:text-[8px] print:text-black">
              Terbit:{" "}
              {new Date(shipment.created_at).toLocaleString("id-ID", {
                dateStyle: "medium",
                timeStyle: "short",
              })}{" "}
              • Layanan: {shipment.price_name_snap}
            </p>
          </div>

          <div className="text-left sm:text-right print:w-full print:text-center">
            <BarcodeLabelGraphic value={shipment.barcode} showQr />
          </div>
        </div>

        {/* Status Pembayaran Resi (Tegas di Layar & Label Thermal) */}
        <div
          className={`mt-4 rounded-lg border p-3 print:mt-1.5 print:rounded-none print:border-2 print:border-black print:p-1.5 ${
            shipment.isPaid
              ? "border-emerald-700/80 bg-emerald-950/60 text-emerald-300 print:bg-white print:text-black"
              : "border-amber-600/80 bg-amber-950/60 text-amber-300 print:bg-white print:text-black"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 print:gap-1">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide print:text-[9px]">
                {shipment.isPaid
                  ? "STATUS BAYAR: SUDAH TERBAYAR (LUNAS)"
                  : "STATUS BAYAR: BELUM TERBAYAR (BAYAR SAAT AMBIL)"}
              </div>
              <div className="mt-0.5 text-[11px] opacity-90 print:text-[8px]">
                {shipment.isPaid
                  ? (shipment.paymentRecords[0]?.notes ??
                    "Ongkir telah dilunasi.")
                  : `Wajib ditagih di gudang tujuan sebesar Rp ${shipment.remainingAmount.toLocaleString("id-ID")}`}
              </div>
            </div>
            <div className="font-mono text-sm font-extrabold print:text-[10px]">
              Rp {shipment.price_nominal_snap.toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        {/* Rute Gudang */}
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 sm:grid-cols-2 print:mt-1.5 print:grid-cols-2 print:gap-1.5 print:rounded-none print:border-black print:bg-white print:p-1.5">
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400 print:text-[7px] print:text-black">
              Asal ({shipment.originWarehouse.code})
            </div>
            <div className="mt-0.5 text-xs font-bold text-white print:text-[9px] print:text-black">
              {shipment.originWarehouse.name} ({shipment.originWarehouse.city})
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400 print:text-[7px] print:text-black">
              Tujuan ({shipment.destWarehouse.code})
            </div>
            <div className="mt-0.5 text-xs font-bold text-white print:text-[9px] print:text-black">
              {shipment.destWarehouse.name} ({shipment.destWarehouse.city})
            </div>
          </div>
        </div>

        {/* Pengirim & Penerima */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 print:mt-1.5 print:grid-cols-2 print:gap-1.5">
          <div className="rounded-lg border border-slate-800 p-3.5 print:rounded-none print:border-black print:p-1.5">
            <div className="text-[10px] font-semibold uppercase text-slate-400 print:text-[7px] print:text-black">
              Pengirim
            </div>
            <div className="mt-0.5 text-xs font-bold text-white print:text-[9px] print:text-black">
              {shipment.sender.name}
            </div>
            <div className="font-mono text-[11px] text-slate-300 print:text-[8px] print:text-black">
              {shipment.sender.phone}
            </div>
            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400 print:text-[7px] print:leading-tight print:text-black">
              {shipment.sender.address}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 p-3.5 print:rounded-none print:border-black print:p-1.5">
            <div className="text-[10px] font-semibold uppercase text-slate-400 print:text-[7px] print:text-black">
              Penerima
            </div>
            <div className="mt-0.5 text-xs font-bold text-white print:text-[9px] print:text-black">
              {shipment.receiver.name}
            </div>
            <div className="font-mono text-[11px] text-slate-300 print:text-[8px] print:text-black">
              {shipment.receiver.phone}
            </div>
            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-400 print:text-[7px] print:leading-tight print:text-black">
              {shipment.receiver.address}
            </div>
          </div>
        </div>

        {/* Rincian Muatan & Biaya */}
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800 print:mt-1.5 print:rounded-none print:border-black">
          <table className="w-full text-left text-xs print:text-[8px]">
            <thead className="border-b border-slate-800 bg-slate-950/70 uppercase text-slate-400 print:border-black print:bg-white print:text-black">
              <tr>
                <th className="px-3 py-2 font-semibold print:px-1.5 print:py-1">
                  Barang
                </th>
                <th className="px-3 py-2 font-semibold print:px-1.5 print:py-1">
                  Koli
                </th>
                <th className="px-3 py-2 font-semibold print:px-1.5 print:py-1">
                  Berat / Vol
                </th>
                <th className="px-3 py-2 text-right font-semibold print:px-1.5 print:py-1">
                  Ongkir
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-slate-200 print:text-black">
                <td className="px-3 py-2.5 font-medium print:px-1.5 print:py-1">
                  {shipment.goods_description}
                </td>
                <td className="px-3 py-2.5 font-mono print:px-1.5 print:py-1">
                  {shipment.qty} Koli
                </td>
                <td className="px-3 py-2.5 font-mono print:px-1.5 print:py-1">
                  {shipment.weight} kg / {shipment.volume} m³
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400 print:px-1.5 print:py-1 print:text-black">
                  Rp {shipment.price_nominal_snap.toLocaleString("id-ID")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Kolom Tanda Tangan Ringkas - Tampil Khusus Saat Cetak Thermal */}
        <div className="mt-6 hidden grid-cols-3 gap-3 pt-2 text-center text-[8px] print:mt-2 print:grid print:pt-1">
          <div>
            <p className="font-semibold">Pengirim</p>
            <div className="mt-7 border-b border-black" />
            <p className="mt-0.5 truncate">{shipment.sender.name}</p>
          </div>
          <div>
            <p className="font-semibold">Petugas</p>
            <div className="mt-7 border-b border-black" />
            <p className="mt-0.5">Duta Ekspedisi</p>
          </div>
          <div>
            <p className="font-semibold">Penerima</p>
            <div className="mt-7 border-b border-black" />
            <p className="mt-0.5 truncate">{shipment.receiver.name}</p>
          </div>
        </div>
      </div>

      {/* Timeline Tracking & Pergerakan Gudang - Disembunyikan saat cetak */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:hidden">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white">
            Riwayat Tracking Pengiriman
          </h3>
          <div className="mt-4 space-y-4">
            {shipment.trackingEvents.length === 0 ? (
              <p className="text-xs italic text-slate-500">
                Belum ada catatan tracking.
              </p>
            ) : (
              shipment.trackingEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="border-l-2 border-blue-500 pl-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-blue-400">
                      {ev.status}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(ev.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-200">{ev.description}</p>
                  {ev.location && (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Lokasi: {ev.location}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white">
            Log Pergerakan Gudang
          </h3>
          <div className="mt-4 space-y-3">
            {shipment.warehouseMoves.length === 0 ? (
              <p className="text-xs italic text-slate-500">
                Belum ada catatan pergerakan gudang.
              </p>
            ) : (
              shipment.warehouseMoves.map((mv) => (
                <div
                  key={mv.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-200">
                      {mv.movement_type}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(mv.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-400">
                    Cabang: {mv.warehouse.name} ({mv.warehouse.city})
                  </p>
                  {mv.notes && (
                    <p className="mt-0.5 text-slate-300">{mv.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
