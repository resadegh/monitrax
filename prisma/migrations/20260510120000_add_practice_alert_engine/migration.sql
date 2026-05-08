-- Production Readiness chunk 2 — Real Practice Alert Engine v1.
--
-- Replaces the LIGHTHOUSE_ALERTS demo fixture with real triggers
-- derived from per-client snapshot deltas. Closes Phase 32B PR3
-- item #9.
--
-- Additive migration — no DROP, no destructive write per §12.11:
--   - 3 new enums (PracticeAlertTriggerKind / Severity / Status)
--   - 2 new tables (practice_alerts + practice_client_health_snapshots)
--   - 4 indexes (engine idempotency + adviser-side queries)
--   - FK cascade-delete from organizations + organization_clients so
--     org/client deletions don't leave orphan alert rows
-- §12.11 destructive-write checklist N/A — pure CREATE statements.

-- =============================================================================
-- Enums
-- =============================================================================

CREATE TYPE "PracticeAlertTriggerKind" AS ENUM (
  'TRAIL_ADVANCED',
  'HEALTH_DROP',
  'CASHFLOW_NEGATIVE',
  'EMERGENCY_FUND_LOW',
  'LVR_REFINANCE_WINDOW'
);

CREATE TYPE "PracticeAlertSeverity" AS ENUM (
  'CRITICAL',
  'OPPORTUNITY',
  'MILESTONE'
);

CREATE TYPE "PracticeAlertStatus" AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'AUTO_CLOSED'
);

-- =============================================================================
-- Practice Alert (adviser-facing surface)
-- =============================================================================

CREATE TABLE "practice_alerts" (
  "id"                       TEXT                           NOT NULL,
  "organizationId"           TEXT                           NOT NULL,
  "organizationClientId"     TEXT                           NOT NULL,
  "triggerKind"              "PracticeAlertTriggerKind"     NOT NULL,
  "severity"                 "PracticeAlertSeverity"        NOT NULL,
  "status"                   "PracticeAlertStatus"          NOT NULL DEFAULT 'OPEN',
  "headline"                 TEXT                           NOT NULL,
  "body"                     TEXT                           NOT NULL,
  "context"                  TEXT                           NOT NULL,
  "primaryActionLabel"       TEXT                           NOT NULL,
  "triggerSnapshot"          JSONB,
  "detectedAt"               TIMESTAMP(3)                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt"           TIMESTAMP(3),
  "acknowledgedByMemberId"   TEXT,
  "resolvedAt"               TIMESTAMP(3),
  "resolvedByMemberId"       TEXT,
  "resolvedReason"           TEXT,

  CONSTRAINT "practice_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "practice_alerts_organizationId_status_severity_idx"
  ON "practice_alerts"("organizationId", "status", "severity");

CREATE INDEX "practice_alerts_organizationClientId_status_idx"
  ON "practice_alerts"("organizationClientId", "status");

CREATE INDEX "practice_alerts_organizationClientId_triggerKind_status_idx"
  ON "practice_alerts"("organizationClientId", "triggerKind", "status");

ALTER TABLE "practice_alerts"
  ADD CONSTRAINT "practice_alerts_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "practice_alerts"
  ADD CONSTRAINT "practice_alerts_organizationClientId_fkey"
  FOREIGN KEY ("organizationClientId") REFERENCES "organization_clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Practice Client Health Snapshot (internal delta-tracking ledger)
-- =============================================================================

CREATE TABLE "practice_client_health_snapshots" (
  "id"                   TEXT         NOT NULL,
  "organizationClientId" TEXT         NOT NULL,
  "capturedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trailStage"           TEXT         NOT NULL,
  "healthScore"          INTEGER      NOT NULL,
  "monthlyCashflow"      DOUBLE PRECISION NOT NULL,
  "monthlyIncome"        DOUBLE PRECISION NOT NULL,
  "emergencyFundMonths"  DOUBLE PRECISION NOT NULL,
  "averageLvr"           DOUBLE PRECISION,

  CONSTRAINT "practice_client_health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "practice_client_health_snapshots_organizationClientId_capturedAt_idx"
  ON "practice_client_health_snapshots"("organizationClientId", "capturedAt" DESC);

ALTER TABLE "practice_client_health_snapshots"
  ADD CONSTRAINT "practice_client_health_snapshots_organizationClientId_fkey"
  FOREIGN KEY ("organizationClientId") REFERENCES "organization_clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
