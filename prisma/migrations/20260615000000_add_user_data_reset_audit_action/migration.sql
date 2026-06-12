-- 2026-06-12 — "Start fresh" account data reset (Settings → Privacy
-- Danger Zone). New audit action fired once per completed reset by
-- lib/services/accountReset.ts (CLAUDE.md §12.5 audit-everything).
--
-- Additive only: one enum value. No DDL on tables, nothing to backfill.
-- Safe on prod. Pattern mirrors 20260614000000_fix_missing_audit_action_enum_values.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'USER_DATA_RESET';
