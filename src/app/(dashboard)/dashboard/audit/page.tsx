import { getAuditLogs } from "@/modules/audit/audit.queries";
import { AuditLogViewer } from "@/modules/audit/components/audit-log-viewer";

export default async function AuditLogPage() {
  const logs = await getAuditLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Audit Log Sistem
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Riwayat aktivitas operasional, perubahan status, koreksi keuangan, dan
          manajemen hak akses pengguna.
        </p>
      </div>

      <AuditLogViewer logs={logs} />
    </div>
  );
}
