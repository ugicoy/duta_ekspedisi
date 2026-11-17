import { CustomerTable } from "@/modules/customers/components/customer-table";
import { getCustomers } from "@/modules/customers/customer.queries";

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Manajemen Customer
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Kelola data pengirim dan penerima kargo rute Bali ⇄ Surabaya.
        </p>
      </div>

      <CustomerTable initialCustomers={customers} />
    </div>
  );
}
