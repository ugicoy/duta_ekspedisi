"use client";

import bwipjs from "bwip-js";
import { useEffect, useRef } from "react";

interface BarcodeLabelGraphicProps {
  value: string;
  showQr?: boolean;
}

export function BarcodeLabelGraphic({
  value,
  showQr = true,
}: BarcodeLabelGraphicProps) {
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!value) return;

    if (barcodeCanvasRef.current) {
      try {
        bwipjs.toCanvas(barcodeCanvasRef.current, {
          bcid: "code128",
          text: value,
          scale: 2,
          height: 11,
          includetext: true,
          textxalign: "center",
          backgroundcolor: "ffffff",
          paddingwidth: 8,
          paddingheight: 6,
        });
      } catch (err) {
        console.error("Failed to render Code 128 barcode:", err);
      }
    }

    if (showQr && qrCanvasRef.current) {
      try {
        bwipjs.toCanvas(qrCanvasRef.current, {
          bcid: "qrcode",
          text: value,
          scale: 2,
          backgroundcolor: "ffffff",
          paddingwidth: 6,
          paddingheight: 6,
        });
      } catch (err) {
        console.error("Failed to render QR code:", err);
      }
    }
  }, [value, showQr]);

  return (
    <div className="inline-flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-white p-2.5 print:border-black">
      <canvas
        ref={barcodeCanvasRef}
        aria-label={`Barcode ${value}`}
        className="max-w-full"
      />
      {showQr && (
        <canvas
          ref={qrCanvasRef}
          aria-label={`QR Code ${value}`}
          className="h-16 w-16 shrink-0"
        />
      )}
    </div>
  );
}
