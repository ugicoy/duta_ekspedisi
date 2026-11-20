import { FinanceManager } from "@/modules/finance/components/finance-manager";
import { getFinancePageData } from "@/modules/finance/finance.queries";

export default async function FinancePage() {
  const data = await getFinancePageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Keuangan & Biaya Perjalanan
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola pencatatan pembayaran tagihan resi, persetujuan koreksi, dan
          biaya operasional armada Bali ⇄ Surabaya.
        </p>
      </div>

      <FinanceManager data={data} />
    </div>
  );
}
