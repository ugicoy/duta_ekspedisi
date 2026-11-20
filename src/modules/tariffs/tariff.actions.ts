"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const pricingTypeSchema = z.object({
  name: z.string().min(2, "Nama jenis harga minimal 2 karakter"),
  code: z.string().min(2, "Kode jenis harga minimal 2 karakter").toUpperCase(),
});

const tariffReferenceSchema = z
  .object({
    origin_city: z.string().min(2, "Kota asal wajib dipilih"),
    dest_city: z.string().min(2, "Kota tujuan wajib dipilih"),
    pricing_type_id: z.string().uuid("ID jenis harga tidak valid"),
    item_type: z.string().min(2, "Tipe barang minimal 2 karakter"),
    rate_per_kg: z.coerce
      .number()
      .positive("Tarif per kg harus bernilai positif"),
    rate_per_cbm: z.coerce
      .number()
      .positive("Tarif per cbm harus bernilai positif"),
    min_weight: z.coerce
      .number()
      .min(0, "Berat minimum tidak boleh negatif")
      .default(1.0),
    min_volume: z.coerce
      .number()
      .min(0, "Volume minimum tidak boleh negatif")
      .default(1.0),
    min_fee: z.coerce
      .number()
      .min(0, "Biaya minimum tidak boleh negatif")
      .default(0.0),
  })
  .refine(
    (data) =>
      data.origin_city.trim().toLowerCase() !==
      data.dest_city.trim().toLowerCase(),
    {
      message: "Kota asal dan kota tujuan tidak boleh sama.",
      path: ["dest_city"],
    },
  );

export type PricingTypeInput = z.infer<typeof pricingTypeSchema>;
export type TariffReferenceInput = z.infer<typeof tariffReferenceSchema>;

function revalidateTariffPaths() {
  revalidatePath("/dashboard/tariffs");
  revalidatePath("/dashboard/master/tariffs");
  revalidatePath("/dashboard/shipments/new");
}

export async function createPricingTypeAction(data: PricingTypeInput) {
  const session = await requirePermission("master:manage");

  const parsed = pricingTypeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data jenis harga tidak valid.",
    };
  }

  try {
    const newPricingType = await prisma.pricingType.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        is_active: true,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_PRICING_TYPE",
      entityName: "PricingType",
      entityId: newPricingType.id,
      newValues: newPricingType,
    });

    revalidateTariffPaths();
    return {
      success: true,
      data: newPricingType,
    };
  } catch (error: unknown) {
    console.error("Failed to create pricing type:", error);
    return {
      success: false,
      error:
        "Gagal menyimpan jenis harga. Pastikan kode jenis harga belum terdaftar.",
    };
  }
}

export async function updatePricingTypeAction(
  id: string,
  data: PricingTypeInput,
) {
  const session = await requirePermission("master:manage");

  const parsed = pricingTypeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data jenis harga tidak valid.",
    };
  }

  try {
    const existing = await prisma.pricingType.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Jenis harga tidak ditemukan." };
    }

    const updated = await prisma.pricingType.update({
      where: { id },
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_PRICING_TYPE",
      entityName: "PricingType",
      entityId: id,
      oldValues: existing,
      newValues: updated,
    });

    revalidateTariffPaths();
    return {
      success: true,
      data: updated,
    };
  } catch (error: unknown) {
    console.error("Failed to update pricing type:", error);
    return {
      success: false,
      error:
        "Gagal memperbarui jenis harga. Pastikan kode jenis harga tidak bentrok.",
    };
  }
}

export async function togglePricingTypeStatusAction(
  id: string,
  is_active: boolean,
) {
  const session = await requirePermission("master:manage");

  try {
    const existing = await prisma.pricingType.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Jenis harga tidak ditemukan." };
    }

    const updated = await prisma.pricingType.update({
      where: { id },
      data: { is_active },
    });

    await createAuditLog({
      userId: session.userId,
      action: "TOGGLE_PRICING_TYPE_STATUS",
      entityName: "PricingType",
      entityId: id,
      oldValues: { is_active: existing.is_active },
      newValues: { is_active: updated.is_active },
    });

    revalidateTariffPaths();
    return {
      success: true,
      data: updated,
    };
  } catch (error: unknown) {
    console.error("Failed to toggle pricing type status:", error);
    return {
      success: false,
      error: "Gagal mengubah status keaktifan jenis harga.",
    };
  }
}

export async function createTariffReferenceAction(data: TariffReferenceInput) {
  const session = await requirePermission("master:manage");

  const parsed = tariffReferenceSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ?? "Data referensi tarif tidak valid.",
    };
  }

  try {
    const newTariff = await prisma.tariffReference.create({
      data: {
        origin_city: parsed.data.origin_city,
        dest_city: parsed.data.dest_city,
        pricing_type_id: parsed.data.pricing_type_id,
        item_type: parsed.data.item_type,
        rate_per_kg: parsed.data.rate_per_kg,
        rate_per_cbm: parsed.data.rate_per_cbm,
        min_weight: parsed.data.min_weight,
        min_volume: parsed.data.min_volume,
        min_fee: parsed.data.min_fee,
        is_active: true,
      },
      include: {
        pricing_type: true,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "CREATE_TARIFF_REFERENCE",
      entityName: "TariffReference",
      entityId: newTariff.id,
      newValues: {
        ...newTariff,
        rate_per_kg: newTariff.rate_per_kg.toString(),
        rate_per_cbm: newTariff.rate_per_cbm.toString(),
        min_weight: newTariff.min_weight.toString(),
        min_volume: newTariff.min_volume.toString(),
        min_fee: newTariff.min_fee.toString(),
      },
    });

    revalidateTariffPaths();
    return {
      success: true,
      data: {
        ...newTariff,
        rate_per_kg: newTariff.rate_per_kg.toNumber(),
        rate_per_cbm: newTariff.rate_per_cbm.toNumber(),
        min_weight: newTariff.min_weight.toNumber(),
        min_volume: newTariff.min_volume.toNumber(),
        min_fee: newTariff.min_fee.toNumber(),
      },
    };
  } catch (error: unknown) {
    console.error("Failed to create tariff reference:", error);
    return {
      success: false,
      error: "Gagal menyimpan referensi tarif.",
    };
  }
}

