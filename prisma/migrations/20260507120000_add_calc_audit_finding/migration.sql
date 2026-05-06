-- Phase 41i.3 — Calculation Audit Findings (persistent storage)
--
-- Adds the `calc_audit_findings` table + three supporting enums so the
-- audit system can persist drift/error events for admin triage.
-- Per HR-3 (Phase 41 §1 invariant 11), this is admin-side only — no
-- user-facing surface reads from this table.
--
-- CLAUDE.md §12.11 destructive-write checklist: N/A — additive table,
-- new enums, no existing rows updated/upserted/deleted.
-- CLAUDE.md §12.12 schema-change protocol: this file ships in the same
-- PR as `prisma/schema.prisma`.

-- 1. Enums

CREATE TYPE "CalcAuditFindingSource" AS ENUM (
  'L1_DIFFERENTIAL',
  'L3_ON_DEMAND',
  'L2_ANOMALY'
);

CREATE TYPE "CalcAuditFindingSeverity" AS ENUM (
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

CREATE TYPE "CalcAuditFindingResolution" AS ENUM (
  'OPEN',
  'INVESTIGATING',
  'FALSE_POSITIVE',
  'FIX_REQUIRED',
  'FIXED'
);

-- 2. Table

CREATE TABLE "calc_audit_findings" (
  "id" TEXT NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "CalcAuditFindingSource" NOT NULL,
  "engineName" TEXT NOT NULL,
  "fixtureName" TEXT,
  "userId" TEXT,
  "severity" "CalcAuditFindingSeverity" NOT NULL DEFAULT 'MEDIUM',
  "resolution" "CalcAuditFindingResolution" NOT NULL DEFAULT 'OPEN',
  "summary" TEXT NOT NULL,
  "failedAssertions" JSONB,
  "errorMessage" TEXT,
  "adminNotes" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calc_audit_findings_pkey" PRIMARY KEY ("id")
);

-- 3. Indexes

CREATE INDEX "calc_audit_findings_source_resolution_idx"
  ON "calc_audit_findings"("source", "resolution");

CREATE INDEX "calc_audit_findings_engineName_idx"
  ON "calc_audit_findings"("engineName");

CREATE INDEX "calc_audit_findings_detectedAt_idx"
  ON "calc_audit_findings"("detectedAt");

CREATE INDEX "calc_audit_findings_resolution_severity_idx"
  ON "calc_audit_findings"("resolution", "severity");
