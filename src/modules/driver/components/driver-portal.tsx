"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { logoutAction } from "@/app/(dashboard)/actions";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { compressImageFileToDataUrl } from "@/lib/image-compress";
import { submitDriverPortTransitAction } from "../driver.actions";
import type { DriverPortalData } from "../driver.queries";

interface DriverPortalProps {
  data: DriverPortalData;
}

export function DriverPortal({ data }: DriverPortalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTripId, setSelectedTripId] = useState(data.trips[0]?.id ?? "");
  const [checkpointType, setCheckpointType] = useState<
    "TRANSIT_GILIMANUK" | "TRANSIT_KETAPANG" | "CUSTOM_TRANSIT"
  >("TRANSIT_GILIMANUK");
  const [customLocation, setCustomLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const tripSelectId = useId();
  const customLocId = useId();
  const notesId = useId();
  const cameraFieldId = useId();

  const activeTrip =
    data.trips.find((t) => t.id === selectedTripId) ?? data.trips[0] ?? null;

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMsg(null);
    setIsCompressing(true);

    try {
      const compressed = await compressImageFileToDataUrl(file, 1280, 0.78);
      setPhotoDataUrl(compressed);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memproses foto dari kamera.",
      );
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!activeTrip) {
      setError("Tidak ada trip aktif yang dipilih.");
      return;
    }
    if (!photoDataUrl) {
      setError("Ambil foto lokasi pelabuhan / armada terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      const res = await submitDriverPortTransitAction({
        trip_id: activeTrip.id,
        checkpoint_type: checkpointType,
        custom_location: customLocation,
        notes,
        photo_data_url: photoDataUrl,
      });

      if (!res.success) {
        setError(res.error ?? "Gagal mengunggah laporan transit.");
        return;
      }

      setPhotoDataUrl(null);
      setNotes("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSuccessMsg(
        `Berhasil! Status seluruh paket pada ${activeTrip.trip_code} diperbarui menjadi "${res.message}" & foto tersimpan di cloud.`,
      );
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <div className="text-sm font-bold text-white">
              🚚 Duta Driver PWA
            </div>
            <div className="text-[11px] text-slate-400">
              Supir: {data.driverName}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {data.isSupervisorView && (
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white"
              >
                Dashboard
              </Link>
            )}
            <button
              type="button"
              onClick={() => setPwModalOpen(true)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:text-white"
            >
              🔑 Password
            </button>
            <button
              type="button"
              onClick={() => startTransition(() => logoutAction())}
              className="rounded-lg border border-red-900/70 bg-red-950/60 px-2.5 py-1.5 text-[11px] font-medium text-red-300"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 p-4 pb-12">
        {data.trips.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-center">
            <div className="text-2xl">🚛</div>
            <h1 className="mt-2 text-base font-bold text-white">
              Belum Ada Jadwal Trip Aktif
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Saat ini belum ada perjalanan armada yang ditugaskan kepada akun
              Anda atau manifest belum dikunci oleh admin gudang.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              {data.trips.length > 1 && (
                <div className="mb-3">
                  <label
                    htmlFor={tripSelectId}
                    className="block text-xs font-medium text-slate-400"
                  >
                    Pilih Jadwal Trip Aktif
                  </label>
                  <select
                    id={tripSelectId}
                    value={activeTrip?.id ?? ""}
                    onChange={(e) => setSelectedTripId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {data.trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.trip_code} • {t.vehicle.plate_number} ({t.status})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTrip && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-blue-400">
                      {activeTrip.trip_code}
                    </span>
                    <span className="rounded-full border border-amber-700/70 bg-amber-950/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                      {activeTrip.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300">
                    Armada:{" "}
                    <strong className="text-white">
                      {activeTrip.vehicle.plate_number}
                    </strong>{" "}
                    ({activeTrip.vehicle.vehicle_type})
                  </div>

                  {activeTrip.manifest && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
                      <div className="font-mono text-[11px] text-slate-400">
                        Manifest: {activeTrip.manifest.manifest_no}
                      </div>
                      <div className="mt-1 font-semibold text-emerald-400">
                        Total Muatan: {activeTrip.manifest.shipmentCount} Resi •{" "}
                        {activeTrip.manifest.totalQty} Koli •{" "}
                        {activeTrip.manifest.totalWeight.toFixed(1)} kg
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-800 bg-red-950/80 p-3.5 text-xs text-red-200">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="rounded-xl border border-emerald-700 bg-emerald-950/80 p-3.5 text-xs text-emerald-200">
                {successMsg}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
            >
              <div>
                <h2 className="text-sm font-bold text-white">
                  Lapor Lokasi Pelabuhan & Foto Bukti
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Pilih pelabuhan saat ini lalu ambil foto bukti. Status seluruh
                  paket di manifest otomatis diperbarui.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={() => setCheckpointType("TRANSIT_GILIMANUK")}
                  className={`rounded-xl border p-3.5 text-left transition ${
                    checkpointType === "TRANSIT_GILIMANUK"
                      ? "border-blue-500 bg-blue-950/70 text-white"
                      : "border-slate-700 bg-slate-950/70 text-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold text-blue-300">
                    ⛴️ Transit in Pelabuhan Gilimanuk
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    Armada tiba / antre kapal penyeberangan Pelabuhan Gilimanuk
                    (Bali)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCheckpointType("TRANSIT_KETAPANG")}
                  className={`rounded-xl border p-3.5 text-left transition ${
                    checkpointType === "TRANSIT_KETAPANG"
                      ? "border-cyan-500 bg-cyan-950/70 text-white"
                      : "border-slate-700 bg-slate-950/70 text-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold text-cyan-300">
                    ⛴️ Transit in Pelabuhan Ketapang
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    Armada tiba / sandar di Pelabuhan Ketapang (Banyuwangi)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCheckpointType("CUSTOM_TRANSIT")}
                  className={`rounded-xl border p-3 text-left transition ${
                    checkpointType === "CUSTOM_TRANSIT"
                      ? "border-amber-500 bg-amber-950/60 text-white"
                      : "border-slate-700 bg-slate-950/70 text-slate-300"
                  }`}
                >
                  <div className="text-xs font-bold text-amber-300">
                    📍 Pos Checkpoint Lainnya
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    Rest area / jalur pantura / pos pemeriksaan lainnya
                  </div>
                </button>
              </div>

              {checkpointType === "CUSTOM_TRANSIT" && (
                <div>
                  <label
                    htmlFor={customLocId}
                    className="block text-xs font-medium text-slate-300"
                  >
                    Nama Lokasi Checkpoint *
                  </label>
                  <input
                    id={customLocId}
                    type="text"
                    required
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    placeholder="Contoh: Jalur Pantura Situbondo / Tol Probolinggo"
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor={cameraFieldId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Foto Bukti di Pelabuhan / Lokasi *
                </label>
                <input
                  ref={fileInputRef}
                  id={cameraFieldId}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="mt-1.5 block w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                />

                {isCompressing && (
                  <p className="mt-2 text-xs text-blue-400">
                    Memproses foto kamera...
                  </p>
                )}

                {photoDataUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                    <Image
                      src={photoDataUrl}
                      alt="Preview bukti transit"
                      width={640}
                      height={360}
                      unoptimized
                      className="max-h-64 w-full object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor={notesId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  id={notesId}
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Masuk kapal KMP Jatra / Cuaca cerah"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={isPending || isCompressing || !photoDataUrl}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {isPending
                  ? "Mengunggah Foto & Update Status..."
                  : "Kirim Foto & Update Status Paket"}
              </button>
            </form>

            {activeTrip?.manifest &&
              activeTrip.manifest.recentEvents.length > 0 && (
                <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Riwayat Laporan Perjalanan Trip Ini
                  </h3>
                  <div className="space-y-3">
                    {activeTrip.manifest.recentEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-blue-400">
                            {ev.location_name ?? ev.event_type}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(ev.created_at).toLocaleString("id-ID", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        {ev.description && (
                          <p className="mt-1 text-slate-300">
                            {ev.description}
                          </p>
                        )}
                        {ev.photo_url && (
                          <a
                            href={ev.photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-block overflow-hidden rounded-lg border border-slate-700"
                          >
                            <Image
                              src={ev.photo_url}
                              alt={ev.location_name ?? "Bukti transit"}
                              width={176}
                              height={112}
                              unoptimized
                              className="h-28 w-44 object-cover"
                            />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}
      </main>

      <ChangePasswordModal
        open={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
      />
    </div>
  );
}
