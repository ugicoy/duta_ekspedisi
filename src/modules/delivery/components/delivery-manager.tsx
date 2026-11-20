"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { CameraBarcodeScanner } from "@/components/camera-barcode-scanner";
import { compressImageFileToDataUrl } from "@/lib/image-compress";
import { createDeliveryProofAction } from "../delivery.actions";
import type {
  DeliveryProofListItem,
  EligiblePodShipment,
} from "../delivery.queries";

interface DeliveryManagerProps {
  initialProofs: DeliveryProofListItem[];
  eligibleShipments: EligiblePodShipment[];
}

export function DeliveryManager({
  initialProofs,
  eligibleShipments,
}: DeliveryManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [scanQuery, setScanQuery] = useState("");
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [podPhotoDataUrl, setPodPhotoDataUrl] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  const [collectUnpaidConfirmed, setCollectUnpaidConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Tunai");

  const scanFieldId = useId();
  const recNameId = useId();
  const recPhoneId = useId();
  const notesId = useId();
  const payMethodId = useId();
  const podPhotoId = useId();

  const selectedUnpaidInfo = useMemo(() => {
    const selectedShipments = eligibleShipments.filter((s) =>
      selectedIds.includes(s.id),
    );
    const unpaidItems = selectedShipments.filter((s) => !s.isPaid);
    const totalDue = unpaidItems.reduce((sum, s) => sum + s.remainingAmount, 0);
    return { unpaidItems, totalDue };
  }, [eligibleShipments, selectedIds]);

  const applyShipmentSelection = (shipment: EligiblePodShipment) => {
    setSelectedIds((prev) => {
      if (prev.includes(shipment.id)) return prev;
      const next = [...prev, shipment.id];
      if (prev.length === 0) {
        setRecipientName(shipment.receiver.name);
        setRecipientPhone(shipment.receiver.phone);
      }
      return next;
    });
    setCollectUnpaidConfirmed(false);
  };

  const toggleShipment = (shipment: EligiblePodShipment) => {
    setError(null);
    setScanFeedback(null);

    if (selectedIds.includes(shipment.id)) {
      const next = selectedIds.filter((id) => id !== shipment.id);
      setSelectedIds(next);
      setCollectUnpaidConfirmed(false);
      if (next.length === 0) {
        setRecipientName("");
        setRecipientPhone("");
      }
    } else {
      applyShipmentSelection(shipment);
    }
  };

  const processCodeVerification = (rawCode: string) => {
    setError(null);
    setScanFeedback(null);

    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    const matched = eligibleShipments.find(
      (s) =>
        s.shipment_no.toUpperCase() === code ||
        s.barcode.toUpperCase() === code,
    );

    if (!matched) {
      setError(
        `Kode/Resi "${code}" tidak ditemukan dalam daftar barang yang siap diambil di gudang.`,
      );
      setScanQuery("");
      requestAnimationFrame(() => scanInputRef.current?.focus());
      return;
    }

    if (selectedIds.includes(matched.id)) {
      setScanFeedback(
        `Resi ${matched.shipment_no} sudah masuk dalam daftar serah terima.`,
      );
      setScanQuery("");
      requestAnimationFrame(() => scanInputRef.current?.focus());
      return;
    }

    applyShipmentSelection(matched);
    const payInfo = matched.isPaid
      ? "STATUS BAYAR: SUDAH TERBAYAR (LUNAS)"
      : `STATUS BAYAR: BELUM TERBAYAR — Tagih Rp ${matched.remainingAmount.toLocaleString("id-ID")}`;

    setScanFeedback(
      `Resi ${matched.shipment_no} (${matched.receiver.name}) terverifikasi • ${payInfo}.`,
    );
    setScanQuery("");
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };

  const processCodeRef = useRef(processCodeVerification);
  processCodeRef.current = processCodeVerification;

  useEffect(() => {
    scanInputRef.current?.focus();

    let hidBuffer = "";
    let lastKeyTime = 0;

    const handleGlobalScannerKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (
        activeTag === "INPUT" ||
        activeTag === "TEXTAREA" ||
        activeTag === "SELECT"
      ) {
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();
      if (now - lastKeyTime > 80) {
        hidBuffer = "";
      }
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (hidBuffer.length >= 4) {
          e.preventDefault();
          const scanned = hidBuffer;
          hidBuffer = "";
          processCodeRef.current(scanned);
        }
        return;
      }

      if (e.key.length === 1) {
        hidBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalScannerKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalScannerKeyDown);
    };
  }, []);

  const handlePodPhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 1280, 0.78);
      setPodPhotoDataUrl(compressed);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memproses foto serah terima.",
      );
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setScanFeedback(null);

    if (selectedIds.length === 0) {
      setError("Scan QR/barcode atau pilih minimal 1 resi terlebih dahulu.");
      return;
    }

    if (selectedUnpaidInfo.unpaidItems.length > 0 && !collectUnpaidConfirmed) {
      setError(
        `Terdapat tagihan belum terbayar sebesar Rp ${selectedUnpaidInfo.totalDue.toLocaleString("id-ID")}. Centang konfirmasi pelunasan sebelum menyerahkan paket.`,
      );
      return;
    }

    startTransition(async () => {
      const res = await createDeliveryProofAction({
        shipment_ids: selectedIds,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        notes,
        photo_data_url: podPhotoDataUrl,
        collect_unpaid_confirmed: collectUnpaidConfirmed,
        payment_method: paymentMethod,
      });

      if (!res.success) {
        setError(res.error ?? "Gagal mencatat bukti serah terima.");
        return;
      }

      setSelectedIds([]);
      setRecipientName("");
      setRecipientPhone("");
      setNotes("");
      setScanQuery("");
      setPodPhotoDataUrl(null);
      if (photoInputRef.current) {
        photoInputRef.current.value = "";
      }
      setCollectUnpaidConfirmed(false);
      router.refresh();
      requestAnimationFrame(() => scanInputRef.current?.focus());
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-white">
              Serah Terima Barang — Ambil di Tempat (Warehouse Pickup)
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Tempel/tembak barcode resi dengan USB Barcode Scanner atau kamera
              HP. Sistem otomatis mengecek status pembayaran resi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-800/70 bg-cyan-950/70 px-3 py-1 font-mono text-[11px] font-semibold text-cyan-300">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              USB SCANNER SIAP
            </span>
            <span className="inline-flex rounded-full border border-emerald-800/60 bg-emerald-950/70 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-300">
              METODE: AMBIL DI GUDANG
            </span>
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-lg border border-blue-800/50 bg-slate-950/80 p-3.5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <label
              htmlFor={scanFieldId}
              className="block text-xs font-medium text-blue-300"
            >
              Verifikasi USB Barcode Scanner / Kamera HP / Input Manual No. Resi
            </label>
            <CameraBarcodeScanner
              buttonLabel="Buka Kamera HP (Scan Resi)"
              onScan={(decodedText) => processCodeVerification(decodedText)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={scanInputRef}
              id={scanFieldId}
              type="text"
              autoComplete="off"
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  processCodeVerification(scanQuery);
                }
              }}
              placeholder="Arahkan USB Barcode Scanner ke label resi atau ketik No. Resi lalu Enter"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 font-mono text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => processCodeVerification(scanQuery)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Verifikasi Resi
            </button>
          </div>
        </div>

        {scanFeedback && (
          <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-950/70 px-3 py-2 text-xs text-emerald-300">
            {scanFeedback}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-red-800 bg-red-950/70 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="mb-2 text-xs font-medium text-slate-300">
              Daftar Barang Siap Diambil di Gudang ({eligibleShipments.length}{" "}
              tersedia • {selectedIds.length} dipilih)
            </div>

            {eligibleShipments.length === 0 ? (
              <p className="py-3 text-xs italic text-slate-500">
                Belum ada resi berstatus ARRIVED_AT_DESTINATION yang siap
                diambil.
              </p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {eligibleShipments.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex cursor-pointer flex-col justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition sm:flex-row sm:items-center ${
                        checked
                          ? "border-emerald-600 bg-emerald-950/40 text-white"
                          : "border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleShipment(s)}
                          className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950"
                        />
                        <div>
                          <span className="font-mono font-semibold text-blue-400">
                            {s.shipment_no}
                          </span>{" "}
                          •{" "}
                          <span className="font-medium text-white">
                            {s.receiver.name}
                          </span>{" "}
                          <span className="font-mono text-[11px] text-slate-400">
                            ({s.receiver.phone})
                          </span>
                          <div className="text-[11px] text-slate-400">
                            {s.goods_description} ({s.qty} koli • {s.weight} kg)
                            - Gudang: {s.destWarehouse.name}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {s.isPaid ? (
                          <span className="rounded-full border border-emerald-700/70 bg-emerald-950/80 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                            LUNAS (Rp {s.totalFee.toLocaleString("id-ID")})
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-700/80 bg-amber-950/90 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                            BELUM BAYAR: Rp{" "}
                            {s.remainingAmount.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {selectedUnpaidInfo.unpaidItems.length > 0 && (
            <div className="space-y-3 rounded-xl border-2 border-amber-600/80 bg-amber-950/50 p-4 text-xs">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <div className="font-bold text-amber-300">
                    PERHATIAN: PAKET BELUM TERBAYAR (BAYAR SAAT AMBIL)
                  </div>
                  <p className="mt-0.5 text-amber-100/90">
                    Terdapat {selectedUnpaidInfo.unpaidItems.length} resi yang
                    belum dilunasi. Tagih pembayaran sebelum barang diserahkan:
                  </p>
                </div>
                <div className="font-mono text-base font-extrabold text-amber-300">
                  Rp {selectedUnpaidInfo.totalDue.toLocaleString("id-ID")}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-center">
                <div>
                  <label
                    htmlFor={payMethodId}
                    className="block text-[11px] font-medium text-amber-200"
                  >
                    Metode Pembayaran Diterima di Gudang Tujuan
                  </label>
                  <select
                    id={payMethodId}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-amber-700/70 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="Tunai">Tunai / Cash di Gudang Tujuan</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                    <option value="QRIS / EDC">QRIS / Kartu Debit</option>
                  </select>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-700/70 bg-slate-950/80 p-3 text-xs text-white">
                  <input
                    type="checkbox"
                    checked={collectUnpaidConfirmed}
                    onChange={(e) =>
                      setCollectUnpaidConfirmed(e.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border-amber-600 bg-slate-900"
                  />
                  <span>
                    Saya konfirmasi pembayaran sebesar{" "}
                    <strong className="font-mono text-amber-300">
                      Rp {selectedUnpaidInfo.totalDue.toLocaleString("id-ID")}
                    </strong>{" "}
                    sudah diterima lunas dari pengambil paket.
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor={recNameId}
                className="block text-xs font-medium text-slate-300"
              >
                Nama Pengambil Barang
              </label>
              <input
                id={recNameId}
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Otomatis dari data penerima resi"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label
                htmlFor={recPhoneId}
                className="block text-xs font-medium text-slate-300"
              >
                No. HP Penerima (Otomatis dari Resi)
              </label>
              <input
                id={recPhoneId}
                type="text"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="Terisi otomatis saat resi dipilih"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
              />
            </div>

            <div>
              <label
                htmlFor={notesId}
                className="block text-xs font-medium text-slate-300"
              >
                Catatan Verifikasi (Opsional)
              </label>
              <input
                id={notesId}
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: KTP penerima sesuai / Diambil wakil"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5">
            <label
              htmlFor={podPhotoId}
              className="block text-xs font-medium text-slate-300"
            >
              Foto Bukti Serah Terima / Pengambil Paket (Tersimpan ke Cloudflare
              R2)
            </label>
            <input
              ref={photoInputRef}
              id={podPhotoId}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePodPhotoChange}
              className="mt-1.5 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
            />
            {isCompressingPhoto && (
              <p className="mt-1.5 text-xs text-blue-400">
                Memproses foto bukti serah terima...
              </p>
            )}
            {podPhotoDataUrl && (
              <div className="mt-2.5 flex items-center gap-3">
                <Image
                  src={podPhotoDataUrl}
                  alt="Preview bukti POD"
                  width={112}
                  height={80}
                  unoptimized
                  className="h-20 w-28 rounded-lg border border-slate-700 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPodPhotoDataUrl(null);
                    if (photoInputRef.current) photoInputRef.current.value = "";
                  }}
                  className="rounded border border-red-800/60 bg-red-950/60 px-2.5 py-1 text-[11px] text-red-300"
                >
                  Hapus Foto
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                isPending ||
                isCompressingPhoto ||
                selectedIds.length === 0 ||
                (selectedUnpaidInfo.unpaidItems.length > 0 &&
                  !collectUnpaidConfirmed)
              }
              className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isPending
                ? "Menyimpan POD..."
                : `Konfirmasi Pengambilan (${selectedIds.length} Resi)`}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/60 uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">No. POD</th>
                <th className="px-4 py-3 font-semibold">
                  Pengambil / Penerima
                </th>
                <th className="px-4 py-3 font-semibold">Daftar Resi</th>
                <th className="px-4 py-3 font-semibold">Bukti Foto</th>
                <th className="px-4 py-3 font-semibold">Catatan</th>
                <th className="px-4 py-3 font-semibold">Waktu Pengambilan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initialProofs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center italic text-slate-500"
                  >
                    Belum ada catatan bukti serah terima (POD).
                  </td>
                </tr>
              ) : (
                initialProofs.map((pod) => (
                  <tr key={pod.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-400">
                      {pod.proof_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {pod.recipient_name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {pod.recipient_phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {pod.items.map((item) => (
                          <Link
                            key={item.id}
                            href={`/dashboard/shipments/${item.shipment.id}`}
                            className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-blue-400 hover:border-blue-500"
                          >
                            {item.shipment.shipment_no}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {pod.photo_url ? (
                        <a
                          href={pod.photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-emerald-700/70 bg-emerald-950/60 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/60"
                        >
                          📷 Lihat Foto
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {pod.notes ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      {new Date(pod.signed_at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
