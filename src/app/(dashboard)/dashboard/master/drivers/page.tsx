import {
  getAvailableDriverUsers,
  getDrivers,
} from "@/modules/drivers/driver.queries";

// Thin Server Component Route for Drivers Master Data
export default async function DriversPage() {
  const [drivers, availableUsers] = await Promise.all([
    getDrivers(),
    getAvailableDriverUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Manajemen Driver
          </h1>
          <p className="text-muted-foreground">
            Kelola data driver ekspedisi dan penautan akun login user role
            DRIVER.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-sm text-muted-foreground">
          {/* DriverTable component will be integrated here in the next session */}
          <p className="font-medium text-foreground">
            Total Driver terdaftar: {drivers.length} | User Driver tersedia:{" "}
            {availableUsers.length}
          </p>
          <p className="mt-2">
            Modul backend dan queries/actions telah siap sepenuhnya. Komponen UI
            DriverTable akan diimplementasikan pada sesi berikutnya.
          </p>
        </div>
      </div>
    </div>
  );
}
