-- Phase 47 — Signup consent + legal-document acceptance
--
-- Additive only. Creates:
--   - 2 new enums (ConsentDocumentType, ConsentSource)
--   - 1 new table (user_consents) with 3 indexes
--   - 6 new values on the existing AuditAction enum
--
-- CLAUDE.md §12.11 destructive-write checklist: N/A — pure additive.
-- No existing data is touched. No columns dropped, renamed, or backfilled.
--
-- Idempotency: wrapped in DO blocks for the enum CREATEs (matches prior
-- migrations in this repo — see 20260519100000_fix_pre_migration_cdr_tables_drift).

-- ============================================================================
-- 1. New enums
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "ConsentDocumentType" AS ENUM (
    'TERMS_OF_SERVICE',
    'PRIVACY_POLICY',
    'AFSL_BOUNDARY_DISCLOSURE',
    'MARKETING_COMMUNICATIONS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConsentSource" AS ENUM (
    'SIGNUP',
    'OAUTH_SIGNUP',
    'EXISTING_USER_MIGRATION',
    'SETTINGS_UPDATE',
    'VERSION_REACCEPT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. Extend the existing AuditAction enum with consent-event values
-- ============================================================================

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONSENT_TERMS_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONSENT_PRIVACY_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONSENT_AFSL_ACKNOWLEDGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONSENT_MARKETING_OPTED_IN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONSENT_MARKETING_OPTED_OUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONSENT_DOCUMENT_VERSION_REACCEPTED';

-- ============================================================================
-- 3. user_consents table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "user_consents" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "documentType"    "ConsentDocumentType" NOT NULL,
  "documentVersion" TEXT NOT NULL,
  "acceptedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ipAddressHash"   TEXT,
  "userAgent"       TEXT,
  "consentSource"   "ConsentSource" NOT NULL,
  "revokedAt"       TIMESTAMP(3),
  "revokedReason"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_consents_userId_documentType_idx"
  ON "user_consents"("userId", "documentType");

CREATE INDEX IF NOT EXISTS "user_consents_acceptedAt_idx"
  ON "user_consents"("acceptedAt");

CREATE INDEX IF NOT EXISTS "user_consents_documentType_documentVersion_idx"
  ON "user_consents"("documentType", "documentVersion");

DO $$ BEGIN
  ALTER TABLE "user_consents"
    ADD CONSTRAINT "user_consents_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
