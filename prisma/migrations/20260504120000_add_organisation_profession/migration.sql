-- Phase 32 B2B2C / Practice surface bootstrap
--
-- Adds `profession` to Organization. Re-uses the existing OrganizationType
-- enum (defined in earlier portal migrations) so this is purely additive — no
-- new types, no DROP, no destructive write. Forced at registration; no MULTI.
-- The legacy OrganizationPortalSettings.organizationType column becomes a
-- shadow of this canonical field; dedup is queued in IMPLEMENTATION_PLAN.md
-- under 🗑️ Dead Code (a follow-up PR will collapse the duplicate after
-- backfilling existing settings rows into the parent organisation).
--
-- Backfill: existing organisations get the OrganizationType from their
-- portal_settings row if one exists; otherwise the default
-- (FINANCIAL_ADVISOR) applies. This means firms already registered with a
-- non-default OrganizationType (e.g. ACCOUNTING_FIRM) keep their identity
-- after this migration runs.

ALTER TABLE "organizations"
  ADD COLUMN "profession" "OrganizationType" NOT NULL DEFAULT 'FINANCIAL_ADVISOR';

UPDATE "organizations" o
SET "profession" = ops."organizationType"
FROM "organization_portal_settings" ops
WHERE ops."organizationId" = o.id;
