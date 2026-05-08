-- Phase Production Readiness — Conversation retention audit action
--
-- Adds a new AuditAction enum value used by the retention sweeper that
-- hard-deletes ConversationMessage rows past their `retentionUntil`.
-- Fired ONCE per batch (aggregate metadata only — count + retention
-- window) because the per-message content is being purged at the same
-- instant; per-row audit would conflict with the purge intent.
--
-- Additive ALTER TYPE — §12.11 destructive write checklist N/A.
-- IF NOT EXISTS guards against re-application.

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_MESSAGES_PURGED';
