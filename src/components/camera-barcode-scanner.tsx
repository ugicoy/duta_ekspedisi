"use client";

import {
  type CameraDevice,
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { useEffect, useId, useRef, useState } from "react";

interface CameraBarcodeScannerProps {
  onScan: (decodedText: string) => void;
  autoCloseOnScan?: boolean;
  buttonLabel?: string;
}

function playScanBeep() {
  try {
    const AudioCtx =
      window.AudioContext ??
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Abaikan jika browser memblokir audio otomatis
  }
}

export function CameraBarcodeScanner({
  onScan,
  autoCloseOnScan = false,
  buttonLabel = "Buka Kamera HP",
}: CameraBarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraError, setCameraError] = useState("");
  const [lastDetected, setLastDetected] = useState("");

  const rawId = useId();
  const scannerRegionId = `qr-reader-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const cameraSelectId = useId();

  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const lastScanRef = useRef<{ code: string; timestamp: number }>({
    code: "",
    timestamp: 0,
  });

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const scanner = new Html5Qrcode(scannerRegionId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.ITF,
      ],
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
      verbose: false,
    });

    const startCamera = async () => {
      setCameraError("");
      setLastDetected("");

      try {
        const availableCameras = await Html5Qrcode.getCameras();
        if (isMounted && availableCameras.length > 0) {
          setCameras(availableCameras);
        }

        const cameraTarget: string | MediaTrackConstraints =
          selectedCameraId !== ""
            ? selectedCameraId
            : { facingMode: "environment" };

        await scanner.start(
          cameraTarget,
          {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => ({
              width: Math.max(220, Math.floor(viewfinderWidth * 0.92)),
              height: Math.max(140, Math.floor(viewfinderHeight * 0.72)),
            }),
            videoConstraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          (decodedText) => {
            const cleaned = decodedText.trim();
            if (!cleaned) return;

            const now = Date.now();
            if (
              lastScanRef.current.code === cleaned &&
              now - lastScanRef.current.timestamp < 2500
            ) {
              return;
            }

            lastScanRef.current = { code: cleaned, timestamp: now };
            if (isMounted) {
              setLastDetected(cleaned);
            }
            playScanBeep();
            onScanRef.current(cleaned);

            if (autoCloseOnScan && isMounted) {
              setIsOpen(false);
            }
          },
          () => {
            // Abaikan error per-frame saat kamera mencari fokus barcode
          },
        );
      } catch (err) {
        console.error("Camera scanner error:", err);
        if (isMounted) {
          setCameraError(
            "Gagal mengakses kamera. Pastikan izin kamera di browser diizinkan dan tidak sedang dipakai aplikasi lain.",
          );
        }
      }
    };

    void startCamera();

    return () => {
      isMounted = false;
      if (scanner.isScanning) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => {});
      } else {
        try {
          scanner.clear();
        } catch {
          // Abaikan jika sudah dibersihkan
        }
      }
    };
  }, [isOpen, autoCloseOnScan, scannerRegionId, selectedCameraId]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition ${
            isOpen
              ? "border border-rose-700 bg-rose-950/70 text-rose-200 hover:bg-rose-900/70"
              : "border border-cyan-700/70 bg-cyan-950/60 text-cyan-200 hover:bg-cyan-900/60"
          }`}
        >
          <span>📷</span>
          <span>{isOpen ? "Tutup Kamera HP" : buttonLabel}</span>
        </button>

        {isOpen && cameras.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor={cameraSelectId} className="sr-only">
              Pilih Kamera
            </label>
            <select
              id={cameraSelectId}
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200"
            >
              <option value="">Kamera Utama (Otomatis)</option>
              {cameras.map((cam, idx) => (
                <option key={cam.id} value={cam.id}>
                  {cam.label || `Kamera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="rounded-xl border border-cyan-800/70 bg-slate-950 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>
              Sisakan ruang putih di kiri &amp; kanan{" "}
              <strong className="text-white">Barcode</strong> atau tampilkan{" "}
              <strong className="text-white">QR Code</strong> secara utuh
            </span>
            <span className="font-mono text-cyan-400">HD WIDE-SCAN</span>
          </div>

          <div
            id={scannerRegionId}
            className="mx-auto max-w-lg overflow-hidden rounded-lg bg-black"
          />

          {lastDetected !== "" && (
            <div className="mt-2 rounded-lg border border-cyan-800/80 bg-cyan-950/50 px-3 py-1.5 font-mono text-xs text-cyan-200">
              Terbaca kamera: <strong>{lastDetected}</strong>
            </div>
          )}

          {cameraError !== "" && (
            <div className="mt-2 rounded-lg border border-red-800 bg-red-950/70 px-3 py-2 text-xs text-red-300">
              {cameraError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
