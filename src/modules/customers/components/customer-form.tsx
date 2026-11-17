"use client";

import { useEffect, useId, useState, useTransition } from "react";
import type { CustomerStatus } from "@/generated/prisma/enums";
import {
  type CustomerInput,
  createCustomerAction,
  updateCustomerAction,
} from "../customer.actions";
import type { CustomerItem } from "../customer.queries";

interface CustomerFormProps {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: CustomerItem | null;
}

export function CustomerForm({
  isOpen,
  onClose,
  customerToEdit,
}: CustomerFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<CustomerStatus>("ACTIVE");

  const nameId = useId();
  const phoneId = useId();
  const addressId = useId();
  const emailId = useId();
  const statusId = useId();

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setName(customerToEdit?.name ?? "");
      setPhone(customerToEdit?.phone ?? "");
      setAddress(customerToEdit?.address ?? "");
      setEmail(customerToEdit?.email ?? "");
      setStatus(customerToEdit?.status ?? "ACTIVE");
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const payload: CustomerInput = {
      name,
      phone,
      address,
      email,
      status,
    };

    startTransition(async () => {
      const result = customerToEdit
        ? await updateCustomerAction(customerToEdit.id, payload)
        : await createCustomerAction(payload);

      if (!result.success) {
        setError(result.error ?? "Terjadi kesalahan saat menyimpan data.");
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
            {customerToEdit ? "Edit Customer" : "Tambah Customer Baru"}
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
              htmlFor={nameId}
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Nama Customer / Perusahaan *
            </label>
            <input
              id={nameId}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: PT Bali Maju Jaya"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={phoneId}
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Nomor Telepon / WhatsApp *
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
              htmlFor={addressId}
              className="mb-1 block text-xs font-medium text-slate-300"
            >
              Alamat Lengkap *
            </label>
            <textarea
              id={addressId}
              required
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Alamat penjemputan atau pengiriman..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={emailId}
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Email (Opsional)
              </label>
              <input
                id={emailId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@perusahaan.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor={statusId}
                className="mb-1 block text-xs font-medium text-slate-300"
              >
                Status Customer *
              </label>
              <select
                id={statusId}
                value={status}
                onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="BLACKLISTED">BLACKLISTED</option>
              </select>
            </div>
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
              {isPending ? "Menyimpan..." : "Simpan Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
