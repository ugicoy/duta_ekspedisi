"use client";

import { useId, useRef, useState, useTransition } from "react";
import { type ConfigInput, upsertSystemConfigAction } from "../config.actions";
import type { SystemConfigItem } from "../config.queries";

interface ConfigManagerProps {
  initialConfigs: SystemConfigItem[];
}

interface RecommendedConfigPreset {
  key: string;
  label: string;
  defaultValue: string;
  description: string;
}

const RECOMMENDED_CONFIGS: RecommendedConfigPreset[] = [
  {
    key: "COMPANY_NAME",
    label: "Nama Perusahaan",
    defaultValue: "Duta Ekspedisi",
    description:
      "Nama resmi perusahaan pada kop resi, surat jalan & halaman publik",
  },
  {
    key: "VOLUMETRIC_DIVISOR",
    label: "Divisor Berat Volumetrik (cm³)",
    defaultValue: "4000",
    description:
      "Pembagi rumus (P × L × T) / divisor untuk berat volumetrik (4000 / 6000)",
  },
  {
    key: "CS_WHATSAPP",
    label: "WhatsApp Customer Service",
    defaultValue: "6281234567890",
    description:
      "Nomor WhatsApp CS format internasional (628...) untuk kontak pelanggan",
  },
  {
    key: "WAREHOUSE_BALI_ADDRESS",
    label: "Alamat Gudang Bali (Denpasar)",
    defaultValue: "Jl. Mahendradatta / Cargo Denpasar, Bali",
    description: "Alamat lengkap drop-off & pengambilan paket cabang Bali",
  },
  {
    key: "WAREHOUSE_SBY_ADDRESS",
    label: "Alamat Gudang Surabaya",
    defaultValue: "Pergudangan Margomulyo / Perak, Surabaya",
    description: "Alamat lengkap drop-off & pengambilan paket cabang Surabaya",
  },
  {
    key: "OPERATIONAL_HOURS",
    label: "Jam Operasional Gudang",
    defaultValue: "Senin - Sabtu, 08.00 - 17.00",
    description: "Jam pelayanan penerimaan & pengambilan barang di gudang",
  },
];

