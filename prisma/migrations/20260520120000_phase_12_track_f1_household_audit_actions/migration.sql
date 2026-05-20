-- Phase 12 Track F.1 — Onboarding two-way sync (household domain).
--
-- Additive only: six new enum values on AuditAction. No DDL on existing
-- tables, no destructive operations, no defaults to backfill. Safe on prod.
--
-- Track F.1 makes the household entity APIs (/api/household-members,
-- /api/household-pets) the onboarding wizard's SSOT write boundary, so
-- every household write is now audited per CLAUDE.md §12.5. These six
-- values back those createAuditLog() calls.
--
-- See:
--   docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md §5 (write contract)
--   CLAUDE.md §12.11 (destructive-write checklist — N/A here, additive only)
--   CLAUDE.md §12.12 (schema-deploy protocol — additive migration)
--   CLAUDE.md §13.3 (audit metadata carries relationship/type + booleans
--     only, never CDR/financial values)
--
-- Pattern mirrors 20260517100000_phase_12_track_e_audit_actions.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HOUSEHOLD_MEMBER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HOUSEHOLD_MEMBER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HOUSEHOLD_MEMBER_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HOUSEHOLD_PET_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HOUSEHOLD_PET_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HOUSEHOLD_PET_DELETED';
