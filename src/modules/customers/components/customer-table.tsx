"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { CustomerStatus } from "@/generated/prisma/enums";
import { updateCustomerStatusAction } from "../customer.actions";
import type { CustomerItem } from "../customer.queries";
import { CustomerForm } from "./customer-form";

interface CustomerTableProps {
  initialCustomers: CustomerItem[];
}

const STATUS_BADGE: Record<CustomerStatus, string> = {
  ACTIVE: "bg-emerald-950 text-emerald-400 border-emerald-800",
  INACTIVE: "bg-slate-800 text-slate-300 border-slate-700",
  BLACKLISTED: "bg-red-950 text-red-400 border-red-800",
};

export function CustomerTable({ initialCustomers }: CustomerTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const searchId = useId();
  const filterId = useId();

  const filteredCustomers = initialCustomers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer: CustomerItem) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
    router.refresh();
  };

  const handleStatusChange = (id: string, nextStatus: CustomerStatus) => {
    setActionError(null);
    startTransition(async () => {
      const res = await updateCustomerStatusAction(id, nextStatus);
      if (!res.success) {
        setActionError(res.error ?? "Gagal mengubah status customer.");
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
              Cari Customer
            </label>
            <input
              id={searchId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, telepon, atau alamat..."
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
              <option value="INACTIVE">INACTIVE</option>
              <option value="BLACKLISTED">BLACKLISTED</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          + Tambah Customer
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Nama Customer</th>
                <th className="px-4 py-3">Kontak</th>
                <th className="px-4 py-3">Alamat</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Belum ada data customer yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition-colors hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {customer.name}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-200">{customer.phone}</div>
                      {customer.email && (
                        <div className="text-[11px] text-slate-400">
                          {customer.email}
                        </div>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-300">
                      {customer.address}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_BADGE[customer.status]}`}
                      >
                        {customer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(customer)}
                          className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <select
                          aria-label={`Ubah status ${customer.name}`}
                          disabled={isPending}
                          value={customer.status}
                          onChange={(e) =>
                            handleStatusChange(
                              customer.id,
                              e.target.value as CustomerStatus,
                            )
                          }
                          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                          <option value="BLACKLISTED">BLACKLISTED</option>
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

      <CustomerForm
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        customerToEdit={editingCustomer}
      />
    </div>
  );
}
