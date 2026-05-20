-- Phase 12 Track F.3 — Onboarding two-way sync (accounts domain).
--
-- Additive only: three new enum values on AuditAction. No DDL on existing
-- tables, no destructive operations, no defaults to backfill. Safe on prod.
--
-- Track F.3 makes the account entity API (/api/accounts) the onboarding
-- wizard's SSOT write boundary for MANUAL bank accounts, so every
-- manual-account write is now audited per CLAUDE.md §12.5. BASIQ / IMPORT
-- accounts are externally sourced (Open Banking / file import) and are
-- never written by the wizard's two-way sync — they keep their own
-- provenance.
--
-- See:
--   docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md §5 (write contract)
--   CLAUDE.md §12.11 (destructive-write checklist — N/A here, additive only)
--   CLAUDE.md §12.12 (schema-deploy protocol — additive migration)
--   CLAUDE.md §13.3 (audit metadata carries type + booleans only)
--
-- Pattern mirrors 20260520140000_phase_12_track_f2_property_audit_actions.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETED';
