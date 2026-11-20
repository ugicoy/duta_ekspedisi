"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  createUserAction,
  toggleUserStatusAction,
  updateUserAction,
} from "../user.actions";
import type { ManagedUserItem, UsersPageData } from "../user.queries";

interface UserManagerProps {
  data: UsersPageData;
}

const ROLE_BADGE_STYLE: Record<string, string> = {
  OWNER: "border-purple-700/60 bg-purple-950/80 text-purple-300",
  SUPER_ADMIN: "border-rose-700/60 bg-rose-950/80 text-rose-300",
  MANAGER: "border-amber-700/60 bg-amber-950/80 text-amber-300",
  ADMIN: "border-blue-700/60 bg-blue-950/80 text-blue-300",
  FINANCE: "border-emerald-700/60 bg-emerald-950/80 text-emerald-300",
  WAREHOUSE_STAFF: "border-cyan-700/60 bg-cyan-950/80 text-cyan-300",
  DRIVER: "border-indigo-700/60 bg-indigo-950/80 text-indigo-300",
};

export function UserManager({ data }: UserManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // State Form Buat User Baru
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>(
    data.availableWarehouses.map((w) => w.id),
  );

  // State Edit User
  const [editingUser, setEditingUser] = useState<ManagedUserItem | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);
  const [editWarehouseIds, setEditWarehouseIds] = useState<string[]>([]);

  const usernameFieldId = useId();
  const fullNameFieldId = useId();
  const passwordFieldId = useId();
  const emailFieldId = useId();
  const phoneFieldId = useId();

  const editNameFieldId = useId();
  const editEmailFieldId = useId();
  const editPhoneFieldId = useId();
  const editPassFieldId = useId();

  const toggleIdInList = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const isRoleRestricted = (roleName: string) =>
    !data.canManagePrivilegedRoles &&
    (roleName === "OWNER" || roleName === "SUPER_ADMIN");

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (selectedRoleIds.length === 0) {
      setError("Pilih minimal 1 role untuk akun user baru.");
      return;
    }

    startTransition(async () => {
      const res = await createUserAction({
        username,
        full_name: fullName,
        password,
        email,
        phone,
        role_ids: selectedRoleIds,
        warehouse_ids: selectedWarehouseIds,
      });

      if (!res.success) {
        setError(res.error ?? "Gagal membuat user baru.");
        return;
      }

      setSuccessMsg(`Akun "${username.trim().toLowerCase()}" berhasil dibuat.`);
      setUsername("");
      setFullName("");
      setPassword("");
      setEmail("");
      setPhone("");
      setSelectedRoleIds([]);
      router.refresh();
    });
  };

  const openEditPanel = (user: ManagedUserItem) => {
    setError(null);
    setSuccessMsg(null);
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditEmail(user.email ?? "");
    setEditPhone(user.phone ?? "");
    setEditNewPassword("");
    setEditIsActive(user.is_active);
    setEditRoleIds(user.roles.map((r) => r.id));
    setEditWarehouseIds(user.warehouses.map((w) => w.id));
  };

  const handleUpdateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    setError(null);
    setSuccessMsg(null);

    if (editRoleIds.length === 0) {
      setError("User wajib memiliki minimal 1 role.");
      return;
    }

    startTransition(async () => {
      const res = await updateUserAction({
        user_id: editingUser.id,
        full_name: editFullName,
        email: editEmail,
        phone: editPhone,
        new_password: editNewPassword,
        is_active: editIsActive,
        role_ids: editRoleIds,
        warehouse_ids: editWarehouseIds,
      });

      if (!res.success) {
        setError(res.error ?? "Gagal menyimpan perubahan user.");
        return;
      }

      setSuccessMsg(`Data user "${editingUser.username}" berhasil diperbarui.`);
      setEditingUser(null);
      router.refresh();
    });
  };

  const handleToggleStatus = (user: ManagedUserItem) => {
    setError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      const res = await toggleUserStatusAction(user.id);
      if (!res.success) {
        setError(res.error ?? "Gagal mengubah status user.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/70 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-800 bg-emerald-950/70 px-4 py-3 text-xs text-emerald-300">
          {successMsg}
        </div>
      )}

      {/* Panel Edit User (Muncul saat tombol Edit diklik) */}
      {editingUser && (
        <div className="rounded-xl border border-blue-700/70 bg-slate-900/90 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Edit Akun & Hak Akses:{" "}
                <span className="font-mono text-blue-400">
                  {editingUser.username}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Ubah profil, penugasan role, cabang gudang, atau reset password
                login.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Tutup
            </button>
          </div>

          <form onSubmit={handleUpdateUser} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label
                  htmlFor={editNameFieldId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Nama Lengkap *
                </label>
                <input
                  id={editNameFieldId}
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor={editEmailFieldId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Email (Opsional)
                </label>
                <input
                  id={editEmailFieldId}
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor={editPhoneFieldId}
                  className="block text-xs font-medium text-slate-300"
                >
                  No. HP (Opsional)
                </label>
                <input
                  id={editPhoneFieldId}
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                />
              </div>

              <div>
                <label
                  htmlFor={editPassFieldId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Reset Password Baru (Opsional)
                </label>
                <input
                  id={editPassFieldId}
                  type="password"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak diubah"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-300">
                  Penugasan Role RBAC *
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.availableRoles.map((role) => {
                    const disabled = isRoleRestricted(role.name);
                    const checked = editRoleIds.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex items-start gap-2 rounded border px-2.5 py-2 text-xs ${
                          disabled
                            ? "cursor-not-allowed border-slate-800/60 bg-slate-900/30 opacity-45"
                            : checked
                              ? "cursor-pointer border-blue-600 bg-blue-950/40 text-white"
                              : "cursor-pointer border-slate-800 bg-slate-900/60 text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={() =>
                            setEditRoleIds((prev) =>
                              toggleIdInList(prev, role.id),
                            )
                          }
                          className="mt-0.5 rounded border-slate-600 bg-slate-950"
                        />
                        <div>
                          <div className="font-mono font-semibold">
                            {role.name}
                          </div>
                          {role.description && (
                            <div className="line-clamp-1 text-[10px] text-slate-400">
                              {role.description}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <div className="mb-2 text-xs font-semibold text-slate-300">
                  Cakupan Gudang Operasional
                </div>
                <div className="space-y-2">
                  {data.availableWarehouses.map((wh) => {
                    const checked = editWarehouseIds.includes(wh.id);
                    return (
                      <label
                        key={wh.id}
                        className={`flex cursor-pointer items-center gap-2.5 rounded border px-3 py-2 text-xs ${
                          checked
                            ? "border-emerald-600 bg-emerald-950/40 text-white"
                            : "border-slate-800 bg-slate-900/60 text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setEditWarehouseIds((prev) =>
                              toggleIdInList(prev, wh.id),
                            )
                          }
                          className="rounded border-slate-600 bg-slate-950"
                        />
                        <div>
                          <span className="font-mono font-semibold text-emerald-400">
                            {wh.code}
                          </span>{" "}
                          — {wh.name} ({wh.city})
                        </div>
                      </label>
                    );
                  })}
                </div>

                {editingUser.id !== data.currentUserId && (
                  <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-slate-800 pt-3 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={editIsActive}
                      onChange={(e) => setEditIsActive(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-950"
                    />
                    <span>Akun Aktif (Dapat Login ke Sistem)</span>
                  </label>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isPending ? "Menyimpan..." : "Simpan Perubahan User"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Form Tambah User Baru */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-semibold text-white">
          Buat Akun Pengguna Baru
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Tambahkan akun login baru dan tentukan role serta cabang gudang
          operasionalnya (Bali / Surabaya).
        </p>

        <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label
                htmlFor={usernameFieldId}
                className="block text-xs font-medium text-slate-300"
              >
                Username Login *
              </label>
              <input
                id={usernameFieldId}
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="contoh: admin.bali"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
              />
            </div>

            <div>
              <label
                htmlFor={fullNameFieldId}
                className="block text-xs font-medium text-slate-300"
              >
                Nama Lengkap *
              </label>
              <input
                id={fullNameFieldId}
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama staf / supir"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label
                htmlFor={passwordFieldId}
                className="block text-xs font-medium text-slate-300"
              >
                Password Awal *
              </label>
              <input
                id={passwordFieldId}
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label
                htmlFor={emailFieldId}
                className="block text-xs font-medium text-slate-300"
              >
                Email (Opsional)
              </label>
              <input
                id={emailFieldId}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staf@dutaekspedisi.co.id"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label
                htmlFor={phoneFieldId}
                className="block text-xs font-medium text-slate-300"
              >
                No. HP (Opsional)
              </label>
              <input
                id={phoneFieldId}
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0812..."
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="mb-2 text-xs font-semibold text-slate-300">
                Pilih Role Pengguna * (Bisa lebih dari satu)
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data.availableRoles.map((role) => {
                  const disabled = isRoleRestricted(role.name);
                  const checked = selectedRoleIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex items-start gap-2 rounded border px-2.5 py-2 text-xs ${
                        disabled
                          ? "cursor-not-allowed border-slate-800/60 bg-slate-900/30 opacity-45"
                          : checked
                            ? "cursor-pointer border-blue-600 bg-blue-950/40 text-white"
                            : "cursor-pointer border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={checked}
                        onChange={() =>
                          setSelectedRoleIds((prev) =>
                            toggleIdInList(prev, role.id),
                          )
                        }
                        className="mt-0.5 rounded border-slate-600 bg-slate-950"
                      />
                      <div>
                        <div className="font-mono font-semibold">
                          {role.name}
                        </div>
                        {role.description && (
                          <div className="line-clamp-1 text-[10px] text-slate-400">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
              <div className="mb-2 text-xs font-semibold text-slate-300">
                Penugasan Cabang Gudang (Warehouse Scope)
              </div>
              <div className="space-y-2">
                {data.availableWarehouses.map((wh) => {
                  const checked = selectedWarehouseIds.includes(wh.id);
                  return (
                    <label
                      key={wh.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded border px-3 py-2 text-xs ${
                        checked
                          ? "border-emerald-600 bg-emerald-950/40 text-white"
                          : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedWarehouseIds((prev) =>
                            toggleIdInList(prev, wh.id),
                          )
                        }
                        className="rounded border-slate-600 bg-slate-950"
                      />
                      <div>
                        <span className="font-mono font-semibold text-emerald-400">
                          {wh.code}
                        </span>{" "}
                        — {wh.name} ({wh.city})
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[11px] text-slate-500">
                Penting untuk membatasi akses gudang pada role{" "}
                <span className="font-mono">FINANCE</span> dan{" "}
                <span className="font-mono">WAREHOUSE_STAFF</span>.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending ? "Menyimpan..." : "+ Buat Akun User"}
            </button>
          </div>
        </form>
      </div>

      {/* Tabel Daftar User */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Username & Nama</th>
                <th className="px-4 py-3 font-semibold">Kontak</th>
                <th className="px-4 py-3 font-semibold">Role RBAC</th>
                <th className="px-4 py-3 font-semibold">Akses Gudang</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.users.map((u) => {
                const targetIsPrivileged = u.roles.some(
                  (r) => r.name === "OWNER" || r.name === "SUPER_ADMIN",
                );
                const canModifyTarget =
                  data.canManagePrivilegedRoles || !targetIsPrivileged;

                return (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-blue-400">
                        {u.username}
                        {u.id === data.currentUserId && (
                          <span className="ml-2 rounded bg-blue-950 px-1.5 py-0.5 text-[10px] text-blue-300">
                            Anda
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-medium text-white">
                        {u.full_name}
                      </div>
                      {u.driver && (
                        <div className="mt-0.5 font-mono text-[10px] text-indigo-400">
                          Terhubung Driver: {u.driver.driver_code}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      <div>{u.email ?? "-"}</div>
                      <div className="font-mono">{u.phone ?? "-"}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <span
                            key={r.id}
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                              ROLE_BADGE_STYLE[r.name] ??
                              "border-slate-700 bg-slate-800 text-slate-300"
                            }`}
                          >
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {u.warehouses.length === 0 ? (
                        <span className="text-[11px] italic text-slate-500">
                          Belum ditugaskan
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.warehouses.map((w) => (
                            <span
                              key={w.id}
                              className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-slate-200"
                            >
                              {w.code} ({w.city})
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                          u.is_active
                            ? "border-emerald-800/60 bg-emerald-950/80 text-emerald-300"
                            : "border-red-800/60 bg-red-950/80 text-red-400"
                        }`}
                      >
                        {u.is_active ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {canModifyTarget ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => openEditPanel(u)}
                            className="rounded border border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          {u.id !== data.currentUserId && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleToggleStatus(u)}
                              className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white"
                            >
                              {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] italic text-slate-500">
                          Dilindungi
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
