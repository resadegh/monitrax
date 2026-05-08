-- Phase 33g.2 — Live AI Feedback Chat
--
-- Additive enum extensions only:
--   - FeedbackAuthorRole gains CONSUMER + CLAUDE_AI values
--   - AuditAction gains FEEDBACK_AI_REPLIED value
--
-- No tables created, no rows touched, no columns altered. Pure
-- ALTER TYPE ADD VALUE IF NOT EXISTS, idempotent + safe to retry.
--
-- CLAUDE.md §12.11 destructive-write checklist: NOT REQUIRED — no
-- UPDATE / DELETE on existing rows; ADD VALUE is purely additive.
--
-- Design doc: docs/blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md §7
-- (live-AI evolution path)

-- =============================================================================
-- FeedbackAuthorRole — add CONSUMER + CLAUDE_AI
-- =============================================================================

ALTER TYPE "FeedbackAuthorRole" ADD VALUE IF NOT EXISTS 'CONSUMER';
ALTER TYPE "FeedbackAuthorRole" ADD VALUE IF NOT EXISTS 'CLAUDE_AI';

-- =============================================================================
-- AuditAction — add FEEDBACK_AI_REPLIED
-- =============================================================================

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FEEDBACK_AI_REPLIED';
