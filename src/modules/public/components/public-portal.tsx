"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState, useTransition } from "react";
import { trackPublicShipmentAction } from "../public.actions";
import type {
  PublicPortalInitialData,
  PublicTrackingResult,
} from "../public.queries";
import { RouteVisualizer } from "./route-visualizer";

interface PublicPortalProps {
  initialData: PublicPortalInitialData;
  isLoggedIn: boolean;
}

const STATUS_LABELS: Record<
  string,
  { label: string; step: number; badgeClass: string }
> = {
  DRAFT: {
    label: "Terdaftar di Sistem",
    step: 1,
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
  },
  BOOKED: {
    label: "Booking Diterima",
    step: 1,
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  RECEIVED_AT_ORIGIN: {
    label: "Diterima di Gudang Asal",
    step: 1,
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  MANIFESTED: {
    label: "Dimuat ke Armada",
    step: 2,
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  IN_TRANSIT: {
    label: "Dalam Perjalanan / Penyeberangan",
    step: 3,
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
  },
  ARRIVED_AT_DESTINATION: {
    label: "Tiba di Gudang Tujuan",
    step: 4,
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-300",
  },
  OUT_FOR_DELIVERY: {
    label: "Sedang Diantar Kurir",
    step: 4,
    badgeClass: "bg-teal-50 text-teal-800 border-teal-300",
  },
  DELIVERED: {
    label: "Selesai / Sudah Diterima (POD)",
    step: 5,
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
  },
  CANCELLED: {
    label: "Dibatalkan",
    step: 0,
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  RETURNED: {
    label: "Diretur ke Pengirim",
    step: 0,
    badgeClass: "bg-orange-50 text-orange-800 border-orange-200",
  },
};

const PROGRESS_STEPS = [
  "Gudang Asal",
  "Muat Armada",
  "Selat Bali",
  "Gudang Tujuan",
  "Diterima",
];

export function PublicPortal({ initialData, isLoggedIn }: PublicPortalProps) {
  const { settings, warehouses, tariffs } = initialData;

  const [routeDirection, setRouteDirection] = useState<
    "SBY_TO_DPS" | "DPS_TO_SBY"
  >("SBY_TO_DPS");
  const [activeTab, setActiveTab] = useState<"TRACKING" | "ESTIMASI">(
    "TRACKING",
  );

  // State Lacak Resi
  const [trackingQuery, setTrackingQuery] = useState("");
  const [trackingResult, setTrackingResult] =
    useState<PublicTrackingResult | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [isTrackingPending, startTrackingTransition] = useTransition();

  // State Kalkulator Tarif
  const availableCities = useMemo(() => {
    const citySet = new Set<string>();
    for (const w of warehouses) {
      if (w.city) citySet.add(w.city);
    }
    for (const t of tariffs) {
      if (t.origin_city) citySet.add(t.origin_city);
      if (t.dest_city) citySet.add(t.dest_city);
    }
    if (citySet.size === 0) {
      citySet.add("Surabaya");
      citySet.add("Denpasar");
    }
    return Array.from(citySet);
  }, [warehouses, tariffs]);

  const [originCity, setOriginCity] = useState(
    availableCities.find((c) => c.toLowerCase().includes("surabaya")) ??
      availableCities[0] ??
      "Surabaya",
  );
  const [destCity, setDestCity] = useState(
    availableCities.find(
      (c) =>
        c.toLowerCase().includes("denpasar") ||
        c.toLowerCase().includes("bali"),
    ) ??
      availableCities[1] ??
      "Denpasar",
  );

  const matchingTariffs = useMemo(() => {
    return tariffs.filter(
      (t) =>
        t.origin_city.toLowerCase() === originCity.toLowerCase() &&
        t.dest_city.toLowerCase() === destCity.toLowerCase(),
    );
  }, [tariffs, originCity, destCity]);

  const [selectedTariffId, setSelectedTariffId] = useState("");
  const [actualWeight, setActualWeight] = useState("25");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [koliCount, setKoliCount] = useState("1");

  const trackInputId = useId();
  const originSelectId = useId();
  const destSelectId = useId();
  const tariffSelectId = useId();
  const weightInputId = useId();
  const koliInputId = useId();
  const lengthInputId = useId();
  const widthInputId = useId();
  const heightInputId = useId();

  const activeTariff = useMemo(() => {
    if (matchingTariffs.length === 0) return null;
    return (
      matchingTariffs.find((t) => t.id === selectedTariffId) ??
      matchingTariffs[0]
    );
  }, [matchingTariffs, selectedTariffId]);

  // Kalkulasi Ongkir Real-Time
  const estimation = useMemo(() => {
    const weightNum = Math.max(0, Number(actualWeight) || 0);
    const qtyNum = Math.max(1, Math.floor(Number(koliCount) || 1));
    const p = Math.max(0, Number(lengthCm) || 0);
    const l = Math.max(0, Number(widthCm) || 0);
    const t = Math.max(0, Number(heightCm) || 0);

    const volumetricWeight =
      p > 0 && l > 0 && t > 0
        ? ((p * l * t) / settings.volumetricDivisor) * qtyNum
        : 0;

    const cbmTotal =
      p > 0 && l > 0 && t > 0 ? ((p * l * t) / 1_000_000) * qtyNum : 0;

    if (!activeTariff) {
      return {
        hasTariff: false,
        actualWeight: weightNum,
        volumetricWeight,
        chargeableWeight: Math.max(weightNum, volumetricWeight),
        cbmTotal,
        estimatedCost: 0,
        ratePerKg: 0,
        minWeight: 1,
        minFee: 0,
      };
    }

    const rawMaxWeight = Math.max(weightNum, volumetricWeight);
    const chargeableWeight = Math.max(rawMaxWeight, activeTariff.min_weight);
    const byWeightCost = chargeableWeight * activeTariff.rate_per_kg;
    const byCbmCost =
      activeTariff.rate_per_cbm > 0 && cbmTotal > 0
        ? Math.max(cbmTotal, activeTariff.min_volume) *
          activeTariff.rate_per_cbm
        : 0;

    const rawCost = Math.max(byWeightCost, byCbmCost, activeTariff.min_fee);
    const estimatedCost = Math.ceil(rawCost / 500) * 500;

    return {
      hasTariff: true,
      actualWeight: weightNum,
      volumetricWeight,
      chargeableWeight,
      cbmTotal,
      estimatedCost,
      ratePerKg: activeTariff.rate_per_kg,
      minWeight: activeTariff.min_weight,
      minFee: activeTariff.min_fee,
    };
  }, [
    actualWeight,
    koliCount,
    lengthCm,
    widthCm,
    heightCm,
    settings.volumetricDivisor,
    activeTariff,
  ]);

  const handleTrackSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTrackingError(null);
    setTrackingResult(null);

    startTrackingTransition(async () => {
      const res = await trackPublicShipmentAction(trackingQuery);
      if (!res.success || !res.data) {
        setTrackingError(res.error ?? "Resi tidak ditemukan.");
        return;
      }
      setTrackingResult(res.data);
    });
  };

  const handleSwapCities = () => {
    setOriginCity(destCity);
    setDestCity(originCity);
    setSelectedTariffId("");
  };

  const whatsappBookingHref = useMemo(() => {
    const text = estimation.hasTariff
      ? `Halo Admin ${settings.companyName}, saya ingin tanya/booking pengiriman:\n• Rute: ${originCity} → ${destCity}\n• Layanan: ${activeTariff?.pricing_type_name ?? "-"} (${activeTariff?.item_type ?? "-"})\n• Berat Hitung: ${estimation.chargeableWeight.toFixed(1)} kg (${koliCount} koli)\n• Estimasi Tarif Web: Rp ${estimation.estimatedCost.toLocaleString("id-ID")}`
      : `Halo Admin ${settings.companyName}, saya ingin menanyakan tarif pengiriman rute ${originCity} → ${destCity}.`;

    return `https://wa.me/${settings.csWhatsapp}?text=${encodeURIComponent(text)}`;
  }, [
    settings.companyName,
    settings.csWhatsapp,
    originCity,
    destCity,
    activeTariff,
    estimation,
    koliCount,
  ]);

  const currentStatusMeta = trackingResult
    ? (STATUS_LABELS[trackingResult.status] ?? {
        label: trackingResult.status,
        step: 1,
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
      })
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style>{`
        @keyframes marqueeSlide {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee-track {
          display: flex;
          width: max-content;
          animation: marqueeSlide 28s linear infinite;
        }
        .animate-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 text-base font-black text-slate-950 shadow-lg">
              DE
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-white sm:text-base">
                {settings.companyName}
              </div>
              <div className="text-[11px] text-cyan-300">
                Spesialis Kargo Bali ⇄ Surabaya
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-medium text-slate-300 md:flex">
            <button
              type="button"
              onClick={() => {
                setActiveTab("TRACKING");
                document
                  .getElementById("action-console")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-white"
            >
              Lacak Resi
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("ESTIMASI");
                document
                  .getElementById("action-console")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-white"
            >
              Estimasi Tarif
            </button>
            <a href="#lokasi-gudang" className="hover:text-white">
              Lokasi Gudang
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/${settings.csWhatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 sm:inline-flex"
            >
              WhatsApp CS
            </a>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-500"
            >
              {isLoggedIn ? "Ke Dashboard" : "Portal Staff"}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section (Dark Navy Contrast + Animated Route Map) */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 pb-16 pt-10 text-white sm:pb-20 sm:pt-14">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/80 px-3.5 py-1.5 text-xs font-medium text-blue-200">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Pengiriman Darat & Penyeberangan Ketapang – Gilimanuk
            </div>

            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              Kargo Cepat & Terpantau{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-amber-300 bg-clip-text text-transparent">
                Bali ⇄ Surabaya
              </span>
            </h1>

            <p className="max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Lacak posisi paket secara real-time lengkap dengan{" "}
              <strong className="text-white">
                foto bukti transit pelabuhan
              </strong>{" "}
              dan foto serah terima barang, atau hitung estimasi biaya kirim
              langsung dari halaman ini.
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("TRACKING");
                  document
                    .getElementById("action-console")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-xl bg-amber-400 px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300"
              >
                🔍 Lacak Nomor Resi
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("ESTIMASI");
                  document
                    .getElementById("action-console")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-5 py-3 text-xs font-bold uppercase tracking-wide text-white transition hover:border-blue-400 hover:bg-slate-800"
              >
                🧮 Hitung Estimasi Ongkir
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <RouteVisualizer
              direction={routeDirection}
              onChangeDirection={setRouteDirection}
            />
          </div>
        </div>
      </section>

      {/* Running Marquee Ticker */}
      <div className="overflow-hidden border-y border-slate-200 bg-white py-3 shadow-xs">
        <div className="animate-marquee-track gap-10 text-xs font-semibold text-slate-700">
          {[1, 2].map((loopIdx) => (
            <div key={loopIdx} className="flex shrink-0 items-center gap-10">
              <span className="flex items-center gap-2">
                <span className="text-blue-600">🚚</span> Keberangkatan Rutin
                Surabaya ⇄ Denpasar
              </span>
              <span className="flex items-center gap-2">
                <span className="text-amber-500">⛴️</span> Update Foto Checkpoint
                Pelabuhan Ketapang & Gilimanuk
              </span>
              <span className="flex items-center gap-2">
                <span className="text-emerald-600">📷</span> Bukti Foto Serah
                Terima (POD) Digital
              </span>
              <span className="flex items-center gap-2">
                <span className="text-indigo-600">📦</span> Terima Paket Eceran,
                Koli Konsolidasi & Muatan Partai
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Interactive Console: Tab Lacak Resi + Tab Estimasi Tarif */}
      <main
        id="action-console"
        className="mx-auto -mt-4 max-w-5xl px-4 pb-16 pt-10 sm:px-6"
      >
        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-xl">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100/80 p-1.5">
            <button
              type="button"
              onClick={() => setActiveTab("TRACKING")}
              className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-extrabold uppercase tracking-wide transition sm:text-sm ${
                activeTab === "TRACKING"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📦</span>
              <span>Lacak Resi Pengiriman</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ESTIMASI")}
              className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-extrabold uppercase tracking-wide transition sm:text-sm ${
                activeTab === "ESTIMASI"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🧮</span>
              <span>Kalkulator Estimasi Tarif</span>
            </button>
          </div>

          {/* KONTEN TAB 1: LACAK RESI */}
          {activeTab === "TRACKING" && (
            <div className="p-5 sm:p-8">
              <form
                onSubmit={handleTrackSubmit}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <div className="flex-1">
                  <label htmlFor={trackInputId} className="sr-only">
                    Nomor Resi Pengiriman
                  </label>
                  <input
                    id={trackInputId}
                    type="text"
                    required
                    value={trackingQuery}
                    onChange={(e) => setTrackingQuery(e.target.value)}
                    placeholder="Masukkan Nomor Resi (Contoh: DE-SBY-20260501-0001)"
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3.5 font-mono text-sm text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isTrackingPending}
                  className="rounded-2xl bg-blue-700 px-7 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-600 disabled:opacity-50"
                >
                  {isTrackingPending ? "Melacak..." : "Lacak Paket"}
                </button>
              </form>

              {trackingError && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 sm:text-sm">
                  {trackingError}
                </div>
              )}

              {trackingResult && currentStatusMeta && (
                <div className="mt-7 space-y-6 border-t border-slate-200 pt-6">
                  {/* Ringkasan Resi */}
                  <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Nomor Resi
                      </div>
                      <div className="mt-0.5 font-mono text-xl font-extrabold text-slate-900">
                        {trackingResult.shipment_no}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        Layanan: <strong>{trackingResult.service_name}</strong>{" "}
                        • {trackingResult.qty} Koli • {trackingResult.weight} kg
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <span
                        className={`inline-flex rounded-full border px-3.5 py-1.5 text-xs font-bold ${currentStatusMeta.badgeClass}`}
                      >
                        {currentStatusMeta.label}
                      </span>
                      <div className="mt-1.5 text-[11px] text-slate-500">
                        Update terakhir:{" "}
                        {new Date(trackingResult.updated_at).toLocaleString(
                          "id-ID",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          },
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Step Progress Bar */}
                  {currentStatusMeta.step > 0 && (
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                      {PROGRESS_STEPS.map((stepLabel, idx) => {
                        const stepNum = idx + 1;
                        const isDone = stepNum <= currentStatusMeta.step;
                        return (
                          <div key={stepLabel} className="space-y-1.5">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isDone ? "bg-blue-600" : "bg-slate-200"
                              }`}
                            />
                            <div
                              className={`text-center text-[10px] font-semibold sm:text-xs ${
                                isDone ? "text-blue-700" : "text-slate-400"
                              }`}
                            >
                              {stepLabel}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Detail Pengirim & Penerima */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        Asal & Pengirim
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {trackingResult.origin_city}
                      </div>
                      <div className="text-xs text-slate-600">
                        {trackingResult.sender_name}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {trackingResult.origin_warehouse}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        Tujuan & Penerima
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {trackingResult.dest_city}
                      </div>
                      <div className="text-xs text-slate-600">
                        {trackingResult.receiver_name}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {trackingResult.dest_warehouse}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="text-[11px] font-semibold uppercase text-slate-400">
                        Keterangan Muatan
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-900">
                        {trackingResult.goods_description}
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate-600">
                        {trackingResult.qty} Koli • {trackingResult.weight} kg •{" "}
                        {trackingResult.volume} m³
                      </div>
                    </div>
                  </div>

                  {/* Bukti Serah Terima (POD) jika sudah DELIVERED */}
                  {trackingResult.pod && (
                    <div className="flex flex-col justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 sm:flex-row sm:items-center">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                          ✅ Bukti Serah Terima (POD) •{" "}
                          {trackingResult.pod.proof_number}
                        </div>
                        <p className="mt-1 text-xs text-emerald-900">
                          Diterima oleh:{" "}
                          <strong>{trackingResult.pod.recipient_name}</strong>{" "}
                          pada{" "}
                          {new Date(
                            trackingResult.pod.signed_at,
                          ).toLocaleString("id-ID", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>

                      {trackingResult.pod.photo_url && (
                        <a
                          href={trackingResult.pod.photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-3 self-start rounded-xl border border-emerald-300 bg-white p-2 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-50"
                        >
                          <Image
                            src={trackingResult.pod.photo_url}
                            alt="Foto bukti serah terima barang"
                            width={64}
                            height={48}
                            unoptimized
                            className="h-12 w-16 rounded-lg object-cover"
                          />
                          <span>Lihat Foto POD ↗</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Timeline Riwayat Perjalanan + Foto Checkpoint Pelabuhan */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Riwayat Perjalanan & Checkpoint Pelabuhan
                    </h3>
                    <div className="mt-4 space-y-4 border-l-2 border-blue-200 pl-5">
                      {trackingResult.timeline.length === 0 ? (
                        <p className="text-xs italic text-slate-500">
                          Belum ada riwayat pergerakan paket.
                        </p>
                      ) : (
                        trackingResult.timeline.map((ev, index) => (
                          <div key={ev.id} className="relative">
                            <span
                              className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white ${
                                index === 0 ? "bg-blue-600" : "bg-slate-400"
                              }`}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {ev.description}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500">
                                {new Date(ev.created_at).toLocaleString(
                                  "id-ID",
                                  {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                  },
                                )}
                              </span>
                            </div>
                            {ev.location && (
                              <div className="mt-0.5 text-xs text-slate-600">
                                📍 Lokasi: {ev.location}
                              </div>
                            )}
                            {ev.photo_url && (
                              <a
                                href={ev.photo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-2 inline-block overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-xs transition hover:opacity-90"
                              >
                                <Image
                                  src={ev.photo_url}
                                  alt={
                                    ev.location ??
                                    "Foto bukti checkpoint pelabuhan"
                                  }
                                  width={200}
                                  height={120}
                                  unoptimized
                                  className="h-28 w-48 object-cover"
                                />
                              </a>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* KONTEN TAB 2: KALKULATOR ESTIMASI TARIF */}
          {activeTab === "ESTIMASI" && (
            <div className="grid grid-cols-1 gap-6 p-5 sm:p-8 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-7">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-11 sm:items-end">
                  <div className="sm:col-span-5">
                    <label
                      htmlFor={originSelectId}
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Kota Asal
                    </label>
                    <select
                      id={originSelectId}
                      value={originCity}
                      onChange={(e) => {
                        setOriginCity(e.target.value);
                        setSelectedTariffId("");
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    >
                      {availableCities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-center sm:col-span-1">
                    <button
                      type="button"
                      onClick={handleSwapCities}
                      title="Tukar kota asal & tujuan"
                      aria-label="Tukar kota asal dan tujuan"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      ⇄
                    </button>
                  </div>

                  <div className="sm:col-span-5">
                    <label
                      htmlFor={destSelectId}
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Kota Tujuan
                    </label>
                    <select
                      id={destSelectId}
                      value={destCity}
                      onChange={(e) => {
                        setDestCity(e.target.value);
                        setSelectedTariffId("");
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    >
                      {availableCities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={tariffSelectId}
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Jenis Layanan & Kategori Barang
                  </label>
                  <select
                    id={tariffSelectId}
                    value={activeTariff?.id ?? ""}
                    onChange={(e) => setSelectedTariffId(e.target.value)}
                    disabled={matchingTariffs.length === 0}
                    className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:opacity-60"
                  >
                    {matchingTariffs.length === 0 ? (
                      <option value="">
                        Belum ada daftar tarif untuk rute {originCity} →{" "}
                        {destCity}
                      </option>
                    ) : (
                      matchingTariffs.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.pricing_type_name} — {t.item_type} (Rp{" "}
                          {t.rate_per_kg.toLocaleString("id-ID")}/kg • Min{" "}
                          {t.min_weight} kg)
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor={weightInputId}
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Total Berat Aktual (kg)
                    </label>
                    <input
                      id={weightInputId}
                      type="number"
                      min="0"
                      step="0.5"
                      value={actualWeight}
                      onChange={(e) => setActualWeight(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={koliInputId}
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Jumlah Koli / Paket
                    </label>
                    <input
                      id={koliInputId}
                      type="number"
                      min="1"
                      step="1"
                      value={koliCount}
                      onChange={(e) => setKoliCount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="text-xs font-semibold text-slate-700">
                    Dimensi per Koli (Opsional — untuk hitung berat volume)
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2.5">
                    <div>
                      <label
                        htmlFor={lengthInputId}
                        className="block text-[11px] text-slate-500"
                      >
                        Panjang (cm)
                      </label>
                      <input
                        id={lengthInputId}
                        type="number"
                        min="0"
                        value={lengthCm}
                        onChange={(e) => setLengthCm(e.target.value)}
                        placeholder="0"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={widthInputId}
                        className="block text-[11px] text-slate-500"
                      >
                        Lebar (cm)
                      </label>
                      <input
                        id={widthInputId}
                        type="number"
                        min="0"
                        value={widthCm}
                        onChange={(e) => setWidthCm(e.target.value)}
                        placeholder="0"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={heightInputId}
                        className="block text-[11px] text-slate-500"
                      >
                        Tinggi (cm)
                      </label>
                      <input
                        id={heightInputId}
                        type="number"
                        min="0"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        placeholder="0"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Rumus volumetrik: (P × L × T) ÷{" "}
                    {settings.volumetricDivisor.toLocaleString("id-ID")} ×
                    jumlah koli.
                  </p>
                </div>
              </div>

              {/* Kartu Hasil Simulasi Tarif */}
              <div className="flex flex-col justify-between rounded-2xl border border-blue-200 bg-gradient-to-br from-slate-900 to-blue-950 p-5 text-white lg:col-span-5">
                <div className="space-y-4">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-300">
                      Simulasi Estimasi Biaya
                    </div>
                    <div className="mt-1 text-base font-bold">
                      {originCity} → {destCity}
                    </div>
                  </div>

                  {estimation.hasTariff ? (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-xs text-slate-300">
                          Perkiraan Total Ongkos Kirim
                        </div>
                        <div className="mt-1 font-mono text-3xl font-extrabold text-amber-300">
                          Rp {estimation.estimatedCost.toLocaleString("id-ID")}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-300">
                          Tarif dasar: Rp{" "}
                          {estimation.ratePerKg.toLocaleString("id-ID")}/kg
                          (Min. {estimation.minWeight} kg)
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-slate-300">
                        <div className="flex justify-between">
                          <span>Berat Aktual:</span>
                          <span className="font-mono font-semibold text-white">
                            {estimation.actualWeight.toFixed(1)} kg
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Berat Volumetrik:</span>
                          <span className="font-mono font-semibold text-white">
                            {estimation.volumetricWeight.toFixed(1)} kg
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-2">
                          <span>Berat Dihitung (Chargeable):</span>
                          <span className="font-mono font-bold text-cyan-300">
                            {estimation.chargeableWeight.toFixed(1)} kg
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                      Tarif otomatis untuk rute{" "}
                      <strong>
                        {originCity} → {destCity}
                      </strong>{" "}
                      belum tersedia di sistem. Silakan hubungi admin kami via
                      WhatsApp untuk penawaran harga terbaik.
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-2.5">
                  <a
                    href={whatsappBookingHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-slate-950 shadow-lg transition hover:bg-emerald-400"
                  >
                    <span>💬</span>
                    <span>Pesan / Tanya via WhatsApp</span>
                  </a>
                  <p className="text-center text-[10px] text-slate-400">
                    *Hasil merupakan estimasi; berat final ditimbang ulang saat
                    penerimaan di gudang.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lokasi Gudang Cabang Bali & Surabaya */}
        <section id="lokasi-gudang" className="mt-14 space-y-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                Lokasi Gudang Drop-Off & Pengambilan
              </h2>
              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                Jam Operasional: <strong>{settings.operationalHours}</strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700">
                CABANG SURABAYA (JAWA TIMUR)
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                Gudang Konsolidasi Surabaya
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
                {settings.surabayaAddress}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 font-mono text-xs font-bold text-amber-800">
                CABANG BALI (DENPASAR)
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">
                Gudang Konsolidasi Denpasar
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
                {settings.baliAddress}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div>
            © {new Date().getFullYear()}{" "}
            <strong className="text-slate-800">{settings.companyName}</strong>.
            Layanan Kargo & Ekspedisi Bali ⇄ Surabaya.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-slate-800">
              Login Admin / Gudang
            </Link>
            <Link href="/driver" className="hover:text-slate-800">
              Portal Driver PWA
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
