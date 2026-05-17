-- Phase 12 Track E — Conversational onboarding audit actions.
--
-- Additive only: three new enum values on AuditAction. No DDL on existing
-- tables, no destructive operations, no defaults to backfill. Safe on prod.
--
-- See:
--   docs/blueprint/PHASE_12_CONVERSATIONAL_ONBOARDING.md §E.5
--   CLAUDE.md §12.11 (destructive-write checklist — N/A here)
--   CLAUDE.md §12.12 (schema-deploy protocol — additive migration)
--   CLAUDE.md §13.3 (audit metadata carries field NAMES only, never values)

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ONBOARDING_AGENT_EXTRACTION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ONBOARDING_AGENT_TOPIC_CONFIRMED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ONBOARDING_AGENT_MODE_SWITCHED';
