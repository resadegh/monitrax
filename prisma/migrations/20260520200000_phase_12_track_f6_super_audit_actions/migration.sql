-- Phase 12 Track F.6 — Onboarding two-way sync (superannuation domain).
--
-- Additive only: three new enum values on AuditAction. No DDL on existing
-- tables, no destructive operations, no defaults to backfill. Safe on prod.
--
-- Track F.6 makes the super API (/api/tax/super [+ the new /[id] route])
-- the onboarding wizard's SSOT write boundary for `SuperannuationAccount`,
-- so every super-account write is now audited per CLAUDE.md §12.5.
--
-- See:
--   docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md §5 (write contract)
--   CLAUDE.md §12.11 (destructive-write checklist — N/A here, additive only)
--   CLAUDE.md §12.12 (schema-deploy protocol — additive migration)
--   CLAUDE.md §13.3 (audit metadata carries booleans only)
--
-- Pattern mirrors 20260520180000_phase_12_track_f5_investment_audit_actions.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SUPER_DELETED';
