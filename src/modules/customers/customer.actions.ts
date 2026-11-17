"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { CustomerStatus } from "@/generated/prisma/enums";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const customerSchema = z.object({
  name: z.string().min(2, "Nama customer minimal 2 karakter"),
  phone: z.string().min(8, "Nomor telepon minimal 8 digit"),
  address: z.string().min(5, "Alamat minimal 5 karakter"),
  email: z
    .string()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]).default("ACTIVE"),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export async function createCustomerAction(data: CustomerInput) {
  const session = await requirePermission("master:manage");

  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data customer tidak valid.",
    };
  }

  try {
    const newCustomer = await prisma.customer.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        address: parsed.data.address,
        email: parsed.data.email || null,
        status: parsed.data.status,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_CUSTOMER",
      entityName: "Customer",
      entityId: newCustomer.id,
      newValues: newCustomer as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard/master/customers");
    return { success: true, data: newCustomer };
  } catch (error: unknown) {
    console.error("Failed to create customer:", error);
    return {
      success: false,
      error: "Gagal menyimpan data customer ke database.",
    };
  }
}

export async function updateCustomerAction(id: string, data: CustomerInput) {
  const session = await requirePermission("master:manage");

  const parsed = customerSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data customer tidak valid.",
    };
  }

  try {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Customer tidak ditemukan." };
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        address: parsed.data.address,
        email: parsed.data.email || null,
        status: parsed.data.status,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_CUSTOMER",
      entityName: "Customer",
      entityId: id,
      oldValues: existing as unknown as Record<string, unknown>,
      newValues: updated as unknown as Record<string, unknown>,
    });

    revalidatePath("/dashboard/master/customers");
    return { success: true, data: updated };
  } catch (error: unknown) {
    console.error("Failed to update customer:", error);
    return { success: false, error: "Gagal memperbarui data customer." };
  }
}

export async function updateCustomerStatusAction(
  id: string,
  status: CustomerStatus,
) {
  const session = await requirePermission("master:manage");

  try {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Customer tidak ditemukan." };
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: { status },
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_CUSTOMER_STATUS",
      entityName: "Customer",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: updated.status },
    });

    revalidatePath("/dashboard/master/customers");
    return { success: true, data: updated };
  } catch (error: unknown) {
    console.error("Failed to update customer status:", error);
    return { success: false, error: "Gagal mengubah status customer." };
  }
}
