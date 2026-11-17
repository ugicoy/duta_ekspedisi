# AGENTS.md — Sistem Manajemen Ekspedisi Cargo (Bali ↔ Surabaya)

## 0. CURRENT PROJECT GATE (CRITICAL)
- **STATUS: PHASE 1 — ANALYSIS & ERD FINALIZATION (NO APPLICATION/DB CODE YET).**
- **DO NOT** generate Prisma schemas, SQL DDL, migrations, folder scaffolds, or application code until the user explicitly approves the conceptual ERD.
- **Required Phase 1 Deliverables (14-Point Checklist):**
  1. Summarize business process understanding.
  2. Identify all `FINAL` business decisions.
  3. Identify all `PENDING DECISION` items.
  4. Audit specification conflicts/inconsistencies.
  5. Propose conceptual ERD based on latest approved rules.
  6. Detail entities, attributes, data types, PK, FK, nullability, unique constraints, and cardinalities.
  7. Verify `KoliItem` and `ManifestItem` integrity.
  8. Verify `Trip` and `Manifest` 1:1 relation.
  9. Verify event-driven tracking propagation and idempotency.
  10. Verify `FinanceRecord` and `TripExpense` separation & immutability.
  11. Verify RBAC and warehouse scope isolation.
  12. Verify workflow-to-data-model consistency.
  13. Output a complete **Mermaid ER Diagram**.
  14. List all unresolved questions requiring user decision (ask **one at a time**).

---

## 1. Project Overview & Tech Stack
- **Domain:** Operational warehouse-to-warehouse cargo expedition system for bidirectional **Bali ↔ Surabaya** routes (not a simple CRUD app).
- **Monolith Stack:** Single Next.js (App Router) app inside `src/` using TypeScript, Tailwind CSS, and `@/*` path alias (serves both internal dashboard and public website).
- **Linter & Formatter:** **Biome** (DO NOT use ESLint or Prettier; never write `// eslint-disable` comments).
- **Optimization:** **React Compiler** is enabled (avoid manual `useMemo`/`useCallback` unless required for third-party compatibility).
- **Database & ORM:** Neon PostgreSQL (`DATABASE_URL` pooled + `DIRECT_URL` direct) with **Prisma** (verify Prisma 6 vs 7 configuration before schema creation).
- **Validation & Storage:** **Zod** for server-side validation; **Cloudflare R2** (or S3-compatible storage) for photos, signatures, and documents (NEVER store large binaries in PostgreSQL).
- **Environment & Git:** All credentials in `.env` (never commit secrets); GitHub workflow: `dev` → local test → preview deploy → fix → merge to `main` → Vercel production.

---

## 2. Decision Governance & AI Working Rules
1. **Source of Truth Priority:**
   1. Latest explicit user decision.
   2. `PROJECT HANDOVER v3.0` specification.
   3. Previously agreed decisions not superseded.
   4. AI technical recommendations (never treated as business decisions until approved).
2. **Specification Tagging:** Always label items as `FINAL`, `TECHNICAL RECOMMENDATION`, `PENDING DECISION`, or `OUT OF MVP`.
3. **Zero Unapproved Assumptions:** Never invent business logic for pending decisions. When clarifying, ask **one question at a time**.
4. **Conflict Handling:** Never silently pick one side of a conflict—flag it, apply the latest approved rule, and state what was superseded.
5. **Engineering Discipline (Post-ERD Approval):**
   - Build incrementally following the 8-phase roadmap (Analysis/ERD → Foundation/RBAC/Master → Transactions/Resi → Koli/Warehouse Ops → Trip/Manifest → Tracking/Handover → Finance/Reports → Real-World Testing).
   - Inspect existing project structure before modifying code; never hallucinate files, functions, or tables.
   - Never assume paid third-party services without explaining free/open-source alternatives.
   - Never claim tests passed without verifiable proof.
   - Always specify **terminal working directory** for CLI commands.
   - For every code change, document: **Purpose**, **File Path**, **Complete Code**, **How to Run/Test**, **Expected Result**, and **Risks**.
   - For every DB change, document: **Relations**, **Constraints**, **Migration Impact**, and **Rollback Strategy**.

---

## 3. Master Data & RBAC Rules
- **Master Entities:**
  - `Warehouse`: Bali & Surabaya (`code`, `name`, `address`, `is_active`). Warehouses dynamically act as origin OR destination per trip—never hardcode a warehouse as strictly ORIGIN or DESTINATION.
  - `Customer`: Can act as sender OR receiver (`name`, `phone`, `address`, `email`, `status`).
  - `Vehicle`: `plate_number`, `vehicle_code`, `vehicle_type`, `capacity`, `operational_status`.
  - `Driver`: `name`, `driver_code`, `phone`, `license_number`, `is_active`, linked user login account.
  - `PricingType`: Dynamic table (`id`, `name`, `code`, `is_active`, timestamps) seeded with `Customer` and `B2B`—never a hardcoded enum.
