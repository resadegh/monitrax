-- Phase 12 Track F.2 — Onboarding two-way sync (properties domain).
--
-- Additive only: three new enum values on AuditAction. No DDL on existing
-- tables, no destructive operations, no defaults to backfill. Safe on prod.
--
-- Track F.2 makes the property entity API (/api/properties) the onboarding
-- wizard's SSOT write boundary for properties, so every property write is
-- now audited per CLAUDE.md §12.5. These three values back those
-- createAuditLog() calls. The rest of the F.2 "whole property aggregate"
-- (property-attached loan / rental income / expense rows) is audited via
-- the existing generic CREATE/UPDATE/DELETE actions with an entityType —
-- F.4 (debts) and F.8 (income/expenses) own those domains and may
-- introduce domain-specific actions later.
--
-- See:
--   docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md §5 (write contract)
--   CLAUDE.md §12.11 (destructive-write checklist — N/A here, additive only)
--   CLAUDE.md §12.12 (schema-deploy protocol — additive migration)
--   CLAUDE.md §13.3 (audit metadata carries type + booleans only, never
--     CDR/financial values)
--
-- Pattern mirrors 20260520120000_phase_12_track_f1_household_audit_actions.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROPERTY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROPERTY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROPERTY_DELETED';
