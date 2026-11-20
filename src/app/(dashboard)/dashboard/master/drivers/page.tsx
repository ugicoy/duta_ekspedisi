import { DriverTable } from "@/modules/drivers/components/driver-table";
import {
  getAvailableDriverUsers,
  getDrivers,
} from "@/modules/drivers/driver.queries";

export default async function DriversPage() {
  const [drivers, availableUsers] = await Promise.all([
    getDrivers(),
    getAvailableDriverUsers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Manajemen Driver
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola data driver ekspedisi dan penautan akun login user role DRIVER.
        </p>
      </div>

      <DriverTable
        initialDrivers={drivers}
        availableUsers={availableUsers}
      />
    </div>
  );
}