export function ConfigManager({ initialConfigs }: ConfigManagerProps) {
  const [configs, setConfigs] = useState<SystemConfigItem[]>(initialConfigs);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const [keyInput, setKeyInput] = useState("");
  const [valueInput, setValueInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const valueInputRef = useRef<HTMLInputElement>(null);

  const searchId = useId();
  const keyFieldId = useId();
  const valueFieldId = useId();
  const descFieldId = useId();

  const filteredConfigs = configs.filter(
    (c) =>
      c.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleEdit = (config: SystemConfigItem) => {
    setEditingKey(config.key);
    setKeyInput(config.key);
    setValueInput(config.value);
    setDescriptionInput(config.description ?? "");
    setError(null);
    setSuccessMsg(null);
    requestAnimationFrame(() => valueInputRef.current?.focus());
  };

  const handleApplyPreset = (preset: RecommendedConfigPreset) => {
    const existing = configs.find((c) => c.key === preset.key);
    setEditingKey(existing ? existing.key : null);
    setKeyInput(preset.key);
    setValueInput(existing ? existing.value : preset.defaultValue);
    setDescriptionInput(existing?.description ?? preset.description);
    setError(null);
    setSuccessMsg(null);
    requestAnimationFrame(() => valueInputRef.current?.focus());
  };

  const handleCancel = () => {
    setEditingKey(null);
    setKeyInput("");
    setValueInput("");
    setDescriptionInput("");
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const payload: ConfigInput = {
      key: editingKey ? keyInput : keyInput.trim().toUpperCase(),
      value: valueInput.trim(),
      description:
        descriptionInput.trim() === "" ? null : descriptionInput.trim(),
    };

    startTransition(async () => {
      const result = await upsertSystemConfigAction(payload);
      if (!result.success) {
        setError(result.error ?? "Gagal menyimpan konfigurasi.");
        return;
      }

      setSuccessMsg(`Konfigurasi "${payload.key}" berhasil disimpan.`);
      const saved = result.data as SystemConfigItem;
      const updated = configs.some((c) => c.key === saved.key)
        ? configs.map((c) => (c.key === saved.key ? saved : c))
        : [...configs, saved].sort((a, b) => a.key.localeCompare(b.key));

      setConfigs(updated);
      handleCancel();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">
          Konfigurasi Sistem (System Config)
        </h1>
        <p className="text-sm text-slate-400">
          Kelola parameter global sistem seperti divisor volumetrik, identitas
          perusahaan, dan kontak cabang Bali ⇄ Surabaya.
        </p>
      </div>

      {/* Quick Setup Parameter Operasional Utama */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-white">
            Parameter Operasional Utama
          </h2>
          <p className="text-xs text-slate-400">
            Klik salah satu kartu di bawah untuk mengatur nilai parameter yang
            digunakan pada kalkulator tarif, resi, dan halaman publik.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {RECOMMENDED_CONFIGS.map((preset) => {
            const existing = configs.find((c) => c.key === preset.key);
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-left transition hover:border-blue-600/70 hover:bg-slate-950"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {preset.label}
                    </span>
                    {existing ? (
                      <span className="rounded-full border border-emerald-800/70 bg-emerald-950/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                        Tersimpan
                      </span>
                    ) : (
                      <span className="rounded-full border border-amber-800/70 bg-amber-950/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-blue-400">
                    {existing ? existing.value : preset.defaultValue}
                  </div>
                </div>
                <div className="mt-2 font-mono text-[10px] text-slate-500">
                  {preset.key}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-xs text-red-200">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/50 p-3 text-xs text-emerald-200">
          {successMsg}
        </div>
      )}

      {/* Form Tambah / Edit */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {editingKey
            ? `Edit Parameter: ${editingKey}`
            : "Tambah / Atur Parameter"}
        </h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div>
            <label
              htmlFor={keyFieldId}
              className="mb-1 block text-xs font-medium text-slate-400"
            >
              Key (UPPER_SNAKE)
            </label>
            <input
              id={keyFieldId}
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              disabled={!!editingKey}
              placeholder="CONTOH_KEY"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs uppercase text-white placeholder-slate-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor={valueFieldId}
              className="mb-1 block text-xs font-medium text-slate-400"
            >
              Nilai (Value)
            </label>
            <input
              ref={valueInputRef}
              id={valueFieldId}
              type="text"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              placeholder="Nilai parameter"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600"
            />
          </div>
          <div>
            <label
              htmlFor={descFieldId}
              className="mb-1 block text-xs font-medium text-slate-400"
            >
              Deskripsi
            </label>
            <input
              id={descFieldId}
              type="text"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Keterangan singkat"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-600"
            />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-3">
            {editingKey && (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending
                ? "Menyimpan..."
                : editingKey
                  ? "Simpan Perubahan"
                  : "Simpan Parameter"}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Daftar Konfigurasi */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="w-full sm:w-80">
            <label htmlFor={searchId} className="sr-only">
              Cari Konfigurasi
            </label>
            <input
              id={searchId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari key, nilai, atau deskripsi..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950 uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-3">
                  Key Konfigurasi
                </th>
                <th scope="col" className="px-6 py-3">
                  Nilai (Value)
                </th>
                <th scope="col" className="px-6 py-3">
                  Deskripsi
                </th>
                <th scope="col" className="px-6 py-3 text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredConfigs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Tidak ada parameter konfigurasi yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredConfigs.map((config) => (
                  <tr key={config.id} className="hover:bg-slate-800/40">
                    <td className="px-6 py-4 font-mono font-semibold text-white">
                      {config.key}
                    </td>
                    <td className="px-6 py-4 font-mono text-blue-300">
                      {config.value}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {config.description || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(config)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        Edit
                      </button>
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
