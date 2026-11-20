import type { Metadata } from "next";
import { DriverPortal } from "@/modules/driver/components/driver-portal";
import { getDriverPortalData } from "@/modules/driver/driver.queries";

export const metadata: Metadata = {
  title: "Duta Driver PWA — Checkpoint Pelabuhan",
  description: "Update status transit pelabuhan & unggah foto bukti armada",
  manifest: "/driver/manifest.webmanifest",
};

export default async function DriverPwaPage() {
  const data = await getDriverPortalData();
  return <DriverPortal data={data} />;
}