export async function updateTariffReferenceAction(
  id: string,
  data: TariffReferenceInput,
) {
  const session = await requirePermission("master:manage");

  const parsed = tariffReferenceSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ?? "Data referensi tarif tidak valid.",
    };
  }

  try {
    const existing = await prisma.tariffReference.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Referensi tarif tidak ditemukan." };
    }

    const updated = await prisma.tariffReference.update({
      where: { id },
      data: {
        origin_city: parsed.data.origin_city,
        dest_city: parsed.data.dest_city,
        pricing_type_id: parsed.data.pricing_type_id,
        item_type: parsed.data.item_type,
        rate_per_kg: parsed.data.rate_per_kg,
        rate_per_cbm: parsed.data.rate_per_cbm,
        min_weight: parsed.data.min_weight,
        min_volume: parsed.data.min_volume,
        min_fee: parsed.data.min_fee,
      },
      include: {
        pricing_type: true,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "UPDATE_TARIFF_REFERENCE",
      entityName: "TariffReference",
      entityId: id,
      oldValues: {
        ...existing,
        rate_per_kg: existing.rate_per_kg.toString(),
        rate_per_cbm: existing.rate_per_cbm.toString(),
        min_weight: existing.min_weight.toString(),
        min_volume: existing.min_volume.toString(),
        min_fee: existing.min_fee.toString(),
      },
      newValues: {
        ...updated,
        rate_per_kg: updated.rate_per_kg.toString(),
        rate_per_cbm: updated.rate_per_cbm.toString(),
        min_weight: updated.min_weight.toString(),
        min_volume: updated.min_volume.toString(),
        min_fee: updated.min_fee.toString(),
      },
    });

    revalidateTariffPaths();
    return {
      success: true,
      data: {
        ...updated,
        rate_per_kg: updated.rate_per_kg.toNumber(),
        rate_per_cbm: updated.rate_per_cbm.toNumber(),
        min_weight: updated.min_weight.toNumber(),
        min_volume: updated.min_volume.toNumber(),
        min_fee: updated.min_fee.toNumber(),
      },
    };
  } catch (error: unknown) {
    console.error("Failed to update tariff reference:", error);
    return {
      success: false,
      error: "Gagal memperbarui referensi tarif.",
    };
  }
}

export async function toggleTariffReferenceStatusAction(
  id: string,
  is_active: boolean,
) {
  const session = await requirePermission("master:manage");

  try {
    const existing = await prisma.tariffReference.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Referensi tarif tidak ditemukan." };
    }

    const updated = await prisma.tariffReference.update({
      where: { id },
      data: { is_active },
      include: {
        pricing_type: true,
      },
    });

    await createAuditLog({
      userId: session.userId,
      action: "TOGGLE_TARIFF_REFERENCE_STATUS",
      entityName: "TariffReference",
      entityId: id,
      oldValues: { is_active: existing.is_active },
      newValues: { is_active: updated.is_active },
    });

    revalidateTariffPaths();
    return {
      success: true,
      data: {
        ...updated,
        rate_per_kg: updated.rate_per_kg.toNumber(),
        rate_per_cbm: updated.rate_per_cbm.toNumber(),
        min_weight: updated.min_weight.toNumber(),
        min_volume: updated.min_volume.toNumber(),
        min_fee: updated.min_fee.toNumber(),
      },
    };
  } catch (error: unknown) {
    console.error("Failed to toggle tariff reference status:", error);
    return {
      success: false,
      error: "Gagal mengubah status keaktifan referensi tarif.",
    };
  }
}

export async function deleteTariffReferenceAction(id: string) {
  const session = await requirePermission("master:manage");

  try {
    const existing = await prisma.tariffReference.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Referensi tarif tidak ditemukan." };
    }

    await prisma.tariffReference.delete({
      where: { id },
    });

    await createAuditLog({
      userId: session.userId,
      action: "DELETE_TARIFF_REFERENCE",
      entityName: "TariffReference",
      entityId: id,
      oldValues: {
        ...existing,
        rate_per_kg: existing.rate_per_kg.toString(),
        rate_per_cbm: existing.rate_per_cbm.toString(),
        min_weight: existing.min_weight.toString(),
        min_volume: existing.min_volume.toString(),
        min_fee: existing.min_fee.toString(),
      },
    });

    revalidateTariffPaths();
    return { success: true };
  } catch (error: unknown) {
    console.error("Failed to delete tariff reference:", error);
    return {
      success: false,
      error: "Gagal menghapus referensi tarif.",
    };
  }
}
