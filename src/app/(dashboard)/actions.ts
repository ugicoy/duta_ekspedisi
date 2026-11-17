"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth-guard";
import { updateActiveWarehouse } from "@/lib/session";

export async function switchActiveWarehouseAction(warehouseId: string) {
  await getCurrentSession();
  const success = await updateActiveWarehouse(warehouseId);
  if (success) {
    revalidatePath("/", "layout");
  }
  return { success };
}
