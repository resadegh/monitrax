-- Phase 21.5 — Vehicle renewal dates (registration / CTP / insurance reminders)
--
-- Additive only. Adds 6 nullable columns to the existing "assets" table so
-- vehicle assets can capture the dates that drive renewal reminders:
--   - vehicleRegistrationExpiry      (rego renewal due date)
--   - vehicleCtpProvider             (CTP / green-slip insurer)
--   - vehicleCtpExpiry               (CTP renewal due date)
--   - vehicleInsuranceProvider       (comprehensive insurer)
--   - vehicleInsurancePolicyNumber   (comprehensive policy number)
--   - vehicleInsuranceExpiry         (comprehensive renewal due date)
--
-- CLAUDE.md §12.11 destructive-write checklist: N/A — pure additive.
--   1. where clause matches: none — no UPDATE/DELETE, only ADD COLUMN.
--   2. columns overwritten / rows deleted: none. All new columns are
--      nullable with no backfill, so no existing row is touched.
--   3. guard: not applicable — additive DDL only.
--
-- CLAUDE.md §12.12: matching schema.prisma change ships in the same PR.
-- The canonical reminder projection (lib/reminders/reminderEngine.ts) reads
-- these columns; no Reminder table is created for derived reminders.

ALTER TABLE "assets" ADD COLUMN "vehicleRegistrationExpiry"    TIMESTAMP(3);
ALTER TABLE "assets" ADD COLUMN "vehicleCtpProvider"           TEXT;
ALTER TABLE "assets" ADD COLUMN "vehicleCtpExpiry"             TIMESTAMP(3);
ALTER TABLE "assets" ADD COLUMN "vehicleInsuranceProvider"     TEXT;
ALTER TABLE "assets" ADD COLUMN "vehicleInsurancePolicyNumber" TEXT;
ALTER TABLE "assets" ADD COLUMN "vehicleInsuranceExpiry"       TIMESTAMP(3);
