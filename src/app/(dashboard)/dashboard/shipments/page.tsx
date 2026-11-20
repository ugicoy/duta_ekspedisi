import { ShipmentTable } from "@/modules/shipments/components/shipment-table";
import { getShipments } from "@/modules/shipments/shipment.queries";

export default async function ShipmentsPage() {
  const shipments = await getShipments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Daftar Resi Pengiriman
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Pantau seluruh transaksi resi pengiriman rute Bali ⇄ Surabaya beserta
          status operasional gudang.
        </p>
      </div>

      <ShipmentTable initialShipments={shipments} />
    </div>
  );
}
