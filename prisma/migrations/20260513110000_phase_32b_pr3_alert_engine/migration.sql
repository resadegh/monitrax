-- Phase 32B PR3 #9a — Real Alert Engine foundation (2026-05-09)
--
-- Adds the alert-engine storage layer for the Practice dashboard's
-- alert stream. Everything in this migration is purely additive:
--   1. New enum `ClientAlertStatus` (ACTIVE / DISMISSED / RESOLVED).
--   2. New table `client_alerts` — one live row per
--      (organizationClientId, triggerKind) at a time.
--   3. New table `client_snapshot_markers` — prior-state for the
--      delta-based triggers (HEALTH_DROP, TRAIL_ADVANCED); one row
--      per client.
-- No row UPDATE / DELETE / UPSERT, no destructive ALTER. §12.11 N/A.
--
-- NOTE: this migration SQL was hand-written (the dev DB is not
-- reachable from the build sandbox so `prisma migrate dev` couldn't
-- generate it). It is purely additive `CREATE TYPE` / `CREATE TABLE` /
-- `CREATE INDEX` / `ADD CONSTRAINT` — the Vercel preview build's
-- `prisma migrate deploy` against monitrax-db-dev is the validation
-- (CLAUDE.md §12.12). The follow-up code matches the schema exactly.

-- CreateEnum
CREATE TYPE "ClientAlertStatus" AS ENUM (
  'ACTIVE',
  'DISMISSED',
  'RESOLVED'
);

-- CreateTable
CREATE TABLE "client_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationClientId" TEXT NOT NULL,
    "triggerKind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" "ClientAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "primaryActionLabel" TEXT NOT NULL,
    "payload" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "dismissedByMemberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_snapshot_markers" (
    "id" TEXT NOT NULL,
    "organizationClientId" TEXT NOT NULL,
    "lastHealthScore" INTEGER,
    "lastTrailStage" TEXT,
    "lastSweptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_snapshot_markers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_alerts_organizationClientId_triggerKind_key" ON "client_alerts"("organizationClientId", "triggerKind");

-- CreateIndex
CREATE INDEX "client_alerts_organizationId_status_idx" ON "client_alerts"("organizationId", "status");

-- CreateIndex
CREATE INDEX "client_alerts_organizationClientId_idx" ON "client_alerts"("organizationClientId");

-- CreateIndex
CREATE INDEX "client_alerts_status_idx" ON "client_alerts"("status");

-- CreateIndex
CREATE INDEX "client_alerts_triggerKind_idx" ON "client_alerts"("triggerKind");

-- CreateIndex
CREATE UNIQUE INDEX "client_snapshot_markers_organizationClientId_key" ON "client_snapshot_markers"("organizationClientId");

-- AddForeignKey
ALTER TABLE "client_alerts"
    ADD CONSTRAINT "client_alerts_organizationClientId_fkey"
        FOREIGN KEY ("organizationClientId") REFERENCES "organization_clients"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_snapshot_markers"
    ADD CONSTRAINT "client_snapshot_markers_organizationClientId_fkey"
        FOREIGN KEY ("organizationClientId") REFERENCES "organization_clients"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
