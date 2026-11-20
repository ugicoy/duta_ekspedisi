"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const createFinanceRecordSchema = z.object({
  shipment_id: z.string().uuid("Pilih resi pengiriman terlebih dahulu"),
  record_type: z.enum(["PAYMENT", "ADJUSTMENT", "REVERSAL"]),
  amount: z.coerce
    .number()
    .refine((val) => val !== 0, "Nominal transaksi tidak boleh nol"),
  reverses_record_id: z
    .string()
    .uuid("ID referensi transaksi tidak valid")
    .optional()
    .nullable(),
  notes: z.string().max(500).optional(),
});

const createTripExpenseSchema = z.object({
  trip_id: z.string().uuid("Pilih jadwal trip terlebih dahulu"),
  amount: z.coerce.number().positive("Nominal biaya trip harus lebih dari 0"),
  notes: z.string().min(3, "Rincian biaya perjalanan wajib diisi").max(500),
});

export async function createFinanceRecordAction(data: {
  shipment_id: string;
  record_type: "PAYMENT" | "ADJUSTMENT" | "REVERSAL";
  amount: number;
  reverses_record_id?: string | null;
  notes?: string;
}) {
  const session = await requirePermission("finance:create");

  const parsed = createFinanceRecordSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Data transaksi keuangan tidak valid.",
    };
  }

  const { shipment_id, record_type, amount, reverses_record_id, notes } =
    parsed.data;

  try {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipment_id },
    });

    if (!shipment) {
      return { success: false, error: "Data resi tidak ditemukan." };
    }

    if (record_type === "PAYMENT" && amount <= 0) {
      return {
        success: false,
        error: "Nominal pembayaran (PAYMENT) harus bernilai positif.",
      };
    }

    if (record_type === "REVERSAL" && !reverses_record_id) {
      return {
        success: false,
        error: "Pilih transaksi sebelumnya yang akan di-reversal.",
      };
    }

    const normalizedAmount =
      record_type === "REVERSAL" ? -Math.abs(amount) : amount;
    const isAutoApproved = record_type === "PAYMENT";
    const now = new Date();
    const cleanNotes = notes?.trim() || null;

    const created = await prisma.financeRecord.create({
      data: {
        shipment_id,
        record_type,
        amount: Number(normalizedAmount.toFixed(2)),
        approval_status: isAutoApproved ? "APPROVED" : "PENDING",
        approved_by: isAutoApproved ? session.userId : null,
        approved_at: isAutoApproved ? now : null,
        reverses_record_id:
          record_type === "REVERSAL" ? reverses_record_id : null,
        notes: cleanNotes,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_FINANCE_RECORD",
      entityName: "FinanceRecord",
      entityId: created.id,
      newValues: {
        shipment_no: shipment.shipment_no,
        record_type,
        amount: created.amount.toString(),
        approval_status: created.approval_status,
      },
    });

    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to create finance record:", error);
    return {
      success: false,
      error: "Gagal menyimpan catatan transaksi keuangan.",
    };
  }
}

export async function approveFinanceRecordAction(
  recordId: string,
  decision: "APPROVED" | "REJECTED",
) {
  const session = await requirePermission("finance:approve");

  try {
    const existing = await prisma.financeRecord.findUnique({
      where: { id: recordId },
    });

    if (!existing) {
      return { success: false, error: "Catatan keuangan tidak ditemukan." };
    }
    if (existing.approval_status !== "PENDING") {
      return {
        success: false,
        error: `Transaksi ini sudah berstatus ${existing.approval_status}.`,
      };
    }

    const now = new Date();

    await prisma.financeRecord.update({
      where: { id: recordId },
      data: {
        approval_status: decision,
        approved_by: session.userId,
        approved_at: now,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: `FINANCE_RECORD_${decision}`,
      entityName: "FinanceRecord",
      entityId: recordId,
      oldValues: { approval_status: existing.approval_status },
      newValues: { approval_status: decision },
    });

    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to approve finance record:", error);
    return {
      success: false,
      error: "Gagal memproses persetujuan transaksi keuangan.",
    };
  }
}

export async function createTripExpenseAction(data: {
  trip_id: string;
  amount: number;
  notes: string;
}) {
  const session = await requirePermission("finance:expense_create");

  const parsed = createTripExpenseSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data biaya trip tidak valid.",
    };
  }

  const { trip_id, amount, notes } = parsed.data;

  try {
    const trip = await prisma.trip.findUnique({
      where: { id: trip_id },
    });

    if (!trip) {
      return { success: false, error: "Jadwal trip tidak ditemukan." };
    }

    const created = await prisma.tripExpense.create({
      data: {
        trip_id,
        amount: Number(amount.toFixed(2)),
        status: "ACTIVE",
        approval_status: "PENDING",
        notes: notes.trim(),
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_TRIP_EXPENSE",
      entityName: "TripExpense",
      entityId: created.id,
      newValues: {
        trip_code: trip.trip_code,
        amount: created.amount.toString(),
        notes: created.notes,
      },
    });

    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to create trip expense:", error);
    return {
      success: false,
      error: "Gagal menyimpan klaim biaya perjalanan trip.",
    };
  }
}

export async function approveTripExpenseAction(
  expenseId: string,
  decision: "APPROVED" | "REJECTED",
) {
  const session = await requirePermission("finance:expense_approve");

  try {
    const existing = await prisma.tripExpense.findUnique({
      where: { id: expenseId },
    });

    if (!existing) {
      return { success: false, error: "Data biaya trip tidak ditemukan." };
    }
    if (existing.approval_status !== "PENDING") {
      return {
        success: false,
        error: `Biaya trip ini sudah berstatus ${existing.approval_status}.`,
      };
    }

    const now = new Date();

    await prisma.tripExpense.update({
      where: { id: expenseId },
      data: {
        approval_status: decision,
        approved_by: session.userId,
        approved_at: now,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: `TRIP_EXPENSE_${decision}`,
      entityName: "TripExpense",
      entityId: expenseId,
      oldValues: { approval_status: existing.approval_status },
      newValues: { approval_status: decision },
    });

    revalidatePath("/dashboard/finance");
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to approve trip expense:", error);
    return {
      success: false,
      error: "Gagal memproses persetujuan biaya trip.",
    };
  }
}
