import type { MetadataRoute } from "next";

export default function driverManifest(): MetadataRoute.Manifest {
  return {
    name: "Duta Driver — Armada Bali ⇄ Surabaya",
    short_name: "Duta Driver",
    description:
      "Aplikasi Lapangan Supir Duta Ekspedisi untuk Checkpoint Pelabuhan & Bukti Foto Transit",
    start_url: "/driver",
    scope: "/driver",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
