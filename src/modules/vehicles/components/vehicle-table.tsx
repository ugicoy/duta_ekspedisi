"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { VehicleStatus } from "@/generated/prisma/enums";
import { updateVehicleStatusAction } from "../vehicle.actions";
import type { VehicleItem } from "../vehicle.queries";
import { VehicleForm } from "./vehicle-form";

interface VehicleTableProps {
  initialVehicles: VehicleItem[];
}

const STATUS_BADGE: Record<VehicleStatus, string> = {
  ACTIVE: "bg-emerald-950 text-emerald-400 border-emerald-800",
  MAINTENANCE: "bg-amber-950 text-amber-400 border-amber-800",
  INACTIVE: "bg-slate-800 text-slate-300 border-slate-700",
};

export function VehicleTable({ initialVehicles }: VehicleTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleItem | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const searchId = useId();
  const filterId = useId();

  const filteredVehicles = initialVehicles.filter((v) => {
    const keyword = search.toLowerCase();
    const matchesSearch =
      v.vehicle_code.toLowerCase().includes(keyword) ||
      v.plate_number.toLowerCase().includes(keyword) ||
      v.vehicle_type.toLowerCase().includes(keyword);

    const matchesStatus =
      statusFilter === "ALL" || v.operational_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenCreate = () => {
    setEditingVehicle(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vehicle: VehicleItem) => {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingVehicle(null);
    router.refresh();
  };

  const handleStatusChange = (id: string, nextStatus: VehicleStatus) => {
    setActionError(null);
    startTransition(async () => {
      const res = await updateVehicleStatusAction(id, nextStatus);
      if (!res.success) {
        setActionError(res.error ?? "Gagal mengubah status kendaraan.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-xs text-red-300">
          {actionError}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:max-w-xs">
            <label htmlFor={searchId} className="sr-only">
              Cari Kendaraan
            </label>
            <input
              id={searchId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode, plat nomor, atau tipe..."
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={filterId} className="text-xs text-slate-400">
              Status:
            </label>
            <select
              id={filterId}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          + Tambah Kendaraan
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Kode & Plat Nomor</th>
                <th className="px-4 py-3">Tipe Armada</th>
                <th className="px-4 py-3">Kapasitas Muatan</th>
                <th className="px-4 py-3">Status Operasional</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Belum ada data kendaraan yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className="transition-colors hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">
                        {vehicle.plate_number}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {vehicle.vehicle_code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {vehicle.vehicle_type}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">
                        {Number(vehicle.capacity_weight).toLocaleString(
                          "id-ID",
                        )}{" "}
                        Kg
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {Number(vehicle.capacity_volume).toLocaleString(
                          "id-ID",
                        )}{" "}
                        m³
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[vehicle.operational_status]}`}
                      >
                        {vehicle.operational_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(vehicle)}
                          className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <select
                          aria-label={`Ubah status ${vehicle.plate_number}`}
                          disabled={isPending}
                          value={vehicle.operational_status}
                          onChange={(e) =>
                            handleStatusChange(
                              vehicle.id,
                              e.target.value as VehicleStatus,
                            )
                          }
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="MAINTENANCE">MAINTENANCE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VehicleForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        vehicleToEdit={editingVehicle}
      />
    </div>
  );
}
