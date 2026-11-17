import type { CustomerStatus } from "@/generated/prisma/enums";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string | null;
  status: CustomerStatus;
  created_at: Date;
  updated_at: Date;
}

export async function getCustomers(): Promise<CustomerItem[]> {
  await requirePermission("master:read");

  const customers = await prisma.customer.findMany({
    orderBy: { created_at: "desc" },
  });

  return customers;
}
