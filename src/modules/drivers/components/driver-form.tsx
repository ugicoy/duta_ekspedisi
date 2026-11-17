"use client";

import { useEffect, useId, useState, useTransition } from "react";
import {
  createDriverAction,
  type DriverInput,
  updateDriverAction,
} from "../driver.actions";
import type { DriverItem, DriverUserOption } from "../driver.queries";

interface DriverFormProps {
  isOpen: boolean;
  onClose: () => void;
  driverToEdit?: DriverItem | null;
  availableUsers: DriverUserOption[];
}

export function DriverForm({
  isOpen,
  onClose,
  driverToEdit,
  availableUsers,
}: DriverFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [driverCode, setDriverCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [userId, setUserId] = useState<string>("");

  const codeId = useId();
  const nameId = useId();
  const phoneId = useId();
  const licenseId = useId();
  const userIdInput = useId();

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDriverCode(driverToEdit?.driver_code ?? "");
      setName(driverToEdit?.name ?? "");
      setPhone(driverToEdit?.phone ?? "");
      setLicenseNumber(driverToEdit?.license_number ?? "");
      setUserId(driverToEdit?.user_id ?? "");
    }
  }, [isOpen, driverToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const payload: DriverInput = {
      driver_code: driverCode.trim(),
      name: name.trim(),
      phone: phone.trim(),
      license_number: licenseNumber.trim().toUpperCase(),
      user_id: userId.trim() === "" ? null : userId,
    };

    startTransition(async () => {
      const result = driverToEdit
        ? await updateDriverAction(driverToEdit.id, payload)
        : await createDriverAction(payload);

      if (!result.success) {
        setError(
          result.error ?? "Terjadi kesalahan saat menyimpan data driver.",
        );
        return;
      }

      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-semibold text-white">
            {driverToEdit ? "Edit Driver" : "Tambah Driver Baru"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor={codeId}
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Kode Driver *
            </label>
            <input
              id={codeId}
              type="text"
              required
              value={driverCode}
              onChange={(e) => setDriverCode(e.target.value)}
              placeholder="Contoh: DRV-001"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={nameId}
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Nama Lengkap Driver *
            </label>
            <input
              id={nameId}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={phoneId}
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                No. Telepon / WhatsApp *
              </label>
              <input
                id={phoneId}
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={licenseId}
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Nomor SIM *
              </label>
              <input
                id={licenseId}
                type="text"
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="Contoh: B1-12345678"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={userIdInput}
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Penautan Akun Login (User Role DRIVER)
            </label>
            <select
              id={userIdInput}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">
                -- Tanpa Akun Login (Hanya Data Master) --
              </option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name} ({user.username})
                  {user.email ? ` - ${user.email}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              Hanya user dengan role DRIVER aktif yang dapat ditautkan.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending ? "Menyimpan..." : "Simpan Driver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
