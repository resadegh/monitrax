-- Phase 32C PR4c — Professional Request Lifecycle
--
-- Additive migration. Creates `professional_requests` table + two new enums
-- (`RequestStatus`, `LeadFeeTier`) + extends `AuditAction` with five new
-- lifecycle values. No existing rows are touched. CLAUDE.md §12.11 N/A
-- (no update/upsert/delete/raw UPDATE on existing rows).

-- 1. Extend AuditAction with request-lifecycle events (additive).

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_REQUEST_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_REQUEST_ACCEPTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_REQUEST_DECLINED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_REQUEST_WITHDRAWN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROFESSIONAL_REQUEST_EXPIRED';

-- 2. New enums.

CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');

CREATE TYPE "LeadFeeTier" AS ENUM ('EMERGING', 'GROWING', 'ESTABLISHED');

-- 3. ProfessionalRequest table.

CREATE TABLE "professional_requests" (
  "id"                   TEXT NOT NULL,
  "requesterUserId"      TEXT NOT NULL,
  "listingId"            TEXT NOT NULL,
  "contextLabel"         TEXT,
  "question"             TEXT NOT NULL,
  "snapshotContextJson"  JSONB,
  "status"               "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt"          TIMESTAMP(3),
  "respondedByMemberId"  TEXT,
  "declineReason"        TEXT,
  "withdrawnAt"          TIMESTAMP(3),
  "leadFeeTier"          "LeadFeeTier",
  "leadFeeAmount"        DECIMAL(10, 2),
  "leadFeeChargedAt"     TIMESTAMP(3),
  "clientLinkId"         TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,

  CONSTRAINT "professional_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "professional_requests_clientLinkId_key" ON "professional_requests"("clientLinkId");
CREATE INDEX "professional_requests_requesterUserId_status_idx" ON "professional_requests"("requesterUserId", "status");
CREATE INDEX "professional_requests_listingId_status_idx" ON "professional_requests"("listingId", "status");
CREATE INDEX "professional_requests_status_submittedAt_idx" ON "professional_requests"("status", "submittedAt");

ALTER TABLE "professional_requests"
  ADD CONSTRAINT "professional_requests_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_requests"
  ADD CONSTRAINT "professional_requests_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "professional_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_requests"
  ADD CONSTRAINT "professional_requests_respondedByMemberId_fkey"
  FOREIGN KEY ("respondedByMemberId") REFERENCES "organization_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
