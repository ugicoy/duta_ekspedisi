import type { Metadata } from "next";
import { getSession } from "@/lib/session";
import { PublicPortal } from "@/modules/public/components/public-portal";
import { getPublicPortalInitialData } from "@/modules/public/public.queries";

export const metadata: Metadata = {
  title: "Duta Ekspedisi — Kargo Bali ⇄ Surabaya | Lacak Resi & Estimasi Tarif",
  description:
    "Layanan pengiriman barang cepat & terpantau rute Bali ⇄ Surabaya via Ketapang–Gilimanuk. Cek resi real-time dengan foto bukti transit dan hitung estimasi ongkir.",
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [initialData, session] = await Promise.all([
    getPublicPortalInitialData(),
    getSession(),
  ]);

  return (
    <PublicPortal initialData={initialData} isLoggedIn={Boolean(session)} />
  );
}
