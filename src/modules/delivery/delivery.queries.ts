import { requirePermission } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export interface DeliveryProofListItem {
  id: string;
  proof_number: string;
  proof_type: string;
  recipient_name: string;
  recipient_phone: string;
  signed_at: Date;
  photo_url: string | null;
  notes: string | null;
  items: {
    id: string;
    shipment: {
      id: string;
      shipment_no: string;
      goods_description: string;
      qty: number;
      weight: number;
      destWarehouse: { code: string; city: string };
      receiver: { name: string };
    };
  }[];
}

export interface EligiblePodShipment {
  id: string;
  shipment_no: string;
  barcode: string;
  goods_description: string;
  qty: number;
  weight: number;
  status: string;
  totalFee: number;
  paidAmount: number;
  remainingAmount: number;
  isPaid: boolean;
  originWarehouse: { code: string; city: string };
  destWarehouse: { id: string; code: string; name: string; city: string };
  sender: { name: string };
  receiver: { name: string; phone: string };
}

export async function getDeliveryProofs(): Promise<DeliveryProofListItem[]> {
  await requirePermission("shipment:read");

  const proofs = await prisma.deliveryProof.findMany({
    orderBy: { signed_at: "desc" },
    include: {
      deliveryProofItems: {
        include: {
          shipment: {
            select: {
              id: true,
              shipment_no: true,
              goods_description: true,
              qty: true,
              weight: true,
              destWarehouse: { select: { code: true, city: true } },
              receiver: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  return proofs.map((proof) => ({
    id: proof.id,
    proof_number: proof.proof_number,
    proof_type: proof.proof_type,
    recipient_name: proof.recipient_name,
    recipient_phone: proof.recipient_phone,
    signed_at: proof.signed_at,
    photo_url: proof.photo_url,
    notes: proof.notes,
    items: proof.deliveryProofItems.map((item) => ({
      id: item.id,
      shipment: {
        ...item.shipment,
        weight: item.shipment.weight.toNumber(),
      },
    })),
  }));
}

export async function getEligibleShipmentsForPod(): Promise<
  EligiblePodShipment[]
> {
  await requirePermission("shipment:read");

  const shipments = await prisma.shipment.findMany({
    where: {
      status: {
        in: ["ARRIVED_AT_DESTINATION", "OUT_FOR_DELIVERY"],
      },
    },
    orderBy: { updated_at: "asc" },
    include: {
      originWarehouse: { select: { code: true, city: true } },
      destWarehouse: {
        select: { id: true, code: true, name: true, city: true },
      },
      sender: { select: { name: true } },
      receiver: { select: { name: true, phone: true } },
      financeRecords: {
        where: { approval_status: "APPROVED" },
        select: { amount: true },
      },
    },
  });

  return shipments.map((s) => {
    const totalFee = s.price_nominal_snap.toNumber();
    const paidAmount = s.financeRecords.reduce(
      (sum, fr) => sum + fr.amount.toNumber(),
      0,
    );
    const remainingAmount = Math.max(totalFee - paidAmount, 0);

    return {
      id: s.id,
      shipment_no: s.shipment_no,
      barcode: s.barcode,
      goods_description: s.goods_description,
      qty: s.qty,
      weight: s.weight.toNumber(),
      status: s.status,
      totalFee,
      paidAmount,
      remainingAmount,
      isPaid: remainingAmount <= 0 && totalFee > 0,
      originWarehouse: s.originWarehouse,
      destWarehouse: s.destWarehouse,
      sender: s.sender,
      receiver: s.receiver,
    };
  });
}
