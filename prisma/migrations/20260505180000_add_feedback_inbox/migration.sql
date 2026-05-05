-- Phase 33g — Adviser Feedback Inbox
--
-- Async feedback channel for post-pitch + pilot advisers. Up Next #35.
--
-- Migration shape (purely additive):
--   1. Create 4 enums: FeedbackSurfaceTag, FeedbackSeverity,
--      FeedbackStatus, FeedbackAuthorRole
--   2. Create `feedback_threads` table + FKs to users + organizations
--   3. Create `feedback_messages` table + FKs to feedback_threads + users
--   4. Add indexes for common query paths
--
-- CLAUDE.md §12.11 destructive-write checklist: NOT REQUIRED — this
-- migration only adds new objects. No UPDATE / DELETE on existing rows.
-- No DROP / ALTER TABLE on existing columns. No data migration needed.
--
-- Design doc: docs/blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md

-- =============================================================================
-- 0. EXTEND AuditAction enum (additive — 3 new values)
-- =============================================================================

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FEEDBACK_THREAD_REPLIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FEEDBACK_THREAD_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FEEDBACK_INTERNAL_NOTE_UPDATED';

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

CREATE TYPE "FeedbackSurfaceTag" AS ENUM (
  'BUG',
  'FEATURE',
  'UX',
  'PRAISE',
  'QUESTION',
  'COMPLIANCE'
);

CREATE TYPE "FeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE "FeedbackStatus" AS ENUM (
  'OPEN',
  'IN_REVIEW',
  'PLANNED',
  'SHIPPED',
  'WONT_FIX',
  'DUPLICATE'
);

CREATE TYPE "FeedbackAuthorRole" AS ENUM ('ADVISER', 'MONITRAX_ADMIN');

-- =============================================================================
-- 2. feedback_threads
-- =============================================================================

CREATE TABLE "feedback_threads" (
  "id"              TEXT                  NOT NULL,
  "userId"          TEXT                  NOT NULL,
  "organizationId"  TEXT,
  "subject"         VARCHAR(140)          NOT NULL,
  "surfaceRoute"    TEXT,
  "surfaceTag"      "FeedbackSurfaceTag"  NOT NULL,
  "severity"        "FeedbackSeverity"    NOT NULL DEFAULT 'MEDIUM',
  "status"          "FeedbackStatus"      NOT NULL DEFAULT 'OPEN',
  "internalNotes"   TEXT,
  "taggedForAi"     BOOLEAN               NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)          NOT NULL,
  "lastReviewedAt"  TIMESTAMP(3),

  CONSTRAINT "feedback_threads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_threads_userId_idx"         ON "feedback_threads"("userId");
CREATE INDEX "feedback_threads_organizationId_idx" ON "feedback_threads"("organizationId");
CREATE INDEX "feedback_threads_status_idx"         ON "feedback_threads"("status");
CREATE INDEX "feedback_threads_createdAt_idx"      ON "feedback_threads"("createdAt");

ALTER TABLE "feedback_threads"
  ADD CONSTRAINT "feedback_threads_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback_threads"
  ADD CONSTRAINT "feedback_threads_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 3. feedback_messages
-- =============================================================================

CREATE TABLE "feedback_messages" (
  "id"          TEXT                  NOT NULL,
  "threadId"    TEXT                  NOT NULL,
  "authorId"    TEXT                  NOT NULL,
  "authorRole"  "FeedbackAuthorRole"  NOT NULL,
  "body"        TEXT                  NOT NULL,
  "createdAt"   TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feedback_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_messages_threadId_idx" ON "feedback_messages"("threadId");
CREATE INDEX "feedback_messages_authorId_idx" ON "feedback_messages"("authorId");

ALTER TABLE "feedback_messages"
  ADD CONSTRAINT "feedback_messages_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "feedback_threads"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback_messages"
  ADD CONSTRAINT "feedback_messages_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
