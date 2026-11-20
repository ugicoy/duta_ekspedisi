"use client";

import { useId, useState } from "react";
import type { AuditLogItem } from "../audit.queries";

interface AuditLogViewerProps {
  logs: AuditLogItem[];
}

function formatJsonPreview(value: unknown): string {
  if (value === null || value === undefined) return "-";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function AuditLogViewer({ logs }: AuditLogViewerProps) {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("ALL");

  const searchFieldId = useId();
  const entityFieldId = useId();

  const entities = [
    "ALL",
    ...Array.from(new Set(logs.map((l) => l.entity_name))),
  ];

  const q = search.trim().toLowerCase();
  const filteredLogs = logs.filter((log) => {
    if (entityFilter !== "ALL" && log.entity_name !== entityFilter) {
      return false;
    }
    if (!q) return true;

    const actorText = log.user
      ? `${log.user.username} ${log.user.full_name}`.toLowerCase()
      : "system";
    const payloadText =
      `${formatJsonPreview(log.old_values)} ${formatJsonPreview(log.new_values)}`.toLowerCase();

    return (
      log.action.toLowerCase().includes(q) ||
      log.entity_name.toLowerCase().includes(q) ||
      (log.entity_id ?? "").toLowerCase().includes(q) ||
      actorText.includes(q) ||
      payloadText.includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label
            htmlFor={searchFieldId}
            className="block text-xs font-medium text-slate-400"
          >
            Cari Aksi, Aktor, atau Detail Data
          </label>
          <input
            id={searchFieldId}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Contoh: CREATE_SHIPMENT, superadmin, DE-BL..."
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-500"
          />
        </div>

        <div className="sm:w-56">
          <label
            htmlFor={entityFieldId}
            className="block text-xs font-medium text-slate-400"
          >
            Filter Entitas
          </label>
          <select
            id={entityFieldId}
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          >
            {entities.map((ent) => (
              <option key={ent} value={ent}>
                {ent === "ALL" ? "Semua Entitas" : ent}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Waktu</th>
                <th className="px-4 py-3 font-semibold">Aktor / User</th>
                <th className="px-4 py-3 font-semibold">Aksi</th>
                <th className="px-4 py-3 font-semibold">Entitas</th>
                <th className="px-4 py-3 font-semibold">Data Sebelum</th>
                <th className="px-4 py-3 font-semibold">Data Sesudah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center italic text-slate-500"
                  >
                    Tidak ada catatan audit log yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-slate-800/40">
                    <td className="whitespace-nowrap px-4 py-3 text-[11px] text-slate-400">
                      {new Date(log.created_at).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {log.user ? (
                        <>
                          <div className="font-mono font-semibold text-blue-400">
                            {log.user.username}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {log.user.full_name}
                          </div>
                        </>
                      ) : (
                        <span className="font-mono text-slate-500">SYSTEM</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">
                        {log.entity_name}
                      </div>
                      {log.entity_id && (
                        <div className="font-mono text-[10px] text-slate-500">
                          {log.entity_id.slice(0, 8)}...
                        </div>
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 font-mono text-[11px] text-slate-400">
                      <div className="break-all">
                        {formatJsonPreview(log.old_values)}
                      </div>
                    </td>
                    <td className="max-w-xs px-4 py-3 font-mono text-[11px] text-emerald-300">
                      <div className="break-all">
                        {formatJsonPreview(log.new_values)}
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
