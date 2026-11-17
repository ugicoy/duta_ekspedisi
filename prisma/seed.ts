import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL environment variable is not set");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  // Shipment & Koli
  { code: "shipment:create", name: "Buat Resi Pengiriman", description: "Membuat data shipment baru" },
  { code: "shipment:read", name: "Lihat Resi Pengiriman", description: "Melihat daftar dan detail shipment" },
  { code: "shipment:update", name: "Ubah Resi Pengiriman", description: "Mengubah data shipment sebelum manifest" },
  { code: "shipment:cancel", name: "Batalkan Resi", description: "Membatalkan atau membuat resi retur" },
  { code: "koli:manage", name: "Kelola Koli", description: "Membuat dan menggabungkan resi ke dalam koli" },

  // Trip & Manifest
  { code: "trip:create", name: "Buat Trip", description: "Membuat jadwal perjalanan armada" },
  { code: "trip:read", name: "Lihat Trip", description: "Melihat daftar dan detail trip" },
  { code: "trip:update", name: "Ubah Trip", description: "Mengubah armada atau supir trip" },
  { code: "trip:depart_arrive", name: "Update Keberangkatan/Kedatangan Trip", description: "Mencatat depart dan arrive trip" },
  { code: "manifest:create", name: "Buat Manifest", description: "Membuat manifest dan mengisi muatan" },
  { code: "manifest:read", name: "Lihat Manifest", description: "Melihat detail manifest muatan" },
  { code: "manifest:lock", name: "Kunci Manifest", description: "Mengunci manifest sebelum keberangkatan" },
  { code: "manifest:event", name: "Catat Event Manifest", description: "Mencatat log operasional manifest" },

  // Warehouse & Delivery
  { code: "warehouse:scan", name: "Scan Barcode Gudang", description: "Melakukan pemindaian inbound/outbound gudang" },
  { code: "warehouse:movement", name: "Catat Pergerakan Gudang", description: "Mencatat mutasi barang di gudang" },
  { code: "delivery:pod", name: "Input Bukti Serah Terima (POD)", description: "Mencatat bukti pengiriman selesai" },

  // Finance & Approval
  { code: "finance:read", name: "Lihat Data Keuangan", description: "Melihat catatan pendapatan dan biaya trip" },
  { code: "finance:create", name: "Input Transaksi Keuangan", description: "Mencatat pembayaran, koreksi, atau reversal" },
  { code: "finance:approve", name: "Approve Koreksi/Reversal Keuangan", description: "Menyetujui atau menolak koreksi/reversal finance" },
  { code: "finance:expense_create", name: "Input Biaya Trip", description: "Mencatat pengeluaran operasional trip" },
  { code: "finance:expense_approve", name: "Approve Biaya Trip", description: "Menyetujui atau menolak biaya operasional trip" },

  // Master Data, System Config, User & Audit
  { code: "master:read", name: "Lihat Master Data", description: "Melihat data customer, armada, supir, dan tarif" },
  { code: "master:manage", name: "Kelola Master Data", description: "Menambah dan mengubah data master operasional" },
  { code: "config:manage", name: "Kelola Konfigurasi Sistem", description: "Mengubah pengaturan global seperti divisor volumetrik" },
  { code: "user:manage", name: "Kelola User & Role", description: "Mengatur akun pengguna, role, dan akses gudang" },
  { code: "audit:read", name: "Lihat Audit Log", description: "Melihat jejak audit perubahan sistem" },
] as const;

const ROLE_DEFINITIONS: Record<
  string,
  { description: string; permissions: readonly string[] }
