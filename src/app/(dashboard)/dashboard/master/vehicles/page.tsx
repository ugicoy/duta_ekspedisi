import { VehicleTable } from "@/modules/vehicles/components/vehicle-table";
import { getVehicles } from "@/modules/vehicles/vehicle.queries";

export default async function VehiclesPage() {
  const vehicles = await getVehicles();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Manajemen Armada Kendaraan
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola daftar truk, kapasitas berat/volume, dan status operasional
          armada Bali ⇄ Surabaya.
        </p>
      </div>

      <VehicleTable initialVehicles={vehicles} />
    </div>
  );
}
