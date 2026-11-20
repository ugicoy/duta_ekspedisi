import { notFound } from "next/navigation";
import { TripDetail } from "@/modules/trips/components/trip-detail";
import {
  getEligibleShipmentsForManifest,
  getTripById,
} from "@/modules/trips/trip.queries";

interface TripDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = await params;
  const [trip, eligibleShipments] = await Promise.all([
    getTripById(id),
    getEligibleShipmentsForManifest(),
  ]);

  if (!trip) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Kelola Manifest & Perjalanan Armada
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Susun muatan resi, kunci manifest, dan catat status keberangkatan
          serta kedatangan armada.
        </p>
      </div>

      <TripDetail trip={trip} eligibleShipments={eligibleShipments} />
    </div>
  );
}