> = {
  OWNER: {
    description: "Pemilik perusahaan dengan akses penuh ke seluruh operasional, keuangan, dan konfigurasi",
    permissions: PERMISSIONS.map((p) => p.code),
  },
  SUPER_ADMIN: {
    description: "Administrator sistem dengan akses penuh ke seluruh modul dan manajemen user",
    permissions: PERMISSIONS.map((p) => p.code),
  },
  MANAGER: {
    description: "Manajer operasional & persetujuan keuangan (approval koreksi, reversal, dan biaya trip)",
    permissions: [
      "shipment:create",
      "shipment:read",
      "shipment:update",
      "shipment:cancel",
      "koli:manage",
      "trip:create",
      "trip:read",
      "trip:update",
      "trip:depart_arrive",
      "manifest:create",
      "manifest:read",
      "manifest:lock",
      "manifest:event",
      "warehouse:scan",
      "warehouse:movement",
      "delivery:pod",
      "finance:read",
      "finance:approve",
      "finance:expense_approve",
      "master:read",
      "master:manage",
      "audit:read",
    ],
  },
  FINANCE: {
    description: "Staf keuangan untuk pencatatan pembayaran, tagihan, koreksi, dan biaya trip",
    permissions: [
      "shipment:read",
      "trip:read",
      "manifest:read",
      "finance:read",
      "finance:create",
      "finance:expense_create",
      "master:read",
    ],
  },
  ADMIN: {
    description: "Admin operasional cabang untuk input resi, pengemasan koli, dan penyusunan manifest",
    permissions: [
      "shipment:create",
      "shipment:read",
      "shipment:update",
      "koli:manage",
      "trip:create",
      "trip:read",
      "trip:update",
      "manifest:create",
      "manifest:read",
      "manifest:lock",
      "manifest:event",
      "master:read",
      "master:manage",
    ],
  },
  WAREHOUSE_STAFF: {
    description: "Petugas gudang untuk pemindaian inbound/outbound, mutasi gudang, dan muat barang",
    permissions: [
      "shipment:read",
      "koli:manage",
      "trip:read",
      "manifest:read",
      "manifest:event",
      "warehouse:scan",
      "warehouse:movement",
      "delivery:pod",
    ],
  },
  DRIVER: {
    description: "Supir armada untuk update status perjalanan, event manifest, POD, dan klaim biaya jalan",
    permissions: [
      "trip:read",
      "trip:depart_arrive",
      "manifest:read",
      "manifest:event",
      "delivery:pod",
      "finance:expense_create",
    ],
  },
};

