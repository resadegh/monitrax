-- 2026-06-11 — Backfill twelve AuditAction enum values that were referenced
-- by createAuditLog() call sites but never added to the enum.
--
-- Root cause: lib/security/auditLog.ts typed `action` as `string` and cast
-- `as any` into Prisma, so TypeScript never caught the missing values. At
-- runtime every such prisma.auditLog.create() failed with "Invalid value
-- for argument `action`. Expected AuditAction." and the fire-and-forget
-- `.catch(() => {})` swallowed it — ZERO audit rows were ever written for
-- these surfaces. Found via prod runtime logs (CLAUDE.md §17.3) on
-- 2026-06-11. The auditLog service now uses the Prisma-generated enum type
-- so future drift is a compile error.
--
-- Additive only: enum value additions. No DDL on existing tables, no
-- destructive operations, nothing to backfill. Safe on prod.
--
-- Affected surfaces (all silently un-audited until this migration):
--   Phase 40   — AI advice generation / chat / scenario runs (/api/cfo/*)
--   Phase 41   — AI tax advisor invocations (ProductionAuditSink)
--   Admin      — admin portal login (/api/admin/auth/login)
--   Ownership  — ownership-record correction sweep
--   Phase 32B  — org portal seat invitations
--   Phase 45.2.5 — property hero image upload/remove
--   Phase 44.2 — SMSF annual-return save
--   Phase 12 F.1 — household-profile SSOT route create/update
--
-- See:
--   CLAUDE.md §12.5 (audit everything), §12.12 (schema-deploy protocol),
--   §13.3 (metadata stays CDR-safe — unchanged by this migration)
--   docs/changelog/CHANGELOG_2026_06_11.md
--
-- Pattern mirrors 20260520180000_phase_12_track_f5_investment_audit_actions.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_ADVICE_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_ADVICE_CHAT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CFO_SCENARIO_RUN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_ADVISOR_INVOCATION';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_LOGIN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'OWNERSHIP_RECORD_CORRECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PORTAL_SEAT_INVITED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROPERTY_HERO_IMAGE_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PROPERTY_HERO_IMAGE_REMOVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SMSF_RETURN_SAVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HOUSEHOLD_PROFILE_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'HOUSEHOLD_PROFILE_UPDATED';
