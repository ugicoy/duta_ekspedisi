import { KoliManager } from "@/modules/kolis/components/koli-manager";
import { getKoliFormData, getKolis } from "@/modules/kolis/koli.queries";

export default async function KolisPage() {
  const [kolis, formData] = await Promise.all([getKolis(), getKoliFormData()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Konsolidasi Koli
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelompokkan beberapa resi ke dalam karung/wadah koli ber-barcode untuk
          mempercepat proses bongkar muat gudang.
        </p>
      </div>

      <KoliManager initialKolis={kolis} formData={formData} />
    </div>
  );
}
