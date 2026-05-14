-- Corrective migration — schema drift from the pre-migration `db push` era.
--
-- `BasiqConnection` in schema.prisma declares two CDR-consent-tracking
-- columns ("Fix: G19") — `consentExpiresAt DateTime?` and
-- `consentScope String?` — plus an index on `consentExpiresAt`. These
-- were added to the schema (and applied to the dev DB via `prisma db
-- push`) before the migrations workflow existed, so there is NO
-- migration file that creates them. The production `basiq_connections`
-- table therefore never got these columns. Any query that does
-- `SELECT *` on the table — e.g. `prisma.basiqConnection.findMany()` in
-- `checkConsentExpiry()` (the `/api/cdr/lifecycle` cron) — fails with
-- `The column basiq_connections.consentExpiresAt does not exist in the
-- current database`, which is why the `monitrax-cdr-lifecycle` Cloud
-- Scheduler job has been returning HTTP 500 on every run.
--
-- This brings the database in line with schema.prisma. `IF NOT EXISTS`
-- makes it idempotent: on the dev DB (which already has these columns
-- via the historical `db push`) it's a no-op; on prod it adds them.
-- Purely additive (nullable columns + a non-unique index) — CLAUDE.md
-- §12.11 destructive-write checklist N/A by structural argument.

ALTER TABLE "basiq_connections" ADD COLUMN IF NOT EXISTS "consentExpiresAt" TIMESTAMP(3);
ALTER TABLE "basiq_connections" ADD COLUMN IF NOT EXISTS "consentScope" TEXT;
CREATE INDEX IF NOT EXISTS "basiq_connections_consentExpiresAt_idx" ON "basiq_connections"("consentExpiresAt");
