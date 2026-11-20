import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Duta Ekspedisi — Bali ⇄ Surabaya Cargo",
    short_name: "Duta Cargo",
    description:
      "Sistem Operasional Ekspedisi Cargo Bali ⇄ Surabaya (Gudang, Manifest, Tracking & POD)",
    start_url: "/dashboard",
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
