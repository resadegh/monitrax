-- Phase R-Charts-2 (2026-05-30) — Net Worth historical snapshots
--
-- Additive only. Creates one new table; touches no existing table.
--   - "net_worth_snapshots" — per-user × per-month aggregate of net worth
--     (totalAssets, totalLiabilities, netWorth). Unique on
--     (userId, snapshotDate). `snapshotDate` is the first day of the
--     calendar month the row represents (UTC). The recorder upserts on
--     every dashboard load so the current month always reflects the
--     latest position; once the calendar rolls over, the previous month
--     freezes.
--
-- Purpose: replaces the simulated `generateNetWorthTrendData` (Math.random)
-- used by the legacy NetWorthTrend component on /dashboard. The editorial
-- trend chart shows a quiet empty state until ≥2 months of real history
-- accrue — matching the Money Story v2 "ribbon unlocks after 2 months"
-- pattern.
--
-- CLAUDE.md §12.11 destructive-write checklist: N/A — pure additive
--   (CREATE TABLE + indexes + FK only). No UPDATE/DELETE, no DROP/ALTER ...
--   DROP/TRUNCATE, no backfill. No existing row touched.
--
-- CLAUDE.md §12.12: matching schema.prisma change ships in the same PR.
-- CLAUDE.md §12.14: N/A — no tax-engine / reform interaction (display
--   aggregate of existing values, regime-neutral).

CREATE TABLE "net_worth_snapshots" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "totalAssets" DOUBLE PRECISION NOT NULL,
    "totalLiabilities" DOUBLE PRECISION NOT NULL,
    "netWorth" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "net_worth_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "net_worth_snapshots_userId_snapshotDate_key" ON "net_worth_snapshots"("userId", "snapshotDate");

CREATE INDEX "net_worth_snapshots_userId_idx" ON "net_worth_snapshots"("userId");

ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
