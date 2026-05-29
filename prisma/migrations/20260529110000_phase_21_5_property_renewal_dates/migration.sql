-- Phase 21.5 — Property renewal dates (rates / land tax / insurance / strata /
-- lease / compliance reminders)
--
-- Additive only. Adds 9 nullable columns to the existing "properties" table so
-- properties can capture the dates that drive renewal reminders:
--   - councilRatesDueDate            (council rates next due)
--   - waterRatesDueDate              (water rates next due)
--   - landTaxDueDate                 (land tax assessment next due)
--   - buildingInsuranceProvider      (building & contents insurer)
--   - buildingInsurancePolicyNumber  (building & contents policy number)
--   - buildingInsuranceExpiry        (building & contents renewal due date)
--   - strataDueDate                  (strata / body-corporate levy next due)
--   - leaseExpiry                    (lease / rent-review date)
--   - complianceCertExpiry           (smoke-alarm / pool-safety / gas cert expiry)
--
-- CLAUDE.md §12.11 destructive-write checklist: N/A — pure additive.
--   1. where clause matches: none — no UPDATE/DELETE, only ADD COLUMN.
--   2. columns overwritten / rows deleted: none. All new columns are
--      nullable with no backfill, so no existing row is touched.
--   3. guard: not applicable — additive DDL only.
--
-- CLAUDE.md §12.12: matching schema.prisma change ships in the same PR.
-- CLAUDE.md §12.14 (FW-3): these are operational reminder inputs only — they
-- do NOT interact with the Phase 41E CGT grandfathering test (that reads
-- `acquisitionContractDate`). No reform regime math reads these columns.
-- The canonical reminder projection (lib/reminders/reminderEngine.ts) reads
-- these columns; no Reminder table is created for derived reminders.

ALTER TABLE "properties" ADD COLUMN "councilRatesDueDate"           TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN "waterRatesDueDate"             TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN "landTaxDueDate"                TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN "buildingInsuranceProvider"     TEXT;
ALTER TABLE "properties" ADD COLUMN "buildingInsurancePolicyNumber" TEXT;
ALTER TABLE "properties" ADD COLUMN "buildingInsuranceExpiry"       TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN "strataDueDate"                 TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN "leaseExpiry"                   TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN "complianceCertExpiry"          TIMESTAMP(3);
