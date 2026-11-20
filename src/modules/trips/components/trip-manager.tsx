"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { createTripAction } from "../trip.actions";
import type { TripFormOptions, TripListItem } from "../trip.queries";

interface TripManagerProps {
  initialTrips: TripListItem[];
  formOptions: TripFormOptions;
}

const TRIP_STATUS_BADGE: Record<string, string> = {
  DRAFT: "border-slate-700 bg-slate-800/80 text-slate-300",
  LOADING: "border-blue-800/60 bg-blue-950/80 text-blue-300",
  READY_TO_DEPART: "border-indigo-800/60 bg-indigo-950/80 text-indigo-300",
  DEPARTED: "border-amber-800/60 bg-amber-950/80 text-amber-300",
  ARRIVED: "border-cyan-800/60 bg-cyan-950/80 text-cyan-300",
  CLOSED: "border-emerald-800/60 bg-emerald-950/80 text-emerald-300",
  CANCELLED: "border-red-800/60 bg-red-950/80 text-red-400",
};

export function TripManager({ initialTrips, formOptions }: TripManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [warehouseId, setWarehouseId] = useState(
    formOptions.warehouses[0]?.id ?? "",
  );
  const [vehicleId, setVehicleId] = useState(formOptions.vehicles[0]?.id ?? "");
  const [driverId, setDriverId] = useState(formOptions.drivers[0]?.id ?? "");

  const whId = useId();
  const vehId = useId();
  const drvId = useId();

  const handleCreateTrip = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createTripAction({
        origin_warehouse_id: warehouseId,
        vehicle_id: vehicleId,
        primary_driver_id: driverId,
      });

      if (!res.success) {
        setError(res.error ?? "Gagal membuat trip baru.");
        return;
      }

      if (res.data?.id) {
        router.push(`/dashboard/trips/${res.data.id}`);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-semibold text-white">
          Buat Jadwal Trip & Manifest Baru
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Pilih cabang keberangkatan, armada aktif, dan supir utama untuk
          menerbitkan nomor Trip & Surat Jalan Manifest otomatis.
        </p>

        {error && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-950/70 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <form
          onSubmit={handleCreateTrip}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end"
        >
          <div>
            <label
              htmlFor={whId}
              className="block text-xs font-medium text-slate-300"
            >
              Cabang Keberangkatan
            </label>
            <select
              id={whId}
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {formOptions.warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={vehId}
              className="block text-xs font-medium text-slate-300"
            >
              Armada Kendaraan
            </label>
            <select
              id={vehId}
              required
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {formOptions.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number} — {v.vehicle_type} (Maks {v.capacity_weight}
                  kg)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={drvId}
              className="block text-xs font-medium text-slate-300"
            >
              Supir Utama
            </label>
            <select
              id={drvId}
              required
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {formOptions.drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.driver_code})
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isPending ? "Membuat..." : "+ Buat Trip & Manifest"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  Kode Trip & Manifest
                </th>
                <th className="px-4 py-3 font-semibold">Armada & Supir</th>
                <th className="px-4 py-3 font-semibold">Muatan Manifest</th>
                <th className="px-4 py-3 font-semibold">Waktu Jalan / Tiba</th>
                <th className="px-4 py-3 font-semibold">Status Trip</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initialTrips.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center italic text-slate-500"
                  >
                    Belum ada jadwal trip keberangkatan armada.
                  </td>
                </tr>
              ) : (
                initialTrips.map((trip) => {
                  const badgeClass =
                    TRIP_STATUS_BADGE[trip.status] ??
                    "border-slate-700 bg-slate-800 text-slate-300";

                  return (
                    <tr key={trip.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/trips/${trip.id}`}
                          className="font-mono font-semibold text-blue-400 hover:underline"
                        >
                          {trip.trip_code}
                        </Link>
                        {trip.manifest && (
                          <div className="font-mono text-[11px] text-slate-400">
                            {trip.manifest.manifest_no} ({trip.manifest.status})
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">
                          {trip.vehicle.plate_number} •{" "}
                          {trip.vehicle.vehicle_type}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Supir: {trip.primaryDriver.name} (
                          {trip.primaryDriver.phone})
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {trip.manifest ? (
                          <div>
                            <span className="font-semibold text-slate-200">
                              {trip.manifest.itemCount} resi
                            </span>{" "}
                            • {trip.manifest.totalQty} koli •{" "}
                            {trip.manifest.totalWeight.toFixed(1)} kg
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-400">
                        <div>
                          Berangkat:{" "}
                          {trip.departure_time
                            ? new Date(trip.departure_time).toLocaleString(
                                "id-ID",
                                { dateStyle: "short", timeStyle: "short" },
                              )
                            : "-"}
                        </div>
                        <div>
                          Tiba:{" "}
                          {trip.arrival_time
                            ? new Date(trip.arrival_time).toLocaleString(
                                "id-ID",
                                { dateStyle: "short", timeStyle: "short" },
                              )
                            : "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}
                        >
                          {trip.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/trips/${trip.id}`}
                          className="inline-flex rounded-md border border-slate-700 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                          Kelola Manifest
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

