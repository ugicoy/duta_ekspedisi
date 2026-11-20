"use server";

import { z } from "zod";
import {
  findPublicShipmentByNo,
  type PublicTrackingResult,
} from "./public.queries";

const trackingQuerySchema = z.object({
  shipment_no: z
    .string()
    .trim()
    .min(3, "Masukkan minimal 3 karakter nomor resi.")
    .max(60, "Nomor resi terlalu panjang."),
});

export async function trackPublicShipmentAction(shipmentNo: string): Promise<{
  success: boolean;
  data?: PublicTrackingResult;
  error?: string;
}> {
  const parsed = trackingQuerySchema.safeParse({ shipment_no: shipmentNo });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Nomor resi tidak valid.",
    };
  }

  try {
    const result = await findPublicShipmentByNo(parsed.data.shipment_no);
    if (!result) {
      return {
        success: false,
        error: `Nomor resi "${parsed.data.shipment_no.toUpperCase()}" tidak ditemukan. Pastikan penulisan nomor resi sudah sesuai.`,
      };
    }

    return { success: true, data: result };
  } catch (error: unknown) {
    console.error("Public tracking lookup error:", error);
    return {
      success: false,
      error: "Terjadi gangguan sementara saat melacak resi. Silakan coba lagi.",
    };
  }
}
