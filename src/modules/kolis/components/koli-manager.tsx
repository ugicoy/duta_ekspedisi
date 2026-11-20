"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { BarcodeLabelGraphic } from "@/components/barcode-label-graphic";
import { createKoliAction, unpackKoliAction } from "../koli.actions";
import type { KoliFormData, KoliListItem } from "../koli.queries";

interface KoliManagerProps {
  initialKolis: KoliListItem[];
  formData: KoliFormData;
}

const KOLI_STATUS_BADGE: Record<string, string> = {
  PACKED: "border-indigo-800/60 bg-indigo-950/80 text-indigo-300",
  MANIFESTED: "border-blue-800/60 bg-blue-950/80 text-blue-300",
  IN_TRANSIT: "border-amber-800/60 bg-amber-950/80 text-amber-300",
  RECEIVED: "border-cyan-800/60 bg-cyan-950/80 text-cyan-300",
  UNPACKED: "border-slate-700 bg-slate-800/80 text-slate-400",
};

export function KoliManager({ initialKolis, formData }: KoliManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState(
    formData.warehouses[0]?.id ?? "",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printKoli, setPrintKoli] = useState<KoliListItem | null>(null);

  const whFieldId = useId();

  const filteredShipments = useMemo(() => {
    return formData.eligibleShipments.filter(
      (s) => s.origin_warehouse_id === warehouseId,
    );
  }, [formData.eligibleShipments, warehouseId]);

  const handleWarehouseChange = (nextWhId: string) => {
    setWarehouseId(nextWhId);
    setSelectedIds([]);
  };

  const toggleShipment = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleCreateKoli = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (selectedIds.length === 0) {
      setError("Pilih minimal 1 resi untuk digabungkan ke dalam koli.");
      return;
    }

    startTransition(async () => {
      const res = await createKoliAction({
        origin_warehouse_id: warehouseId,
        shipment_ids: selectedIds,
      });

      if (!res.success) {
        setError(res.error ?? "Gagal membuat koli.");
        return;
      }

      setSelectedIds([]);
      router.refresh();
    });
  };

  const handleUnpack = (koliId: string) => {
    setError(null);
    startTransition(async () => {
      const res = await unpackKoliAction(koliId);
      if (!res.success) {
        setError(res.error ?? "Gagal membongkar koli.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Preview Stiker Koli (100x150mm) */}
      {printKoli && (
        <div className="rounded-xl border-2 border-indigo-600 bg-slate-900 p-5 print:w-[94mm] print:rounded-none print:border-2 print:border-black print:bg-white print:p-2.5 print:text-black">
          <div className="mb-3 flex items-center justify-between print:hidden">
            <span className="text-xs font-bold text-indigo-300">
              Preview Label Stiker Koli (100mm × 150mm)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                🖨️ Cetak Label Koli
              </button>
              <button
                type="button"
                onClick={() => setPrintKoli(null)}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                Tutup
              </button>
            </div>
          </div>

          <div className="border-b border-slate-700 pb-2 print:border-black">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 print:text-black">
              DUTA EKSPEDISI • LABEL KOLI KONSOLIDASI
            </div>
            <div className="mt-1 font-mono text-base font-extrabold text-white print:text-black">
              {printKoli.koli_no}
            </div>
          </div>

          <div className="mt-3 text-center">
            <BarcodeLabelGraphic value={printKoli.barcode} showQr />
          </div>

          <div className="mt-3 rounded border border-slate-700 p-2 text-xs print:border-black">
            <div className="font-semibold">
              Muatan: {printKoli.items.length} Resi • {printKoli.totalQty} Koli
              • {printKoli.totalWeight.toFixed(1)} kg
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-300 print:text-black">
              Resi:{" "}
              {printKoli.items.map((i) => i.shipment.shipment_no).join(", ")}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 print:hidden">
        <h2 className="text-sm font-semibold text-white">
          Buat Konsolidasi Koli Baru
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Gabungkan beberapa resi berstatus{" "}
          <span className="font-mono text-blue-400">RECEIVED_AT_ORIGIN</span>{" "}
          pada cabang yang sama ke dalam satu wadah/karung koli ber-barcode.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-950/70 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateKoli} className="mt-4 space-y-4">
          <div className="sm:max-w-xs">
            <label
              htmlFor={whFieldId}
              className="block text-xs font-medium text-slate-300"
            >
              Gudang Asal Konsolidasi
            </label>
            <select
              id={whFieldId}
              value={warehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {formData.warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="mb-2 text-xs font-medium text-slate-300">
              Resi Siap Dikonsolidasi di Cabang Ini ({filteredShipments.length}{" "}
              tersedia)
            </div>

            {filteredShipments.length === 0 ? (
              <p className="py-3 text-xs italic text-slate-500">
                Tidak ada resi RECEIVED_AT_ORIGIN yang belum masuk koli pada
                gudang ini.
              </p>
            ) : (
              <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                {filteredShipments.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-xs transition ${
                        checked
                          ? "border-indigo-600 bg-indigo-950/40 text-white"
                          : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleShipment(s.id)}
                          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950"
                        />
                        <div>
                          <span className="font-mono font-semibold text-blue-400">
                            {s.shipment_no}
                          </span>{" "}
                          •{" "}
                          <span className="font-medium text-white">
                            {s.sender.name} → {s.receiver.name}
                          </span>
                          <div className="text-[11px] text-slate-400">
                            {s.goods_description} ({s.qty} koli • {s.weight} kg)
                            - Tujuan: {s.destWarehouse.city}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {s.originWarehouse.code} → {s.destWarehouse.code}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || selectedIds.length === 0}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isPending
                ? "Membuat Koli..."
                : `Terbitkan Koli Konsolidasi (${selectedIds.length} Resi)`}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">No. Koli & Barcode</th>
                <th className="px-4 py-3 font-semibold">Isi Resi</th>
                <th className="px-4 py-3 font-semibold">Total Muatan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initialKolis.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center italic text-slate-500"
                  >
                    Belum ada data konsolidasi koli.
                  </td>
                </tr>
              ) : (
                initialKolis.map((koli) => {
                  const badgeClass =
                    KOLI_STATUS_BADGE[koli.status] ??
                    "border-slate-700 bg-slate-800 text-slate-300";
                  const canUnpack =
                    koli.status === "PACKED" || koli.status === "RECEIVED";

                  return (
                    <tr key={koli.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-indigo-400">
                          {koli.koli_no}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {koli.barcode}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {koli.items.length === 0 ? (
                          <span className="italic text-slate-500">
                            Sudah dibongkar (released)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {koli.items.map((item) => (
                              <Link
                                key={item.id}
                                href={`/dashboard/shipments/${item.shipment.id}`}
                                className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-blue-400 hover:border-blue-500"
                              >
                                {item.shipment.shipment_no}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {koli.items.length} resi • {koli.totalQty} koli •{" "}
                        {koli.totalWeight.toFixed(1)} kg
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                        >
                          {koli.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPrintKoli(koli)}
                            className="rounded border border-indigo-700/70 bg-indigo-950/60 px-2.5 py-1 text-[11px] font-medium text-indigo-300 hover:bg-indigo-900/60"
                          >
                            🖨️ Label
                          </button>

                          {canUnpack ? (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleUnpack(koli.id)}
                              className="rounded border border-amber-800/60 bg-amber-950/60 px-3 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-900/60 disabled:opacity-50"
                            >
                              Bongkar (Unpack)
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              Selesai
                            </span>
                          )}
                        </div>
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