async function main() {
  console.log("Memulai seeding database Duta Ekspedisi (Bali - Surabaya)...");

  // 1. Seed Warehouses (Bali & Surabaya)
  const warehouseBali = await prisma.warehouse.upsert({
    where: { code: "BL" },
    update: {
      name: "Gudang Bali (Denpasar)",
      address: "Jl. Mahendradatta No. 88, Denpasar, Bali",
      city: "Denpasar",
      is_active: true,
    },
    create: {
      code: "BL",
      name: "Gudang Bali (Denpasar)",
      address: "Jl. Mahendradatta No. 88, Denpasar, Bali",
      city: "Denpasar",
      is_active: true,
    },
  });

  const warehouseSurabaya = await prisma.warehouse.upsert({
    where: { code: "SB" },
    update: {
      name: "Gudang Surabaya",
      address: "Jl. Margomulyo Indah No. 45, Surabaya, Jawa Timur",
      city: "Surabaya",
      is_active: true,
    },
    create: {
      code: "SB",
      name: "Gudang Surabaya",
      address: "Jl. Margomulyo Indah No. 45, Surabaya, Jawa Timur",
      city: "Surabaya",
      is_active: true,
    },
  });

  // 2. Seed SystemConfig (Volumetric Divisor = 4000)
  await prisma.systemConfig.upsert({
    where: { key: "VOLUMETRIC_DIVISOR" },
    update: {
      value: "4000",
      description: "Pembagi standar perhitungan berat volumetrik (P x L x T / 4000)",
    },
    create: {
      key: "VOLUMETRIC_DIVISOR",
      value: "4000",
      description: "Pembagi standar perhitungan berat volumetrik (P x L x T / 4000)",
    },
  });

  // 3. Seed PricingTypes
  const pricingTypes = [
    { code: "REG", name: "Reguler" },
    { code: "B2B", name: "B2B / Kontrak" },
    { code: "EXP", name: "Express" },
  ];

  for (const pt of pricingTypes) {
    await prisma.pricingType.upsert({
      where: { code: pt.code },
      update: { name: pt.name, is_active: true },
      create: { code: pt.code, name: pt.name, is_active: true },
    });
  }

  // 4. Seed NumberSequences
  const sequences = [
    { prefix: "DE-BL-", description: "Nomor Resi Pengiriman asal Gudang Bali" },
    { prefix: "DE-SB-", description: "Nomor Resi Pengiriman asal Gudang Surabaya" },
    { prefix: "KOL-BL-", description: "Nomor Koli asal Gudang Bali" },
    { prefix: "KOL-SB-", description: "Nomor Koli asal Gudang Surabaya" },
    { prefix: "MNF-BL-", description: "Nomor Manifest asal Gudang Bali" },
    { prefix: "MNF-SB-", description: "Nomor Manifest asal Gudang Surabaya" },
    { prefix: "TRP-BL-", description: "Nomor Trip asal Gudang Bali" },
    { prefix: "TRP-SB-", description: "Nomor Trip asal Gudang Surabaya" },
    { prefix: "POD-BL-", description: "Nomor Bukti Serah Terima (POD) Bali" },
    { prefix: "POD-SB-", description: "Nomor Bukti Serah Terima (POD) Surabaya" },
  ];

  for (const seq of sequences) {
    await prisma.numberSequence.upsert({
      where: { prefix: seq.prefix },
      update: { description: seq.description },
      create: {
        prefix: seq.prefix,
        next_val: 1,
        description: seq.description,
      },
    });
  }

  // 5. Seed Permissions
  const permissionMap = new Map<string, string>();
  for (const perm of PERMISSIONS) {
    const savedPerm = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, description: perm.description },
      create: {
        code: perm.code,
        name: perm.name,
        description: perm.description,
      },
    });
    permissionMap.set(perm.code, savedPerm.id);
  }

  // 6. Seed 7 Roles & RolePermissions
  const roleMap = new Map<string, string>();
  for (const [roleName, def] of Object.entries(ROLE_DEFINITIONS)) {
    const savedRole = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: def.description },
      create: {
        name: roleName,
        description: def.description,
      },
    });
    roleMap.set(roleName, savedRole.id);

    for (const permCode of def.permissions) {
      const permissionId = permissionMap.get(permCode);
      if (permissionId) {
        await prisma.rolePermission.upsert({
          where: {
            role_id_permission_id: {
              role_id: savedRole.id,
              permission_id: permissionId,
            },
          },
          update: {},
          create: {
            role_id: savedRole.id,
            permission_id: permissionId,
          },
        });
      }
    }
  }

  // 7. Seed Initial Super Admin / Owner Account
  const passwordHash = await bcrypt.hash("Admin123!", 12);
  const adminUser = await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {
      full_name: "Super Admin Duta Ekspedisi",
      email: "admin@dutaekspedisi.co.id",
      is_active: true,
    },
    create: {
      username: "superadmin",
      password_hash: passwordHash,
      full_name: "Super Admin Duta Ekspedisi",
      email: "admin@dutaekspedisi.co.id",
      phone: "081234567890",
      is_active: true,
    },
  });

  // Assign OWNER & SUPER_ADMIN roles
  for (const roleName of ["OWNER", "SUPER_ADMIN"]) {
    const roleId = roleMap.get(roleName);
    if (roleId) {
      await prisma.userRole.upsert({
        where: {
          user_id_role_id: {
            user_id: adminUser.id,
            role_id: roleId,
          },
        },
        update: {},
        create: {
          user_id: adminUser.id,
          role_id: roleId,
        },
      });
    }
  }

  // Assign access to both Bali (BL) and Surabaya (SB) warehouses
  for (const warehouse of [warehouseBali, warehouseSurabaya]) {
    await prisma.userWarehouse.upsert({
      where: {
        user_id_warehouse_id: {
          user_id: adminUser.id,
          warehouse_id: warehouse.id,
        },
      },
      update: {},
      create: {
        user_id: adminUser.id,
        warehouse_id: warehouse.id,
      },
    });
  }

  console.log("Seeding selesai! Akun awal -> username: superadmin | password: Admin123!");
}

main()
  .catch((error) => {
    console.error("Gagal menjalankan seeding:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });