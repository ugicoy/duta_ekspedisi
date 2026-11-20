import { DeliveryManager } from "@/modules/delivery/components/delivery-manager";
import {
  getDeliveryProofs,
  getEligibleShipmentsForPod,
} from "@/modules/delivery/delivery.queries";

export default async function DeliveryPage() {
  const [proofs, eligibleShipments] = await Promise.all([
    getDeliveryProofs(),
    getEligibleShipmentsForPod(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Bukti Serah Terima (POD)
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Catat bukti penyerahan barang kepada penerima akhir dan selesaikan
          status pengiriman resi.
        </p>
      </div>

      <DeliveryManager
        initialProofs={proofs}
        eligibleShipments={eligibleShipments}
      />
    </div>
  );
}
