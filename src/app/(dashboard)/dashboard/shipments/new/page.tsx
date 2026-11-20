import { ShipmentForm } from "@/modules/shipments/components/shipment-form";
import { getShipmentFormData } from "@/modules/shipments/shipment.queries";

export default async function NewShipmentPage() {
  const formData = await getShipmentFormData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Buat Resi Pengiriman Baru
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Input detail pengirim, penerima, dan dimensi koli untuk menerbitkan
          nomor resi otomatis.
        </p>
      </div>

      <ShipmentForm formData={formData} />
    </div>
  );
}
