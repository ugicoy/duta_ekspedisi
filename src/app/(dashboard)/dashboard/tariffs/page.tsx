import { requirePermission } from "@/lib/auth-guard";
import { TariffManager } from "@/modules/tariffs/components/tariff-manager";
import {
  getActiveWarehouseOptions,
  getPricingTypes,
  getTariffReferences,
} from "@/modules/tariffs/tariff.queries";

export default async function TariffsDashboardPage() {
  await requirePermission("master:read");

  const [pricingTypes, tariffs, warehouses] = await Promise.all([
    getPricingTypes(),
    getTariffReferences(),
    getActiveWarehouseOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Referensi Tarif & Jenis Layanan
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola jenis tarif pengiriman serta acuan tarif per kg dan per m³
          untuk rute Bali ⇄ Surabaya.
        </p>
      </div>

      <TariffManager
        pricingTypes={pricingTypes}
        tariffs={tariffs}
        warehouses={warehouses}
      />
    </div>
  );
}
