"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  createTariffReferenceAction,
  deleteTariffReferenceAction,
  toggleTariffReferenceStatusAction,
  updateTariffReferenceAction,
} from "../tariff.actions";
import type {
  PricingTypeItem,
  TariffReferenceItem,
  WarehouseCityOption,
} from "../tariff.queries";

interface TariffReferenceSectionProps {
  initialTariffs: TariffReferenceItem[];
  pricingTypes: PricingTypeItem[];
  warehouses: WarehouseCityOption[];
}

export function TariffReferenceSection({
  initialTariffs,
  pricingTypes,
  warehouses,
}: TariffReferenceSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const defaultOriginCity = warehouses[0]?.city ?? "Denpasar";
  const defaultDestCity =
    warehouses.find((w) => w.city !== defaultOriginCity)?.city ??
    warehouses[1]?.city ??
    "Surabaya";

  const [originCity, setOriginCity] = useState(defaultOriginCity);
  const [destCity, setDestCity] = useState(defaultDestCity);
  const [pricingTypeId, setPricingTypeId] = useState(pricingTypes[0]?.id ?? "");
  const [itemType, setItemType] = useState("General Cargo");
  const [ratePerKg, setRatePerKg] = useState("5000");
  const [ratePerCbm, setRatePerCbm] = useState("500000");
  const [minWeight, setMinWeight] = useState("1.0");
  const [minVolume, setMinVolume] = useState("1.0");
  const [minFee, setMinFee] = useState("50000");

  const originId = useId();
  const destId = useId();
  const pricingTypeIdField = useId();
  const itemTypeId = useId();
  const rateKgId = useId();
  const rateCbmId = useId();
  const minWeightId = useId();
  const minVolId = useId();
  const minFeeId = useId();

  const warehouseCities = new Set(warehouses.map((w) => w.city));

  const handleReset = () => {
    setEditingId(null);
    setOriginCity(defaultOriginCity);
    setDestCity(defaultDestCity);
    setPricingTypeId(pricingTypes[0]?.id ?? "");
    setItemType("General Cargo");
    setRatePerKg("5000");
    setRatePerCbm("500000");
    setMinWeight("1.0");
    setMinVolume("1.0");
    setMinFee("50000");
    setError(null);
  };

  const handleEdit = (item: TariffReferenceItem) => {
    setEditingId(item.id);
    setOriginCity(item.origin_city);
    setDestCity(item.dest_city);
    setPricingTypeId(item.pricing_type_id);
    setItemType(item.item_type);
    setRatePerKg(item.rate_per_kg.toString());
    setRatePerCbm(item.rate_per_cbm.toString());
    setMinWeight(item.min_weight.toString());
    setMinVolume(item.min_volume.toString());
    setMinFee(item.min_fee.toString());
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        origin_city: originCity,
        dest_city: destCity,
        pricing_type_id: pricingTypeId,
        item_type: itemType,
        rate_per_kg: Number(ratePerKg),
        rate_per_cbm: Number(ratePerCbm),
        min_weight: Number(minWeight),
        min_volume: Number(minVolume),
        min_fee: Number(minFee),
      };

      const res = editingId
        ? await updateTariffReferenceAction(editingId, payload)
        : await createTariffReferenceAction(payload);

      if (!res.success) {
        setError(res.error ?? "Gagal menyimpan referensi tarif.");
        return;
      }
      handleReset();
      router.refresh();
    });
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleTariffReferenceStatusAction(id, !currentStatus);
      if (!res.success) {
        setError(res.error ?? "Gagal mengubah status referensi tarif.");
        return;
      }
      router.refresh();
    });
  };

  const handleDelete = (item: TariffReferenceItem) => {
    const confirmed = window.confirm(
      `Hapus tarif rute ${item.origin_city} → ${item.dest_city} (${item.pricing_type?.name ?? "Tarif"})?`,
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const res = await deleteTariffReferenceAction(item.id);
      if (!res.success) {
        setError(res.error ?? "Gagal menghapus referensi tarif.");
        return;
      }
      if (editingId === item.id) {
        handleReset();
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-white">
          {editingId ? "Edit Tarif Rute" : "Tambah Tarif Rute Baru"}
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Kota asal dan tujuan disinkronkan otomatis dengan Master Warehouse
          untuk rute Bali ⇄ Surabaya.
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label
                htmlFor={originId}
                className="block text-xs font-medium text-slate-300"
              >
                Kota Asal (Warehouse)
              </label>
              <select
                id={originId}
                required
                value={originCity}
                onChange={(e) => setOriginCity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              >
                {!warehouseCities.has(originCity) && originCity !== "" && (
                  <option value={originCity}>
                    {originCity} (Data Lama — Pilih Gudang)
                  </option>
                )}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.city}>
                    {w.name} ({w.city})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={destId}
                className="block text-xs font-medium text-slate-300"
              >
                Kota Tujuan (Warehouse)
              </label>
              <select
                id={destId}
                required
                value={destCity}
                onChange={(e) => setDestCity(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              >
                {!warehouseCities.has(destCity) && destCity !== "" && (
                  <option value={destCity}>
                    {destCity} (Data Lama — Pilih Gudang)
                  </option>
                )}
                {warehouses.map((w) => (
                  <option key={w.id} value={w.city}>
                    {w.name} ({w.city})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={pricingTypeIdField}
                className="block text-xs font-medium text-slate-300"
              >
                Jenis Tarif
              </label>
              <select
                id={pricingTypeIdField}
                required
                value={pricingTypeId}
                onChange={(e) => setPricingTypeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              >
                {pricingTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name} ({pt.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={itemTypeId}
                className="block text-xs font-medium text-slate-300"
              >
                Tipe Barang
              </label>
              <input
                id={itemTypeId}
                type="text"
                required
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <div>
              <label
                htmlFor={rateKgId}
                className="block text-xs font-medium text-slate-300"
              >
                Tarif / Kg (Rp)
              </label>
              <input
                id={rateKgId}
                type="number"
                step="any"
                required
                value={ratePerKg}
                onChange={(e) => setRatePerKg(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label
                htmlFor={rateCbmId}
                className="block text-xs font-medium text-slate-300"
              >
                Tarif / CBM (Rp)
              </label>
              <input
                id={rateCbmId}
                type="number"
                step="any"
                required
                value={ratePerCbm}
                onChange={(e) => setRatePerCbm(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label
                htmlFor={minWeightId}
                className="block text-xs font-medium text-slate-300"
              >
                Min Berat (Kg)
              </label>
              <input
                id={minWeightId}
                type="number"
                step="any"
                required
                value={minWeight}
                onChange={(e) => setMinWeight(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label
                htmlFor={minVolId}
                className="block text-xs font-medium text-slate-300"
              >
                Min Volume (m³)
              </label>
              <input
                id={minVolId}
                type="number"
                step="any"
                required
                value={minVolume}
                onChange={(e) => setMinVolume(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label
                htmlFor={minFeeId}
                className="block text-xs font-medium text-slate-300"
              >
                Biaya Min (Rp)
              </label>
              <input
                id={minFeeId}
                type="number"
                step="any"
                required
                value={minFee}
                onChange={(e) => setMinFee(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending
                ? "Menyimpan..."
                : editingId
                  ? "Perbarui Tarif"
                  : "Simpan Tarif"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Rute</th>
                <th className="px-4 py-3 font-semibold">Jenis Tarif</th>
                <th className="px-4 py-3 font-semibold">Tipe Barang</th>
                <th className="px-4 py-3 font-semibold">Tarif / Kg</th>
                <th className="px-4 py-3 font-semibold">Tarif / CBM</th>
                <th className="px-4 py-3 font-semibold">Min (Kg/m³/Rp)</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initialTariffs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center italic text-slate-500"
                  >
                    Belum ada data referensi tarif rute.
                  </td>
                </tr>
              ) : (
                initialTariffs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-white">
                      {item.origin_city} → {item.dest_city}
                    </td>
                    <td className="px-4 py-3">
                      {item.pricing_type?.name ?? item.pricing_type_id}
                    </td>
                    <td className="px-4 py-3">{item.item_type}</td>
                    <td className="px-4 py-3 font-mono">
                      Rp {item.rate_per_kg.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      Rp {item.rate_per_cbm.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {item.min_weight}kg / {item.min_volume}m³ / Rp{" "}
                      {item.min_fee.toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          item.is_active
                            ? "border-green-800/50 bg-green-950/80 text-green-400"
                            : "border-red-800/50 bg-red-950/80 text-red-400"
                        }`}
                      >
                        {item.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleToggle(item.id, item.is_active)}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-50 ${
                            item.is_active
                              ? "border border-amber-800/50 bg-amber-950/50 text-amber-300 hover:bg-amber-900/50"
                              : "border border-green-800/50 bg-green-950/50 text-green-400 hover:bg-green-900/50"
                          }`}
                        >
                          {item.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDelete(item)}
                          className="rounded-md border border-red-800/60 bg-red-950/60 px-2.5 py-1 text-[11px] font-medium text-red-300 hover:bg-red-900/60 disabled:opacity-50"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
