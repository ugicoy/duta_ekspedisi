"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  createPricingTypeAction,
  togglePricingTypeStatusAction,
  updatePricingTypeAction,
} from "../tariff.actions";
import type { PricingTypeItem } from "../tariff.queries";

interface PricingTypeSectionProps {
  initialPricingTypes: PricingTypeItem[];
}

export function PricingTypeSection({
  initialPricingTypes,
}: PricingTypeSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const nameInputId = useId();
  const codeInputId = useId();

  const handleReset = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setError(null);
  };

  const handleEdit = (item: PricingTypeItem) => {
    setEditingId(item.id);
    setName(item.name);
    setCode(item.code);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updatePricingTypeAction(editingId, { name, code })
        : await createPricingTypeAction({ name, code });

      if (!res.success) {
        setError(res.error ?? "Gagal menyimpan jenis tarif.");
        return;
      }
      handleReset();
      router.refresh();
    });
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await togglePricingTypeStatusAction(id, !currentStatus);
      if (!res.success) {
        setError(res.error ?? "Gagal mengubah status jenis tarif.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-white">
          {editingId ? "Edit Jenis Tarif" : "Tambah Jenis Tarif Baru"}
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          Kelola jenis tarif (contoh: Customer, B2B) secara dinamis.
        </p>
        {error && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end"
        >
          <div>
            <label
              htmlFor={nameInputId}
              className="block text-xs font-medium text-slate-300"
            >
              Nama Jenis Tarif
            </label>
            <input
              id={nameInputId}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Korporat B2B"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor={codeInputId}
              className="block text-xs font-medium text-slate-300"
            >
              Kode Tarif
            </label>
            <input
              id={codeInputId}
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Contoh: B2B"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white uppercase placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {editingId ? "Simpan Perubahan" : "Tambah Tarif"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
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
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Kode</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initialPricingTypes.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center text-slate-500 italic"
                  >
                    Belum ada data jenis tarif.
                  </td>
                </tr>
              ) : (
                initialPricingTypes.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-white">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 font-mono">{item.code}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${item.is_active ? "border-green-800/50 bg-green-950/80 text-green-400" : "border-red-800/50 bg-red-950/80 text-red-400"}`}
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
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium disabled:opacity-50 ${item.is_active ? "border border-red-800/50 bg-red-950/50 text-red-400 hover:bg-red-900/50" : "border border-green-800/50 bg-green-950/50 text-green-400 hover:bg-green-900/50"}`}
                        >
                          {item.is_active ? "Nonaktifkan" : "Aktifkan"}
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
