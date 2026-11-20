"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import {
  addManifestEventAction,
  arriveTripAction,
  assignShipmentToManifestAction,
  closeTripAction,
  departTripAction,
  lockManifestAction,
  removeShipmentFromManifestAction,
} from "../trip.actions";
import type { EligibleShipmentItem, TripDetailData } from "../trip.queries";

interface TripDetailProps {
  trip: TripDetailData;
  eligibleShipments: EligibleShipmentItem[];
}

export function TripDetail({ trip, eligibleShipments }: TripDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [selectedShipmentId, setSelectedShipmentId] = useState(
    eligibleShipments[0]?.id ?? "",
  );
  const [checkpointLocation, setCheckpointLocation] = useState("");
  const [eventType, setEventType] = useState("CHECKPOINT_TRANSIT");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc] = useState("");

  const selectShipmentFieldId = useId();
  const checkpointId = useId();
  const evTypeId = useId();
  const evLocId = useId();
  const evDescId = useId();

  const manifest = trip.manifest;
  const loadedItems = manifest?.manifestItems ?? [];
  const totalWeight = loadedItems.reduce(
    (acc, item) => acc + item.shipment.weight,
    0,
  );
  const totalQty = loadedItems.reduce(
    (acc, item) => acc + item.shipment.qty,
    0,
  );

  const runAction = (
    fn: () => Promise<{ success: boolean; error?: string }>,
  ) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.success) {
        setError(res.error ?? "Terjadi kesalahan saat memproses aksi.");
        return;
      }
      router.refresh();
    });
  };

  const handleAddEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await addManifestEventAction({
        trip_id: trip.id,
        event_type: eventType,
        location_name: eventLocation,
        description: eventDesc,
      });
      if (!res.success) {
        setError(res.error ?? "Gagal mencatat event manifest.");
        return;
      }
      setEventDesc("");
      setEventLocation("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link
          href="/dashboard/trips"
          className="text-xs font-medium text-slate-400 hover:text-white"
        >
          ← Kembali ke Daftar Trip
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          Cetak Surat Jalan / Manifest
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/70 px-4 py-3 text-xs text-red-300 print:hidden">
          {error}
        </div>
      )}

      {manifest && trip.status !== "CLOSED" && trip.status !== "CANCELLED" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 print:hidden">
          <h2 className="text-sm font-semibold text-white">
            Kontrol Status Trip & Manifest
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Status Trip:{" "}
            <span className="font-mono font-semibold text-blue-400">
              {trip.status}
            </span>{" "}
            - Status Manifest:{" "}
            <span className="font-mono font-semibold text-indigo-400">
              {manifest.status}
            </span>
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            {(trip.status === "READY_TO_DEPART" ||
              trip.status === "DEPARTED") && (
              <div className="flex-1">
                <label
                  htmlFor={checkpointId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Lokasi Keberangkatan / Kedatangan
                </label>
                <input
                  id={checkpointId}
                  type="text"
                  value={checkpointLocation}
                  onChange={(e) => setCheckpointLocation(e.target.value)}
                  placeholder="Contoh: Gudang Bali Denpasar / Pelabuhan Gilimanuk"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {manifest.status === "DRAFT" && (
                <button
                  type="button"
                  disabled={isPending || loadedItems.length === 0}
                  onClick={() => runAction(() => lockManifestAction(trip.id))}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isPending ? "Memproses..." : "Kunci Manifest (Siap Jalan)"}
                </button>
              )}

              {trip.status === "READY_TO_DEPART" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(() =>
                      departTripAction(trip.id, checkpointLocation),
                    )
                  }
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {isPending ? "Memproses..." : "Berangkatkan Armada (Depart)"}
                </button>
              )}

              {trip.status === "DEPARTED" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    runAction(() =>
                      arriveTripAction(trip.id, checkpointLocation),
                    )
                  }
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {isPending
                    ? "Memproses..."
                    : "Tandai Tiba di Tujuan (Arrive)"}
                </button>
              )}

              {trip.status === "ARRIVED" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => runAction(() => closeTripAction(trip.id))}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isPending ? "Memproses..." : "Selesaikan & Tutup Trip"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {manifest && manifest.status === "DRAFT" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 print:hidden">
          <h2 className="text-sm font-semibold text-white">
            Muat Resi ke Dalam Manifest
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Menampilkan resi berstatus{" "}
            <span className="font-mono text-blue-400">RECEIVED_AT_ORIGIN</span>{" "}
            yang siap dimuat ke armada.
          </p>

          {eligibleShipments.length === 0 ? (
            <p className="mt-3 text-xs italic text-slate-500">
              Tidak ada resi berstatus RECEIVED_AT_ORIGIN yang tersedia saat
              ini. Konfirmasi penerimaan barang di detail resi terlebih dahulu.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label
                  htmlFor={selectShipmentFieldId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Pilih Resi Pengiriman
                </label>
                <select
                  id={selectShipmentFieldId}
                  value={selectedShipmentId}
                  onChange={(e) => setSelectedShipmentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {eligibleShipments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shipment_no} | {s.originWarehouse.city} →{" "}
                      {s.destWarehouse.city} | {s.sender.name} ({s.qty} koli,{" "}
                      {s.weight} kg)
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                disabled={isPending || !selectedShipmentId}
                onClick={() =>
                  runAction(() =>
                    assignShipmentToManifestAction(trip.id, selectedShipmentId),
                  )
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isPending ? "Memuat..." : "+ Muat ke Manifest"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 print:border-2 print:border-black print:bg-white print:text-black">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row print:border-black">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400 print:text-black">
              SURAT JALAN & MANIFEST MUATAN • DUTA EKSPEDISI
            </div>
            <h2 className="mt-1 font-mono text-xl font-bold text-white print:text-black">
              {manifest?.manifest_no ?? trip.trip_code}
            </h2>
            <p className="font-mono text-xs text-slate-400 print:text-black">
              Trip: {trip.trip_code} • Status: {trip.status}
            </p>
          </div>

          <div className="text-xs text-slate-300 sm:text-right print:text-black">
            <div className="font-semibold">
              Armada: {trip.vehicle.plate_number} ({trip.vehicle.vehicle_type})
            </div>
            <div>
              Supir: {trip.primaryDriver.name} • {trip.primaryDriver.phone}
            </div>
            <div className="mt-1 font-mono">
              Total Muatan: {loadedItems.length} Resi • {totalQty} Koli •{" "}
              {totalWeight.toFixed(2)} / {trip.vehicle.capacity_weight} kg
            </div>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-slate-800 print:border-black">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/70 uppercase text-slate-400 print:border-black print:bg-white print:text-black">
              <tr>
                <th className="px-3 py-2.5 font-semibold">No. Resi</th>
                <th className="px-3 py-2.5 font-semibold">Rute</th>
                <th className="px-3 py-2.5 font-semibold">
                  Pengirim → Penerima
                </th>
                <th className="px-3 py-2.5 font-semibold">Barang</th>
                <th className="px-3 py-2.5 font-semibold">Koli / Berat</th>
                <th className="px-3 py-2.5 text-right font-semibold print:hidden">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 print:divide-black">
              {loadedItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center italic text-slate-500"
                  >
                    Belum ada resi yang dimuat dalam manifest ini.
                  </td>
                </tr>
              ) : (
                loadedItems.map((item) => (
                  <tr
                    key={item.id}
                    className="text-slate-200 hover:bg-slate-800/40 print:text-black"
                  >
                    <td className="px-3 py-2.5 font-mono font-semibold">
                      <Link
                        href={`/dashboard/shipments/${item.shipment.id}`}
                        className="text-blue-400 hover:underline print:text-black print:no-underline"
                      >
                        {item.shipment.shipment_no}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.shipment.originWarehouse.code} →{" "}
                      {item.shipment.destWarehouse.code}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.shipment.sender.name} →{" "}
                      {item.shipment.receiver.name}
                    </td>
                    <td className="px-3 py-2.5">
                      {item.shipment.goods_description}
                    </td>
                    <td className="px-3 py-2.5 font-mono">
                      {item.shipment.qty} koli • {item.shipment.weight} kg
                    </td>
                    <td className="px-3 py-2.5 text-right print:hidden">
                      {manifest?.status === "DRAFT" ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            runAction(() =>
                              removeShipmentFromManifestAction(
                                trip.id,
                                item.id,
                              ),
                            )
                          }
                          className="rounded border border-red-800/60 bg-red-950/60 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-900/60 disabled:opacity-50"
                        >
                          Keluarkan
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400">
                          {item.shipment.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 hidden grid-cols-3 gap-6 pt-4 text-center text-xs print:grid">
          <div>
            <p className="font-semibold">Admin / Checker Asal</p>
            <div className="mt-14 border-b border-black" />
          </div>
          <div>
            <p className="font-semibold">Supir Armada</p>
            <div className="mt-14 border-b border-black" />
            <p className="mt-1">{trip.primaryDriver.name}</p>
          </div>
          <div>
            <p className="font-semibold">Admin / Checker Tujuan</p>
            <div className="mt-14 border-b border-black" />
          </div>
        </div>
      </div>

      {manifest && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:hidden">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-white">
              Catat Log Perjalanan (Manifest Event)
            </h3>
            <form onSubmit={handleAddEvent} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={evTypeId}
                    className="block text-xs font-medium text-slate-300"
                  >
                    Jenis Event
                  </label>
                  <select
                    id={evTypeId}
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="CHECKPOINT_TRANSIT">
                      Checkpoint Transit
                    </option>
                    <option value="FERRY_CROSSING">
                      Penyeberangan Gilimanuk - Ketapang
                    </option>
                    <option value="DELAY_INCIDENT">
                      Kendala / Keterlambatan
                    </option>
                    <option value="GENERAL_NOTE">Catatan Operasional</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={evLocId}
                    className="block text-xs font-medium text-slate-300"
                  >
                    Lokasi
                  </label>
                  <input
                    id={evLocId}
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="Contoh: Pelabuhan Ketapang, Banyuwangi"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={evDescId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Keterangan
                </label>
                <input
                  id={evDescId}
                  type="text"
                  required
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Contoh: Armada masuk kapal feri menuju Ketapang"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isPending ? "Menyimpan..." : "Simpan Event Perjalanan"}
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="text-sm font-semibold text-white">
              Riwayat Event Manifest
            </h3>
            <div className="mt-4 space-y-3">
              {manifest.manifestEvents.length === 0 ? (
                <p className="text-xs italic text-slate-500">
                  Belum ada catatan event manifest.
                </p>
              ) : (
                manifest.manifestEvents.map((ev) => {
                  const photoUrl = (ev as { photo_url?: string | null })
                    .photo_url;
                  return (
                    <div
                      key={ev.id}
                      className="border-l-2 border-amber-500 pl-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-amber-400">
                          {ev.event_type}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(ev.created_at).toLocaleString("id-ID")}
                        </span>
                      </div>
                      {ev.description && (
                        <p className="mt-1 text-slate-200">{ev.description}</p>
                      )}
                      {ev.location_name && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Lokasi: {ev.location_name}
                        </p>
                      )}
                      {photoUrl && (
                        <a
                          href={photoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block overflow-hidden rounded-lg border border-slate-700"
                        >
                          <Image
                            src={photoUrl}
                            alt={ev.location_name ?? "Foto checkpoint supir"}
                            width={160}
                            height={96}
                            unoptimized
                            className="h-24 w-40 object-cover"
                          />
                        </a>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
