import { TripManager } from "@/modules/trips/components/trip-manager";
import { getTripFormOptions, getTrips } from "@/modules/trips/trip.queries";

export default async function TripsPage() {
  const [trips, formOptions] = await Promise.all([
    getTrips(),
    getTripFormOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Trip & Manifest Linehaul
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola penjadwalan armada, penyusunan surat jalan manifest, dan
          perjalanan lintas Bali ⇄ Surabaya.
        </p>
      </div>

      <TripManager initialTrips={trips} formOptions={formOptions} />
    </div>
  );
}
