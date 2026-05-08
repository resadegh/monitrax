-- Settings Overhaul (2026-05-08)
--
-- Closes the trust-breaking gaps surfaced by the 2026-05-08 settings
-- review. Every change in this migration is purely additive:
--
-- 1. AuditAction enum gains 5 new values for the new account-lifecycle
--    operations (deletion request / cancel / completion, data export,
--    trusted-contact change). ALTER TYPE ADD VALUE per the precedent
--    set in 20260511100000_add_l4_surface_audit_source.
-- 2. user_preferences gains 4 columns the appearance UI already exposed
--    (theme, showCents, compactMode, financialYearStart) but the API
--    silently dropped on write. Defaults match the previous hardcoded
--    GET return values so existing rows behave identically.
-- 3. users gains 5 trusted-contact columns + 2 deletion-lifecycle columns.
--    All nullable. Hydrating real values is opt-in via the new
--    /api/account/trusted-contact and /api/account/delete-request routes.
--
-- =============================================================================
-- CLAUDE.md §12.11 destructive-write checklist:
--
-- 1. WHERE clause matches: N/A — pure ALTER TYPE ADD VALUE + ADD COLUMN.
--    No row UPDATE / DELETE / UPSERT runs in this migration.
-- 2. Columns overwritten / rows deleted: NONE. New columns are nullable
--    or have non-destructive defaults that match the previous behaviour
--    (theme='system', showCents=true, compactMode=false,
--    financialYearStart='07-01').
-- 3. Guard ensuring this only mutates rows I created: N/A — schema only.
-- =============================================================================

-- 1. AuditAction enum extensions ------------------------------------------------

ALTER TYPE "AuditAction" ADD VALUE 'USER_DELETION_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DELETION_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'DATA_EXPORT_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'TRUSTED_CONTACT_UPDATED';

-- 2. user_preferences appearance columns ---------------------------------------

ALTER TABLE "user_preferences"
  ADD COLUMN "theme"              TEXT    NOT NULL DEFAULT 'system',
  ADD COLUMN "showCents"          BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "compactMode"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "financialYearStart" TEXT    NOT NULL DEFAULT '07-01';

-- 3. users trusted-contact + deletion-lifecycle columns ------------------------

ALTER TABLE "users"
  ADD COLUMN "trustedContactName"         TEXT,
  ADD COLUMN "trustedContactEmail"        TEXT,
  ADD COLUMN "trustedContactPhone"        TEXT,
  ADD COLUMN "trustedContactRelationship" TEXT,
  ADD COLUMN "trustedContactUpdatedAt"    TIMESTAMP(3),
  ADD COLUMN "deletionRequestedAt"        TIMESTAMP(3),
  ADD COLUMN "deletionScheduledFor"       TIMESTAMP(3);

-- Index for the Cloud Scheduler job that hard-deletes expired soft-deletes.
-- Partial index keeps it tiny; we only ever scan rows with a scheduled date.
CREATE INDEX "users_deletionScheduledFor_idx"
  ON "users"("deletionScheduledFor")
  WHERE "deletionScheduledFor" IS NOT NULL;
