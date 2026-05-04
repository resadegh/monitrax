-- Phase 32B PR3 — drill-in canonical client view
--
-- Adds PRO_DASHBOARD_VIEW to the AuditAction enum so the master financial
-- service can emit a top-level audit row each time a professional renders the
-- canonical consumer dashboard for one of their clients. This sits alongside
-- the per-view ClientAccessLog row (which uses a free-form String action and
-- already supports PRO_VIEW / PRO_NOTE / PRO_TASK / PRO_EXPORT per the
-- 3-layer consent model in docs/architecture/03_DATA_MODEL.md §9.2).
--
-- Additive ALTER TYPE — no DROP, no rewrite of existing rows. §12.11 N/A.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PRO_DASHBOARD_VIEW';
