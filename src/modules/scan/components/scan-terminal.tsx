"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { CameraBarcodeScanner } from "@/components/camera-barcode-scanner";
import {
  processBarcodeScanAction,
  type ScanActionResponse,
  type ScanMode,
} from "../scan.actions";
import type { ScanLogItem } from "../scan.queries";

interface ScanTerminalProps {
  warehouses: {
    id: string;
    code: string;
    name: string;
    city: string;
  }[];
  initialLogs: ScanLogItem[];
}

const RESULT_BADGE: Record<string, string> = {
  SUCCESS: "border-emerald-800/60 bg-emerald-950/80 text-emerald-300",
  VERIFIED: "border-blue-800/60 bg-blue-950/80 text-blue-300",
  REJECTED: "border-amber-800/60 bg-amber-950/80 text-amber-300",
  NOT_FOUND: "border-red-800/60 bg-red-950/80 text-red-300",
};

export function ScanTerminal({ warehouses, initialLogs }: ScanTerminalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [scanMode, setScanMode] = useState<ScanMode>("INBOUND_ORIGIN");
  const [barcode, setBarcode] = useState("");
  const [lastResult, setLastResult] = useState<ScanActionResponse | null>(null);

  const whFieldId = useId();
  const modeFieldId = useId();
  const barcodeFieldId = useId();

  const submitScannedCode = (rawCode: string) => {
    const cleaned = rawCode.trim();
    if (!cleaned) return;

    startTransition(async () => {
      const res = await processBarcodeScanAction({
        warehouse_id: warehouseId,
        barcode: cleaned,
        scan_mode: scanMode,
      });

      setLastResult(res);
      setBarcode("");
      router.refresh();

      requestAnimationFrame(() => {
        barcodeInputRef.current?.focus();
      });
    });
  };

  const handleScanSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitScannedCode(barcode);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Terminal Pemindaian Barcode Gudang
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Gunakan alat scanner USB/Bluetooth, ketik manual, atau buka kamera
              HP untuk memindai Barcode / QR Code resi maupun koli.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <CameraBarcodeScanner
            buttonLabel="Buka Kamera HP (Scan Barcode / QR)"
            onScan={(scannedCode) => {
              submitScannedCode(scannedCode);
            }}
          />
        </div>

        <form onSubmit={handleScanSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={whFieldId}
                className="block text-xs font-medium text-slate-300"
              >
                Lokasi Gudang Operasional
              </label>
              <select
                id={whFieldId}
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} — {wh.city} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={modeFieldId}
                className="block text-xs font-medium text-slate-300"
              >
                Mode Pemindaian
              </label>
              <select
                id={modeFieldId}
                value={scanMode}
                onChange={(e) => setScanMode(e.target.value as ScanMode)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="INBOUND_ORIGIN">
                  1. Terima Barang di Gudang Asal (→ RECEIVED_AT_ORIGIN)
                </option>
                <option value="INBOUND_DEST">
                  2. Terima Bongkaran di Gudang Tujuan (→
                  ARRIVED_AT_DESTINATION)
                </option>
                <option value="VERIFY_CHECK">
                  3. Cek Fisik / Verifikasi Stok Gudang (Tanpa Ubah Status)
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <label htmlFor={barcodeFieldId} className="sr-only">
                Barcode Resi atau Koli
              </label>
              <input
                ref={barcodeInputRef}
                id={barcodeFieldId}
                type="text"
                autoComplete="off"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan barcode (contoh: DEBL-SB... atau DEBL-SB-KOLI-...)"
                className="w-full rounded-lg border-2 border-blue-700/70 bg-slate-950 px-4 py-3 font-mono text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isPending || !barcode.trim()}
              className="rounded-lg bg-blue-600 px-6 py-3 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending ? "Memproses..." : "Proses Scan"}
            </button>
          </div>
        </form>

        {lastResult && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-xs ${
              lastResult.success
                ? "border-emerald-800 bg-emerald-950/70 text-emerald-200"
                : "border-red-800 bg-red-950/70 text-red-200"
            }`}
          >
            <div className="font-semibold">
              {lastResult.success ? "SCAN BERHASIL" : "SCAN DITOLAK / GAGAL"}
              {lastResult.scannedCode ? ` • ${lastResult.scannedCode}` : ""}
            </div>
            <p className="mt-1">
              {lastResult.success ? lastResult.message : lastResult.error}
            </p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Riwayat Pemindaian Barcode Terbaru (50 Terakhir)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Waktu Scan</th>
                <th className="px-4 py-3 font-semibold">Gudang</th>
                <th className="px-4 py-3 font-semibold">Resi / Koli</th>
                <th className="px-4 py-3 font-semibold">Hasil</th>
                <th className="px-4 py-3 font-semibold">Keterangan / Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initialLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center italic text-slate-500"
                  >
                    Belum ada riwayat pemindaian barcode gudang.
                  </td>
                </tr>
              ) : (
                initialLogs.map((log) => {
                  const badgeClass =
                    RESULT_BADGE[log.scan_result] ??
                    "border-slate-700 bg-slate-800 text-slate-300";

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-[11px] text-slate-400">
                        {new Date(log.created_at).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-slate-200">
                          {log.warehouse.code}
                        </span>{" "}
                        <span className="text-slate-400">
                          ({log.warehouse.city})
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {log.shipment ? (
                          <Link
                            href={`/dashboard/shipments/${log.shipment.id}`}
                            className="font-semibold text-blue-400 hover:underline"
                          >
                            {log.shipment.shipment_no}
                          </Link>
                        ) : log.koli ? (
                          <Link
                            href="/dashboard/kolis"
                            className="font-semibold text-indigo-400 hover:underline"
                          >
                            {log.koli.koli_no}
                          </Link>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                        >
                          {log.scan_result}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {log.error_message ??
                          (log.shipment
                            ? `Status Resi: ${log.shipment.status}`
                            : log.koli
                              ? `Status Koli: ${log.koli.status}`
                              : "-")}
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
