"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { SystemConfigItem } from "./config.queries";

const configSchema = z.object({
  key: z
    .string()
    .min(2, "Key konfigurasi minimal 2 karakter")
    .max(100, "Key konfigurasi maksimal 100 karakter")
    .regex(
      /^[A-Z0-9_]+$/,
      "Key harus berupa huruf kapital, angka, dan garis bawah (snake_case uppercase)",
    ),
  value: z.string().min(1, "Nilai konfigurasi tidak boleh kosong"),
  description: z.string().optional().nullable(),
});

export type ConfigInput = z.infer<typeof configSchema>;

export async function upsertSystemConfigAction(data: ConfigInput) {
  const session = await requirePermission("config:manage");

  const parsed = configSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Data konfigurasi tidak valid.",
    };
  }

  try {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: parsed.data.key },
    });

    let savedConfig: SystemConfigItem;
    if (existing) {
      const updated = await prisma.systemConfig.update({
        where: { key: parsed.data.key },
        data: {
          value: parsed.data.value,
          description:
            parsed.data.description !== undefined
              ? parsed.data.description
              : existing.description,
          updated_by: session.userId,
        },
      });
      savedConfig = updated;

      await createAuditLog({
        userId: session.userId,
        action: "UPDATE_SYSTEM_CONFIG",
        entityName: "SystemConfig",
        entityId: savedConfig.id,
        oldValues: existing as unknown as Record<string, unknown>,
        newValues: savedConfig as unknown as Record<string, unknown>,
      });
    } else {
      const created = await prisma.systemConfig.create({
        data: {
          key: parsed.data.key,
          value: parsed.data.value,
          description: parsed.data.description || null,
          updated_by: session.userId,
        },
      });
      savedConfig = created;

      await createAuditLog({
        userId: session.userId,
        action: "CREATE_SYSTEM_CONFIG",
        entityName: "SystemConfig",
        entityId: savedConfig.id,
        newValues: savedConfig as unknown as Record<string, unknown>,
      });
    }

    revalidatePath("/dashboard/master/config");
    return {
      success: true,
      data: savedConfig,
    };
  } catch (error: unknown) {
    console.error("Failed to upsert system config:", error);
    return {
      success: false,
      error: "Gagal menyimpan konfigurasi sistem ke database.",
    };
  }
}
