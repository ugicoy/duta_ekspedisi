"use client";

import { useId, useState, useTransition } from "react";
import { toggleDriverStatusAction } from "../driver.actions";
import type { DriverItem, DriverUserOption } from "../driver.queries";
import { DriverForm } from "./driver-form";

interface DriverTableProps {
  initialDrivers: DriverItem[];
  availableUsers: DriverUserOption[];
}

export function DriverTable({
  initialDrivers,
  availableUsers,
}: DriverTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [driverToEdit, setDriverToEdit] = useState<DriverItem | null>(null);

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const searchId = useId();
  const statusId = useId();

  const filteredDrivers = initialDrivers.filter((driver) => {
    const matchesSearch =
      driver.driver_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.license_number.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL"
        ? true
        : statusFilter === "ACTIVE"
          ? driver.is_active
          : !driver.is_active;

    return matchesSearch && matchesStatus;
  });

  const handleOpenCreate = () => {
    setDriverToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (driver: DriverItem) => {
    setDriverToEdit(driver);
    setIsModalOpen(true);
  };

  const handleToggleStatus = (id: string, currentStatus: boolean) => {
    setActionError(null);
    startTransition(async () => {
      const result = await toggleDriverStatusAction(id, !currentStatus);
      if (!result.success) {
        setActionError(result.error ?? "Gagal mengubah status driver.");
      }
    });
  };
  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-xl border border-red-800 bg-red-950/60 p-4 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-72">
            <label htmlFor={searchId} className="sr-only">
              Cari Supir
            </label>
            <input
              id={searchId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode, nama, telp, atau SIM..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="w-full sm:w-48">
            <label htmlFor={statusId} className="sr-only">
              Filter Status
            </label>
            <select
              id={statusId}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="ALL">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none"
        >
          + Tambah Supir
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase text-slate-400">
              <tr>
                <th scope="col" className="px-6 py-4">
                  Kode & Nama Supir
                </th>
                <th scope="col" className="px-6 py-4">
                  Nomor Telepon
                </th>
                <th scope="col" className="px-6 py-4">
                  Nomor SIM
                </th>
                <th scope="col" className="px-6 py-4">
                  Akun Login Tertaut
                </th>
                <th scope="col" className="px-6 py-4">
                  Status
                </th>
                <th scope="col" className="px-6 py-4 text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Tidak ada data supir yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">
                        {driver.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {driver.driver_code}
                      </div>
                    </td>
                    <td className="px-6 py-4">{driver.phone}</td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {driver.license_number}
                    </td>
                    <td className="px-6 py-4">
                      {driver.user ? (
                        <div>
                          <div className="text-white">
                            {driver.user.full_name}
                          </div>
                          <div className="text-xs text-slate-400">
                            @{driver.user.username}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          Tidak ada akun tertaut
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          driver.is_active
                            ? "bg-green-950/80 text-green-400 border border-green-800/50"
                            : "bg-red-950/80 text-red-400 border border-red-800/50"
                        }`}
                      >
                        {driver.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(driver)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            handleToggleStatus(driver.id, driver.is_active)
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                            driver.is_active
                              ? "bg-red-950/50 text-red-400 border border-red-800/50 hover:bg-red-900/50"
                              : "bg-green-950/50 text-green-400 border border-green-800/50 hover:bg-green-900/50"
                          }`}
                        >
                          {driver.is_active ? "Nonaktifkan" : "Aktifkan"}
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

      <DriverForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        driverToEdit={driverToEdit}
        availableUsers={availableUsers}
      />
    </div>
  );
}
