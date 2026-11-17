"use client";

import { useId, useState, useTransition } from "react";
import { type ConfigInput, upsertSystemConfigAction } from "../config.actions";
import type { SystemConfigItem } from "../config.queries";

interface ConfigManagerProps {
  initialConfigs: SystemConfigItem[];
}

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
          Kelola parameter global sistem seperti divisor volumetrik dan aturan
          operasional.
        </p>
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
        <h2 className="text-sm font-semibold text-white mb-3">
          {editingKey
            ? `Edit Parameter: ${editingKey}`
            : "Tambah Parameter Baru"}
        </h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div>
            <label
              htmlFor={keyFieldId}
              className="block text-xs font-medium text-slate-400 mb-1"
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white uppercase placeholder-slate-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor={valueFieldId}
              className="block text-xs font-medium text-slate-400 mb-1"
            >
              Nilai (Value)
            </label>
            <input
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
              className="block text-xs font-medium text-slate-400 mb-1"
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
          <div className="sm:col-span-3 flex justify-end gap-2">
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
                  : "Tambah Parameter"}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Daftar Konfigurasi */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
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
            <thead className="bg-slate-950 uppercase tracking-wider text-slate-400 border-b border-slate-800">
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
