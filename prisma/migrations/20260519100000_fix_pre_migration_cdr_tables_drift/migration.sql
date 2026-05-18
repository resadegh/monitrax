-- 2026-05-19 — Pre-migration-era prod schema drift fix (Tech Debt #18).
--
-- Three CDR-critical models (CDRConsent / CDRComplaint / CDRDisclosure)
-- and their four supporting enums (CDRConsentStatus / CDRComplaintCategory
-- / CDRComplaintStatus / CDRDisclosureType) were added to schema.prisma
-- during the Phase L CDR remediation (Fix G18 + G43, 2026-04-11) but
-- shipped via the historical `prisma db push` workflow that never created
-- a migration file. Result: the models exist in dev (which got the
-- `db push`) but were never created in prod. Detected 2026-05-19 by the
-- `GET /api/admin/schema-drift` audit endpoint:
--
--   summary: {
--     missingTables: 3,        // cdr_consents, cdr_complaints, cdr_disclosures
--     missingEnums:  4,        // CDRConsentStatus, CDRComplaintCategory,
--                              // CDRComplaintStatus, CDRDisclosureType
--     hasDrift: true,
--   }
--
-- This migration is "fix forward" — it brings prod in line with the
-- schema. On dev (where the objects already exist via `db push`) every
-- DDL is wrapped in `DO $$ ... EXCEPTION ... END $$` (for CREATE TYPE)
-- or guarded by `IF NOT EXISTS` (for CREATE TABLE / CREATE INDEX) so
-- the migration is idempotent. Same pattern as the
-- `20260514130000_fix_basiq_connection_consent_columns` corrective
-- migration that resolved a similar drift for `basiq_connections` on
-- 2026-05-12.
--
-- Per CLAUDE.md §12.11 destructive-write checklist:
--   • Operation: CREATE TYPE × 4 + CREATE TABLE × 3 + CREATE INDEX × 7
--     (purely additive — no DROP, no ALTER existing, no row mutation)
--   • Columns overwritten: NONE — only NEW columns / tables / enums
--   • Guard: every DDL is idempotent; no destructive side effects
--   → §12.11 N/A by structural argument. User confirmation: NOT REQUIRED.
--
-- Per CLAUDE.md §12.12 — schema.prisma was already in sync with these
-- definitions before this migration was written; this migration brings
-- prod's `information_schema` + `pg_catalog` in line with what schema.prisma
-- has declared since 2026-04-11. No schema.prisma change in this PR.
--
-- Pre-Basiq blocker: the audit endpoint runs against
-- `information_schema` + `pg_catalog` (no Prisma type knowledge) so a
-- table missing from prod is a `SELECT *` time-bomb. The four current
-- consumer sites (`app/api/admin/cdr/compliance/route.ts`,
-- `app/api/admin/cdr/complaints/route.ts`,
-- `app/api/admin/cdr/complaints/[id]/route.ts`,
-- `app/api/admin/cdr/consent/route.ts`) all wrap their queries in
-- `.catch(() => 0)` so they degrade gracefully today, but a future
-- caller without that defensive pattern would crash. This migration
-- removes the latent risk before Basiq submission.

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "CDRConsentStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'EXPIRED',
    'REVOKED',
    'WITHDRAWN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CDRComplaintCategory" AS ENUM (
    'DATA_ACCESS',
    'DATA_DELETION',
    'CONSENT_MANAGEMENT',
    'DATA_ACCURACY',
    'PRIVACY',
    'SERVICE',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CDRComplaintStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'ESCALATED',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CDRDisclosureType" AS ENUM (
    'CONSUMER_REQUESTED',
    'REGULATORY',
    'LEGAL',
    'INTERNAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- cdr_consents (model CDRConsent — Phase L Fix G18)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "cdr_consents" (
  "id"                TEXT                NOT NULL,
  "userId"            TEXT                NOT NULL,
  "consentStatus"     "CDRConsentStatus"  NOT NULL DEFAULT 'PENDING',
  "scope"             TEXT[]              NOT NULL DEFAULT ARRAY[]::TEXT[],
  "legalBasis"        TEXT,
  "grantedAt"         TIMESTAMP(3),
  "expiresAt"         TIMESTAMP(3),
  "revokedAt"         TIMESTAMP(3),
  "revokedReason"     TEXT,
  "basiqConnectionId" TEXT,
  "organizationId"    TEXT,
  "createdAt"         TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)        NOT NULL,
  CONSTRAINT "cdr_consents_pkey" PRIMARY KEY ("id")
);

-- FK: cdr_consents.userId -> users.id ON DELETE CASCADE
DO $$ BEGIN
  ALTER TABLE "cdr_consents"
    ADD CONSTRAINT "cdr_consents_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "cdr_consents_userId_idx"        ON "cdr_consents"("userId");
CREATE INDEX IF NOT EXISTS "cdr_consents_consentStatus_idx" ON "cdr_consents"("consentStatus");
CREATE INDEX IF NOT EXISTS "cdr_consents_expiresAt_idx"     ON "cdr_consents"("expiresAt");

-- ============================================================================
-- cdr_complaints (model CDRComplaint — Phase L Fix G43)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "cdr_complaints" (
  "id"                TEXT                    NOT NULL,
  "userId"            TEXT,
  "complainantName"   TEXT,
  "complainantEmail"  TEXT,
  "category"          "CDRComplaintCategory"  NOT NULL,
  "description"       TEXT                    NOT NULL,
  "status"            "CDRComplaintStatus"    NOT NULL DEFAULT 'OPEN',
  "resolution"        TEXT,
  "resolvedAt"        TIMESTAMP(3),
  "resolvedBy"        TEXT,
  "escalatedToOAIC"   BOOLEAN                 NOT NULL DEFAULT false,
  "oaicReferenceId"   TEXT,
  "createdAt"         TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)            NOT NULL,
  CONSTRAINT "cdr_complaints_pkey" PRIMARY KEY ("id")
);

-- FK: cdr_complaints.userId -> users.id ON DELETE SET NULL
DO $$ BEGIN
  ALTER TABLE "cdr_complaints"
    ADD CONSTRAINT "cdr_complaints_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "cdr_complaints_userId_idx" ON "cdr_complaints"("userId");
CREATE INDEX IF NOT EXISTS "cdr_complaints_status_idx" ON "cdr_complaints"("status");

-- ============================================================================
-- cdr_disclosures (model CDRDisclosure — Phase L Fix G43)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "cdr_disclosures" (
  "id"             TEXT                NOT NULL,
  "userId"         TEXT                NOT NULL,
  "disclosedTo"    TEXT                NOT NULL,
  "disclosureType" "CDRDisclosureType" NOT NULL,
  "dataScope"      TEXT[]              NOT NULL DEFAULT ARRAY[]::TEXT[],
  "legalBasis"     TEXT                NOT NULL,
  "consentId"      TEXT,
  "createdAt"      TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cdr_disclosures_pkey" PRIMARY KEY ("id")
);

-- FK: cdr_disclosures.userId -> users.id ON DELETE CASCADE
DO $$ BEGIN
  ALTER TABLE "cdr_disclosures"
    ADD CONSTRAINT "cdr_disclosures_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "cdr_disclosures_userId_idx"    ON "cdr_disclosures"("userId");
CREATE INDEX IF NOT EXISTS "cdr_disclosures_createdAt_idx" ON "cdr_disclosures"("createdAt");
