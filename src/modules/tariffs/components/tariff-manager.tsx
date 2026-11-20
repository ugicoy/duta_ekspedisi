"use client";

import { useState } from "react";
import type {
  PricingTypeItem,
  TariffReferenceItem,
  WarehouseCityOption,
} from "../tariff.queries";
import { PricingTypeSection } from "./pricing-type-section";
import { TariffReferenceSection } from "./tariff-reference-section";

interface TariffManagerProps {
  pricingTypes: PricingTypeItem[];
  tariffs: TariffReferenceItem[];
  warehouses: WarehouseCityOption[];
}

export function TariffManager({
  pricingTypes,
  tariffs,
  warehouses,
}: TariffManagerProps) {
  const [activeTab, setActiveTab] = useState<"tariffs" | "pricing-types">(
    "tariffs",
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("tariffs")}
          className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === "tariffs"
              ? "bg-blue-600 text-white"
              : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          Referensi Tarif Rute ({tariffs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("pricing-types")}
          className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
            activeTab === "pricing-types"
              ? "bg-blue-600 text-white"
              : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          Jenis Tarif ({pricingTypes.length})
        </button>
      </div>

      {activeTab === "tariffs" ? (
        <TariffReferenceSection
          initialTariffs={tariffs}
          pricingTypes={pricingTypes}
          warehouses={warehouses}
        />
      ) : (
        <PricingTypeSection initialPricingTypes={pricingTypes} />
      )}
    </div>
  );
}
