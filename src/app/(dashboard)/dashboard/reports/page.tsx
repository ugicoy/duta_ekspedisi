import { ReportsManager } from "@/modules/reports/components/reports-manager";
import { getReportsPageData } from "@/modules/reports/report.queries";

export default async function ReportsPage() {
  const data = await getReportsPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Laporan Operasional & Keuangan
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Rekapitulasi transaksi pengiriman, stok gudang, perjalanan armada, dan
          catatan keuangan MVP Bali ⇄ Surabaya.
        </p>
      </div>

      <ReportsManager data={data} />
    </div>
  );
}
