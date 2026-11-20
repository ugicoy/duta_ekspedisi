import { ScanTerminal } from "@/modules/scan/components/scan-terminal";
import { getScanPageData } from "@/modules/scan/scan.queries";

export default async function ScanPage() {
  const { warehouses, recentLogs } = await getScanPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Scan Barcode Gudang
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Pemindaian cepat penerimaan barang masuk gudang asal, bongkaran gudang
          tujuan, dan verifikasi stok fisik.
        </p>
      </div>

      <ScanTerminal warehouses={warehouses} initialLogs={recentLogs} />
    </div>
  );
}
