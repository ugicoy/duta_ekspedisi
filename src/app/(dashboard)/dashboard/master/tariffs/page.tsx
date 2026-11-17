import {
  getPricingTypes,
  getTariffReferences,
} from "@/modules/tariffs/tariff.queries";

export default async function TariffsPage() {
  const [pricingTypes, tariffs] = await Promise.all([
    getPricingTypes(),
    getTariffReferences(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Manajemen Pricing & Tarif (Tariff References)
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola jenis penetapan harga (PricingType) dan referensi tarif rute
          Bali ? Surabaya.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
        <p className="font-semibold text-white mb-2">
          Backend & Route Siap ({pricingTypes.length} Pricing Types,{" "}
          {tariffs.length} Tarif Terdaftar)
        </p>
        <p className="text-slate-400">
          Modul backend & server actions berhasil dibuat. Komponen UI lengkap
          akan diimplementasikan pada sesi berikutnya sesuai spesifikasi.
        </p>
      </div>
    </div>
  );
}
