-- Phase 12 Track F.7 — Onboarding two-way sync (assets domain).
--
-- Additive only: three new enum values on AuditAction. No DDL on existing
-- tables, no destructive operations, no defaults to backfill. Safe on prod.
--
-- Track F.7 makes the asset entity API (/api/assets) the onboarding
-- wizard's SSOT write boundary for `Asset`, so every asset write is now
-- audited per CLAUDE.md §12.5. The nested asset-expense writes
-- (/api/expenses) use the existing generic CREATE/UPDATE/DELETE actions
-- with an entityType.
--
-- See:
--   docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md §5 (write contract)
--   CLAUDE.md §12.11 (destructive-write checklist — N/A here, additive only)
--   CLAUDE.md §12.12 (schema-deploy protocol — additive migration)
--   CLAUDE.md §13.3 (audit metadata carries type + booleans only)
--
-- Pattern mirrors 20260520200000_phase_12_track_f6_super_audit_actions.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ASSET_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ASSET_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ASSET_DELETED';