- **Roles (7 Initial Roles):**
  - `OWNER`: Business oversight across all warehouses and consolidated finance (not technical maintenance).
  - `SUPER_ADMIN`: Technical admin managing users, roles, permissions, system config, and master data (all actions audited).
  - `ADMIN`: Creates transactions/customers, selects pricing type, inputs manual price, prints resi/labels.
  - `MANAGER`: Views operational reports, monitors trips/performance, views financial reports per permission, audits logs (approvals only if later defined).
  - `FINANCE`: Strictly scoped to assigned warehouse(s) (Finance A cannot access Warehouse B); records/corrects revenue with mandatory audit trail.
  - `WAREHOUSE_STAFF`: Strictly scoped to assigned warehouse(s); handles receiving, scanning, Koli packing, loading/unloading, physical reconciliation (no default finance access).
  - `DRIVER`: Individual login; views only assigned trips/manifests, submits journey documentation, updates location/notes; cannot edit financial data.
- **RBAC Architecture:** Many-to-many via `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, and `UserWarehouse` (do NOT put `role_id` directly on `User`). Enforce all permission and warehouse scope checks on the backend.

---

## 4. Core Domain Invariants (Shipment, Koli, Trip, Manifest)
1. **Shipment / Resi (Primary Unit):**
   - Every `Shipment` has a unique resi number, unique barcode, sender, receiver, origin/destination warehouse, goods description, weight/dimensions, one `PricingType`, one manual price, and individual tracking history.
   - Transactions may be saved as `DRAFT` before finalization; block finalization if mandatory data is missing.
   - Never split one `Shipment` into multiple independent tracking units.
2. **Koli (Optional Physical Grouping):**
   - `Koli` is an **optional** physical container (sack/box) grouping multiple different `Shipment`s (`Koli` 1 : N `KoliItem` N : 1 `Shipment`). Never require every `Shipment` to have a `Koli`.
   - `KoliItem` tracks historical membership (`assigned_at`, `released_at`). `released_at` is set ONLY when physical grouping in the Koli actually ends—loading a Koli onto a truck or receiving it at destination warehouse does NOT close `KoliItem`.
3. **Trip & Manifest (Strict 1:1:1):**
   - **Rule:** `1 Manifest = 1 Trip = 1 Vehicle` with `1 primary_driver_id` (responsible for journey docs even if co-drivers swap).
   - `Manifest.trip_id` must be `UNIQUE NOT NULL` (no circular FK between `Trip` and `Manifest`).
   - Return trips (e.g., Surabaya → Bali after Bali → Surabaya) are brand-new `Trip` and `Manifest` records.
4. **ManifestItem & Loading:**
   - `ManifestItem` ALWAYS records individual `Shipment` rows—never just Koli counts.
   - **Cara A (Scan Koli):** Resolve active `KoliItem`s → validate every member `Shipment` → insert one `ManifestItem` per `Shipment` inside a single atomic DB transaction (default: all-or-none).
   - **Cara B (Direct Resi Scan):** Validate `Shipment` → insert one `ManifestItem` directly without creating a `Koli`.
   - Once a Trip departs, its `Manifest` is locked; post-departure corrections require a special audited procedure.
5. **Forbidden Legacy Models:**
   - **DO NOT** recreate `ShipmentItem`, `TripItem`, `HandlingUnit`, or `ShipmentCharge`.
   - **DO NOT** model `Koli` as a child of `Shipment`.

---

## 5. Tracking, Warehouse Unloading & Delivery Proof
- **Four Separate Operational Logs (Never Conflate):**
  1. `ManifestEvent`: Truck journey milestones (departed, port arrival, crossing, destination city/warehouse arrival). Photos stored in object storage.
  2. `TrackingEvent`: Customer-facing history per `Shipment`, propagated idempotently from `ManifestEvent`. Does NOT automatically mark physical receipt or `DELIVERED`.
  3. `WarehouseMovement`: Confirmed physical handling/movement at origin or destination warehouse.
  4. `ScanLog`: Audit log of every scan attempt (success, failed, duplicate, wrong warehouse).
- **Destination Unloading & Reconciliation:**
  - `Trip = ARRIVED` or completed `Manifest` does NOT mean all shipments are received.
  - Destination warehouse staff must scan each resi individually, reconcile against `ManifestItem`, record `WarehouseMovement`, and update operational status (e.g., `READY_FOR_PICKUP` once verified, or flag discrepancies).
- **DeliveryProof & DeliveryProofItem:**
  - `DeliveryProof` (handover header: `proof_number`, `proof_type`, `signed_at`, recipient name/phone, actor, notes, photo/signature URL) linked via `DeliveryProofItem` to one or more `Shipment`s (never put `shipment_id` on `DeliveryProof`).
  - A `Shipment` becomes `DELIVERED` ONLY after actual handover is confirmed via `DeliveryProof`.
- **Status Separation:** Maintain distinct status columns/state machines for `Trip` (e.g., `DRAFT`, `LOADING`, `READY_TO_DEPART`, `DEPARTED`, `ARRIVED`, `CLOSED`, `CANCELLED`), `Manifest`, `Shipment`, physical location, and `Koli`. Never derive `Shipment` status by aggregating majority status from `Koli`.

---

## 6. Public Website, Finance MVP & Reporting
- **Public Tracking:** Search by resi number; apply rate limiting; expose ONLY resi number, transaction date, origin/destination cities, shipment status, journey history, and ETA (if available). Strictly hide financials, sender/receiver PII, driver phone numbers, other customers' resi, and manifest cargo lists.
- **Public Price Estimator:** Uses external tariff references with parameters (route, item type, weight, dimensions, qty/koli, extra fees) and minimums (**1 kg** min weight, **1 m³** min volume). Display clear disclaimer that estimates are non-binding and require Admin confirmation. Do NOT build an internal pricing engine.
- **Finance MVP:**
  - Never record `Customer` and `B2B` prices simultaneously on one transaction. Store immutable price snapshots (`pricing_type_id`, `price_name_snap`, `price_nominal_snap`) upon finalization.
  - `FinanceRecord` (revenue) links to `Shipment` (never only to `Trip`). Strictly **append-only** (no `UPDATE`/`DELETE` after posting); corrections create a new record referencing `reverses_record_id` + reason + `AuditLog`. Note: Recorded revenue does not automatically mean cash has been collected.
  - `TripExpense`: Lump-sum departure cash advance linked to `Trip` (no granular fuel/toll/ferry breakdown in MVP). Revisions deactivate the old record and insert a new one + `AuditLog`. Never mix with `Shipment` revenue.
  - **OUT OF MVP:** Accounts receivable (`piutang`), partial payments, payment allocation, cashbook, general company expenses, double-entry accounting.
- **Dashboards & Reports:** Enforce role and warehouse scope; support **CSV, Excel, and PDF** exports; exclude out-of-MVP financial metrics.

---

## 7. Mandatory Database Constraints & Security
Enforce all 14 constraints in the ERD/Schema:
1. `Shipment.shipment_no` `UNIQUE`
2. `Shipment.barcode` `UNIQUE`
3. `Koli.koli_no` `UNIQUE`
4. `Koli.barcode` `UNIQUE`
5. `Manifest.manifest_no` `UNIQUE`
6. `Manifest.trip_id` `UNIQUE NOT NULL`
7. `ManifestItem` `UNIQUE(manifest_id, shipment_id)`
8. Partial unique index: `KoliItem(shipment_id) WHERE released_at IS NULL`
9. Partial unique index: `ManifestItem(shipment_id) WHERE released_at IS NULL`
10. Partial unique index: `TrackingEvent(source_manifest_event_id, shipment_id) WHERE source_manifest_event_id IS NOT NULL`
11. `ScanLog` `CHECK` constraint: **exactly one** of `shipment_id` or `koli_id` is non-null
12. `TripExpense`: max 1 active record per `Trip`
13. `FinanceRecord`: immutable after posting (no delete/update)
14. Protect historical relations: forbid `ON DELETE CASCADE` on transactional, financial, or audit records.
- **Atomic Sequences & Security:** Generate resi (`EXP...`), Koli (`KOL...`), and Manifest numbers atomically via `NumberSequence` (never `COUNT + 1`). Hash passwords securely, log critical actions in `AuditLog`, and use Code 128 (`bwip-js`) on 100 × 150 mm thermal labels (with `B2B` badge when applicable) compatible with USB HID scanners and `html5-qrcode`/`@zxing/browser`.

---

## 8. Pending Business Decisions (Do Not Assume)
Keep these 5 categories open for user confirmation (ask one by one when needed):
- **Operational SOPs:** Unpacking/re-sealing Koli, damaged goods, lost goods, left-behind goods, wrong destination, manifest discrepancy, returns, cancellations, truck swap, post-departure manifest correction.
- **Validation Rules:** Shipment loading eligibility criteria, whether payment is required before loading/handover, whether partial-invalid Koli scan can ever override all-or-none.
- **Customer & Handover:** Sender/receiver snapshot vs FK + snapshot, recipient verification method, pickup code usage, photo vs signature proof requirement, exact public tracking fields.
- **Pricing & Finance:** Volumetric divisor factor, rounding rules, external tariff reference source, actual cash payment recording SOP, revenue correction approval limits, TripExpense approval workflow.
- **Data & Retention:** Final numbering formats (Resi/Koli/Manifest), final state machine transitions per entity, photo storage & retention policy.