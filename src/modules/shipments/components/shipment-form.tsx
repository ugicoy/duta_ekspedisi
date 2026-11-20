"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { createShipmentAction } from "../shipment.actions";
import type { ShipmentFormData } from "../shipment.queries";

interface ShipmentFormProps {
  formData: ShipmentFormData;
}

interface ItemRow {
  rowId: string;
  item_description: string;
  qty: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  item_type: string;
}

let rowCounter = 1;
function createEmptyRow(): ItemRow {
  rowCounter += 1;
  return {
    rowId: `item-row-${rowCounter}`,
    item_description: "",
    qty: "1",
    weight: "1",
    length: "0",
    width: "0",
    height: "0",
    item_type: "General Cargo",
  };
}

export function ShipmentForm({ formData }: ShipmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [originWarehouseId, setOriginWarehouseId] = useState(
    formData.warehouses[0]?.id ?? "",
  );
  const [destWarehouseId, setDestWarehouseId] = useState(
    formData.warehouses[1]?.id ?? formData.warehouses[0]?.id ?? "",
  );
  const [pricingTypeId, setPricingTypeId] = useState(
    formData.pricingTypes[0]?.id ?? "",
  );
  const [goodsDescription, setGoodsDescription] = useState("");
  const [manualPrice, setManualPrice] = useState("0");

  // State Pembayaran
  const [paymentOption, setPaymentOption] = useState<
    "PAID_NOW" | "PAY_ON_PICKUP"
  >("PAID_NOW");
  const [paymentMethod, setPaymentMethod] = useState("Tunai");

  // State Pengirim (Default: Input Baru Manual)
  const [senderMode, setSenderMode] = useState<"NEW" | "EXISTING">("NEW");
  const [senderId, setSenderId] = useState(formData.customers[0]?.id ?? "");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderAddress, setSenderAddress] = useState("");

  // State Penerima (Default: Input Baru Manual)
  const [receiverMode, setReceiverMode] = useState<"NEW" | "EXISTING">("NEW");
  const [receiverId, setReceiverId] = useState(
    formData.customers[1]?.id ?? formData.customers[0]?.id ?? "",
  );
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverEmail, setReceiverEmail] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");

  const [items, setItems] = useState<ItemRow[]>([createEmptyRow()]);

  const originId = useId();
  const destId = useId();
  const pricingFieldId = useId();
  const goodsDescId = useId();
  const manualPriceId = useId();
  const paymentMethodId = useId();

  const senderSelectId = useId();
  const senderNameId = useId();
  const senderPhoneId = useId();
  const senderEmailId = useId();
  const senderAddrId = useId();

  const receiverSelectId = useId();
  const receiverNameId = useId();
  const receiverPhoneId = useId();
  const receiverEmailId = useId();
  const receiverAddrId = useId();

  const selectedExistingSender = formData.customers.find(
    (c) => c.id === senderId,
  );
  const selectedExistingReceiver = formData.customers.find(
    (c) => c.id === receiverId,
  );

  const updateItem = (rowId: string, field: keyof ItemRow, value: string) => {
    setItems((prev) =>
      prev.map((row) =>
        row.rowId === rowId ? { ...row, [field]: value } : row,
      ),
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, createEmptyRow()]);
  };

  const removeItem = (rowId: string) => {
    setItems((prev) =>
      prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev,
    );
  };

  const calculation = useMemo(() => {
    const originWh = formData.warehouses.find(
      (w) => w.id === originWarehouseId,
    );
    const destWh = formData.warehouses.find((w) => w.id === destWarehouseId);

    let totalWeight = 0;
    let totalVolumetricWeight = 0;
    let totalVolumeCbm = 0;
    let totalQty = 0;

    for (const item of items) {
      const qty = Math.max(0, Number(item.qty) || 0);
      const weight = Math.max(0, Number(item.weight) || 0);
      const length = Math.max(0, Number(item.length) || 0);
      const width = Math.max(0, Number(item.width) || 0);
      const height = Math.max(0, Number(item.height) || 0);
      const cubicCm = length * width * height;

      totalWeight += weight * qty;
      totalVolumetricWeight += (cubicCm / formData.volumetricDivisor) * qty;
      totalVolumeCbm += (cubicCm / 1_000_000) * qty;
      totalQty += qty;
    }

    const primaryItemType = items[0]?.item_type ?? "General Cargo";

    let matchedTariff =
      originWh && destWh
        ? formData.tariffs.find(
            (t) =>
              t.origin_city === originWh.city &&
              t.dest_city === destWh.city &&
              t.pricing_type_id === pricingTypeId &&
              t.item_type === primaryItemType,
          )
        : undefined;

    if (!matchedTariff && originWh && destWh) {
      matchedTariff = formData.tariffs.find(
        (t) =>
          t.origin_city === originWh.city &&
          t.dest_city === destWh.city &&
          t.pricing_type_id === pricingTypeId,
      );
    }

    const minWeight = matchedTariff?.min_weight ?? 0;
    const minFee = matchedTariff?.min_fee ?? 0;
    const ratePerKg = matchedTariff?.rate_per_kg ?? 0;

    const chargeableWeight = Math.max(
      totalWeight,
      totalVolumetricWeight,
      minWeight,
    );
    const autoFee = matchedTariff
      ? Math.max(chargeableWeight * ratePerKg, minFee)
      : 0;
    const manualNum = Math.max(0, Number(manualPrice) || 0);
    const finalFee = manualNum > 0 ? manualNum : autoFee;

    return {
      totalQty,
      totalWeight,
      totalVolumetricWeight,
      totalVolumeCbm,
      chargeableWeight,
      matchedTariff,
      autoFee,
      finalFee,
    };
  }, [
    formData,
    originWarehouseId,
    destWarehouseId,
    pricingTypeId,
    items,
    manualPrice,
  ]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (originWarehouseId === destWarehouseId) {
      setError("Warehouse asal dan tujuan tidak boleh sama.");
      return;
    }

    startTransition(async () => {
      const res = await createShipmentAction({
        origin_warehouse_id: originWarehouseId,
        dest_warehouse_id: destWarehouseId,
        sender_mode: senderMode,
        sender_id: senderMode === "EXISTING" ? senderId : undefined,
        sender_data:
          senderMode === "NEW"
            ? {
                name: senderName,
                phone: senderPhone,
                email: senderEmail,
                address: senderAddress,
              }
            : undefined,
        receiver_mode: receiverMode,
        receiver_id: receiverMode === "EXISTING" ? receiverId : undefined,
        receiver_data:
          receiverMode === "NEW"
            ? {
                name: receiverName,
                phone: receiverPhone,
                email: receiverEmail,
                address: receiverAddress,
              }
            : undefined,
        goods_description: goodsDescription,
        pricing_type_id: pricingTypeId,
        manual_price: Number(manualPrice) || 0,
        payment_option: paymentOption,
        payment_method: paymentMethod,
        items: items.map((item) => ({
          item_description:
            item.item_description.trim() || goodsDescription.trim(),
          qty: Number(item.qty) || 1,
          weight: Number(item.weight) || 0,
          length: Number(item.length) || 0,
          width: Number(item.width) || 0,
          height: Number(item.height) || 0,
          item_type: item.item_type.trim() || "General Cargo",
        })),
      });

      if (!res.success) {
        setError(res.error ?? "Gagal membuat resi pengiriman.");
        return;
      }

      if (res.data?.id) {
        router.push(`/dashboard/shipments/${res.data.id}?created=1`);
      } else {
        router.push("/dashboard/shipments");
      }
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/70 px-4 py-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Bagian 1: Rute & Layanan */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-semibold text-white">
          1. Rute Cabang, Jenis Layanan & Deskripsi Muatan
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor={originId}
              className="block text-xs font-medium text-slate-300"
            >
              Warehouse Asal
            </label>
            <select
              id={originId}
              required
              value={originWarehouseId}
              onChange={(e) => setOriginWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {formData.warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={destId}
              className="block text-xs font-medium text-slate-300"
            >
              Warehouse Tujuan
            </label>
            <select
              id={destId}
              required
              value={destWarehouseId}
              onChange={(e) => setDestWarehouseId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {formData.warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={pricingFieldId}
              className="block text-xs font-medium text-slate-300"
            >
              Jenis Layanan / Tarif
            </label>
            <select
              id={pricingFieldId}
              required
              value={pricingTypeId}
              onChange={(e) => setPricingTypeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            >
              {formData.pricingTypes.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {pt.name} ({pt.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={goodsDescId}
              className="block text-xs font-medium text-slate-300"
            >
              Deskripsi Umum Muatan
            </label>
            <input
              id={goodsDescId}
              type="text"
              required
              value={goodsDescription}
              onChange={(e) => setGoodsDescription(e.target.value)}
              placeholder="Contoh: Sparepart Motor & Karton"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>
      </div>

      {/* Bagian 2: Data Pengirim & Penerima */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card Pengirim */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">
              2A. Data Pengirim (Sender)
            </h2>
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setSenderMode("NEW")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  senderMode === "NEW"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Input Baru
              </button>
              <button
                type="button"
                onClick={() => setSenderMode("EXISTING")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  senderMode === "EXISTING"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Customer Terdaftar ({formData.customers.length})
              </button>
            </div>
          </div>

          {senderMode === "NEW" ? (
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor={senderNameId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Nama Pengirim *
                </label>
                <input
                  id={senderNameId}
                  type="text"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Nama perorangan atau perusahaan"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={senderPhoneId}
                    className="block text-xs font-medium text-slate-300"
                  >
                    Nomor HP / WhatsApp *
                  </label>
                  <input
                    id={senderPhoneId}
                    type="text"
                    required
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="0812..."
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor={senderEmailId}
                    className="block text-xs font-medium text-slate-300"
                  >
                    Email (Opsional)
                  </label>
                  <input
                    id={senderEmailId}
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="pengirim@email.com"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={senderAddrId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Alamat Lengkap Pengirim *
                </label>
                <textarea
                  id={senderAddrId}
                  rows={2}
                  required
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                  placeholder="Jalan, nomor, kelurahan, kecamatan, kota"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Data pengirim baru otomatis tersimpan ke riwayat Customer saat
                resi diterbitkan.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor={senderSelectId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Pilih Pengirim dari Riwayat Customer
                </label>
                <select
                  id={senderSelectId}
                  required
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="">-- Pilih Customer --</option>
                  {formData.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {selectedExistingSender && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                  <div className="font-semibold text-white">
                    {selectedExistingSender.name}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-400">
                    HP: {selectedExistingSender.phone}
                    {selectedExistingSender.email
                      ? ` • Email: ${selectedExistingSender.email}`
                      : ""}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {selectedExistingSender.address}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Card Penerima */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">
              2B. Data Penerima (Receiver)
            </h2>
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setReceiverMode("NEW")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  receiverMode === "NEW"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Input Baru
              </button>
              <button
                type="button"
                onClick={() => setReceiverMode("EXISTING")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  receiverMode === "EXISTING"
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Customer Terdaftar ({formData.customers.length})
              </button>
            </div>
          </div>

          {receiverMode === "NEW" ? (
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor={receiverNameId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Nama Penerima *
                </label>
                <input
                  id={receiverNameId}
                  type="text"
                  required
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Nama lengkap penerima di kota tujuan"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={receiverPhoneId}
                    className="block text-xs font-medium text-slate-300"
                  >
                    Nomor HP / WhatsApp *
                  </label>
                  <input
                    id={receiverPhoneId}
                    type="text"
                    required
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="0812..."
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor={receiverEmailId}
                    className="block text-xs font-medium text-slate-300"
                  >
                    Email (Opsional)
                  </label>
                  <input
                    id={receiverEmailId}
                    type="email"
                    value={receiverEmail}
                    onChange={(e) => setReceiverEmail(e.target.value)}
                    placeholder="penerima@email.com"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={receiverAddrId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Alamat Lengkap Penerima *
                </label>
                <textarea
                  id={receiverAddrId}
                  rows={2}
                  required
                  value={receiverAddress}
                  onChange={(e) => setReceiverAddress(e.target.value)}
                  placeholder="Jalan, nomor, kelurahan, kecamatan, kota"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Data penerima otomatis masuk ke Customer & digunakan untuk
                verifikasi pengambilan (POD) di gudang tujuan.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor={receiverSelectId}
                  className="block text-xs font-medium text-slate-300"
                >
                  Pilih Penerima dari Riwayat Customer
                </label>
                <select
                  id={receiverSelectId}
                  required
                  value={receiverId}
                  onChange={(e) => setReceiverId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value="">-- Pilih Customer --</option>
                  {formData.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {selectedExistingReceiver && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300">
                  <div className="font-semibold text-white">
                    {selectedExistingReceiver.name}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-400">
                    HP: {selectedExistingReceiver.phone}
                    {selectedExistingReceiver.email
                      ? ` • Email: ${selectedExistingReceiver.email}`
                      : ""}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {selectedExistingReceiver.address}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bagian 3: Rincian Koli & Dimensi Barang */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">
              3. Rincian Koli & Dimensi Barang
            </h2>
            <p className="text-xs text-slate-400">
              Divisor volumetrik aktif: {formData.volumetricDivisor} (P × L × T
              / {formData.volumetricDivisor})
            </p>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg border border-blue-700 bg-blue-950/60 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-900/60"
          >
            + Tambah Baris Koli
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.rowId}
              className="grid grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-8"
            >
              <div className="col-span-2">
                <span className="block text-[11px] text-slate-400">
                  Deskripsi Item #{idx + 1}
                </span>
                <input
                  type="text"
                  required
                  value={item.item_description}
                  onChange={(e) =>
                    updateItem(item.rowId, "item_description", e.target.value)
                  }
                  placeholder="Nama barang"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">
                  Tipe Barang
                </span>
                <input
                  type="text"
                  required
                  value={item.item_type}
                  onChange={(e) =>
                    updateItem(item.rowId, "item_type", e.target.value)
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">Qty</span>
                <input
                  type="number"
                  min="1"
                  required
                  value={item.qty}
                  onChange={(e) =>
                    updateItem(item.rowId, "qty", e.target.value)
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">
                  Berat/Koli (Kg)
                </span>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={item.weight}
                  onChange={(e) =>
                    updateItem(item.rowId, "weight", e.target.value)
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">P (cm)</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={item.length}
                  onChange={(e) =>
                    updateItem(item.rowId, "length", e.target.value)
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">L (cm)</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={item.width}
                  onChange={(e) =>
                    updateItem(item.rowId, "width", e.target.value)
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <span className="block text-[11px] text-slate-400">
                    T (cm)
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={item.height}
                    onChange={(e) =>
                      updateItem(item.rowId, "height", e.target.value)
                    }
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.rowId)}
                    className="rounded border border-red-800/60 bg-red-950/60 px-2 py-1.5 text-xs text-red-400 hover:bg-red-900/60"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bagian 4: Penyelesaian Pembayaran & Ringkasan Ongkir */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div>
            <h2 className="text-sm font-semibold text-white">
              4. Pembayaran & Penyesuaian Harga
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Pilih status pembayaran ongkir. Pembayaran lunas langsung masuk ke
              laporan pemasukan keuangan.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentOption("PAID_NOW")}
              className={`rounded-lg border p-3 text-left text-xs transition ${
                paymentOption === "PAID_NOW"
                  ? "border-emerald-500 bg-emerald-950/60 text-white"
                  : "border-slate-700 bg-slate-950/60 text-slate-400 hover:text-white"
              }`}
            >
              <div className="font-bold text-emerald-400">
                Lunas Sekarang (Paid)
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300">
                Ongkir dibayar pengirim saat resi dibuat
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentOption("PAY_ON_PICKUP")}
              className={`rounded-lg border p-3 text-left text-xs transition ${
                paymentOption === "PAY_ON_PICKUP"
                  ? "border-amber-500 bg-amber-950/60 text-white"
                  : "border-slate-700 bg-slate-950/60 text-slate-400 hover:text-white"
              }`}
            >
              <div className="font-bold text-amber-400">
                Bayar Saat Ambil Paket
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300">
                Ditagih ke penerima di gudang tujuan
              </div>
            </button>
          </div>

          {paymentOption === "PAID_NOW" && (
            <div>
              <label
                htmlFor={paymentMethodId}
                className="block text-xs font-medium text-slate-300"
              >
                Metode Pembayaran Diterima
              </label>
              <select
                id={paymentMethodId}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="Tunai">Tunai / Cash di Kasir</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="QRIS / EDC">QRIS / Kartu Debit</option>
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor={manualPriceId}
              className="block text-xs font-medium text-slate-300"
            >
              Override Harga Manual / Borongan (Rp) — Opsional
            </label>
            <input
              id={manualPriceId}
              type="number"
              min="0"
              step="any"
              value={manualPrice}
              onChange={(e) => setManualPrice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <h2 className="text-sm font-semibold text-white">
            Ringkasan Kalkulasi & Status Bayar
          </h2>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <dt>Total Koli / Berat Aktual</dt>
              <dd className="font-mono text-slate-200">
                {calculation.totalQty} koli /{" "}
                {calculation.totalWeight.toFixed(2)} kg
              </dd>
            </div>
            <div className="flex justify-between text-slate-400">
              <dt>Berat Volumetrik / Kubikasi</dt>
              <dd className="font-mono text-slate-200">
                {calculation.totalVolumetricWeight.toFixed(2)} kg (
                {calculation.totalVolumeCbm.toFixed(3)} m³)
              </dd>
            </div>
            <div className="flex justify-between text-slate-400">
              <dt>Berat Tertagih (Chargeable)</dt>
              <dd className="font-mono font-semibold text-amber-300">
                {calculation.chargeableWeight.toFixed(2)} kg
              </dd>
            </div>
            <div className="flex justify-between text-slate-400">
              <dt>Tarif Referensi Ditemukan</dt>
              <dd className="font-mono text-slate-200">
                {calculation.matchedTariff
                  ? `Rp ${calculation.matchedTariff.rate_per_kg.toLocaleString("id-ID")}/kg (Min Rp ${calculation.matchedTariff.min_fee.toLocaleString("id-ID")})`
                  : "Tarif rute belum tersedia"}
              </dd>
            </div>
            <div className="flex justify-between text-slate-400">
              <dt>Status Pembayaran Resi</dt>
              <dd className="font-semibold">
                {paymentOption === "PAID_NOW" ? (
                  <span className="text-emerald-400">
                    SUDAH TERBAYAR ({paymentMethod})
                  </span>
                ) : (
                  <span className="text-amber-400">
                    BELUM TERBAYAR (Bayar Saat Ambil)
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-2 text-sm font-bold text-white">
              <dt>Total Ongkir</dt>
              <dd className="font-mono text-emerald-400">
                Rp {calculation.finalFee.toLocaleString("id-ID")}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/dashboard/shipments"
          className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          Batal
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {isPending ? "Menerbitkan Resi..." : "Terbitkan Resi Pengiriman"}
        </button>
      </div>
    </form>
  );
}
