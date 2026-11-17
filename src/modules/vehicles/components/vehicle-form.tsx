"use client";

import { useEffect, useId, useState, useTransition } from "react";
import type { VehicleStatus } from "@/generated/prisma/enums";
import {
  createVehicleAction,
  updateVehicleAction,
  type VehicleInput,
} from "../vehicle.actions";
import type { VehicleItem } from "../vehicle.queries";

interface VehicleFormProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleToEdit?: VehicleItem | null;
}

export function VehicleForm({
  isOpen,
  onClose,
  vehicleToEdit,
}: VehicleFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [vehicleCode, setVehicleCode] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [capacityWeight, setCapacityWeight] = useState("");
  const [capacityVolume, setCapacityVolume] = useState("");
  const [operationalStatus, setOperationalStatus] =
    useState<VehicleStatus>("ACTIVE");

  const codeId = useId();
  const plateId = useId();
  const typeId = useId();
  const weightId = useId();
  const volumeId = useId();
  const statusId = useId();

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setVehicleCode(vehicleToEdit?.vehicle_code ?? "");
      setPlateNumber(vehicleToEdit?.plate_number ?? "");
      setVehicleType(vehicleToEdit?.vehicle_type ?? "");
      setCapacityWeight(
        vehicleToEdit ? String(vehicleToEdit.capacity_weight) : "",
      );
      setCapacityVolume(
        vehicleToEdit ? String(vehicleToEdit.capacity_volume) : "",
      );
      setOperationalStatus(vehicleToEdit?.operational_status ?? "ACTIVE");
    }
  }, [isOpen, vehicleToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const payload: VehicleInput = {
      vehicle_code: vehicleCode.trim(),
      plate_number: plateNumber.trim().toUpperCase(),
      vehicle_type: vehicleType.trim(),
      capacity_weight: Number(capacityWeight),
      capacity_volume: Number(capacityVolume),
      operational_status: operationalStatus,
    };

    startTransition(async () => {
      const result = vehicleToEdit
        ? await updateVehicleAction(vehicleToEdit.id, payload)
        : await createVehicleAction(payload);

      if (!result.success) {
        setError(result.error ?? "Terjadi kesalahan saat menyimpan kendaraan.");
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
            {vehicleToEdit ? "Edit Kendaraan" : "Tambah Kendaraan Baru"}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={codeId}
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Kode Kendaraan *
              </label>
              <input
                id={codeId}
                type="text"
                required
                value={vehicleCode}
                onChange={(e) => setVehicleCode(e.target.value)}
                placeholder="Contoh: TRK-BL-01"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={plateId}
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Nomor Plat *
              </label>
              <input
                id={plateId}
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="Contoh: DK 8812 AB"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm uppercase text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={typeId}
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Tipe / Jenis Armada *
            </label>
            <input
              id={typeId}
              type="text"
              required
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder="Contoh: CDD Box / Fuso Wingbox / Pickup L300"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={weightId}
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Kapasitas Berat (Kg) *
              </label>
              <input
                id={weightId}
                type="number"
                step="0.01"
                min="1"
                required
                value={capacityWeight}
                onChange={(e) => setCapacityWeight(e.target.value)}
                placeholder="Contoh: 4000"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={volumeId}
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Kapasitas Volume (m³) *
              </label>
              <input
                id={volumeId}
                type="number"
                step="0.01"
                min="0.1"
                required
                value={capacityVolume}
                onChange={(e) => setCapacityVolume(e.target.value)}
                placeholder="Contoh: 18.5"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={statusId}
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Status Operasional *
            </label>
            <select
              id={statusId}
              value={operationalStatus}
              onChange={(e) =>
                setOperationalStatus(e.target.value as VehicleStatus)
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="ACTIVE">ACTIVE (Siap Operasi)</option>
              <option value="MAINTENANCE">
                MAINTENANCE (Perawatan / Bengkel)
              </option>
              <option value="INACTIVE">INACTIVE (Nonaktif)</option>
            </select>
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
              {isPending ? "Menyimpan..." : "Simpan Kendaraan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
