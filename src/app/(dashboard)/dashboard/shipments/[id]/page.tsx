import { notFound } from "next/navigation";
import { ShipmentDetail } from "@/modules/shipments/components/shipment-detail";
import { getShipmentById } from "@/modules/shipments/shipment.queries";

interface ShipmentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ShipmentDetailPage({
  params,
}: ShipmentDetailPageProps) {
  const { id } = await params;
  const shipment = await getShipmentById(id);

  if (!shipment) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Detail & Cetak Resi Pengiriman
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola penerimaan barang di gudang, pantau riwayat perjalanan, atau
          cetak lembar resi.
        </p>
      </div>

      <ShipmentDetail shipment={shipment} />
    </div>
  );
}
