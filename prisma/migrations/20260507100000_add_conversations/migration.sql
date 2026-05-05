-- Phase 32C PR4d — In-app conversations + email-through-app
--
-- Additive migration. Creates 3 tables (`professional_conversations`,
-- `conversation_participants`, `conversation_messages`) + 2 enums
-- (`ConversationRole`, `MessageChannel`) + extends `AuditAction` with 5
-- new lifecycle values. CLAUDE.md §12.11 N/A — no row mutations.

-- 1. Extend AuditAction (additive enum values)

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_MESSAGE_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_EMAIL_OUTBOUND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_EMAIL_INBOUND';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONVERSATION_SOFT_DELETED_FROM_USER';

-- 2. New enums

CREATE TYPE "ConversationRole" AS ENUM ('CONSUMER', 'PROFESSIONAL', 'AI_HELPER');
CREATE TYPE "MessageChannel" AS ENUM ('IN_APP', 'EMAIL_OUT', 'EMAIL_IN', 'SYSTEM');

-- 3. ProfessionalConversation

CREATE TABLE "professional_conversations" (
  "id"             TEXT NOT NULL,
  "requestId"      TEXT,
  "organizationId" TEXT NOT NULL,
  "replyToSlug"    TEXT NOT NULL,
  "subject"        VARCHAR(160) NOT NULL,
  "isClosed"       BOOLEAN NOT NULL DEFAULT false,
  "closedAt"       TIMESTAMP(3),
  "closedByUserId" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "lastMessageAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "professional_conversations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "professional_conversations_requestId_key" ON "professional_conversations"("requestId");
CREATE UNIQUE INDEX "professional_conversations_replyToSlug_key" ON "professional_conversations"("replyToSlug");
CREATE INDEX "professional_conversations_organizationId_lastMessageAt_idx"
  ON "professional_conversations"("organizationId", "lastMessageAt" DESC);
CREATE INDEX "professional_conversations_replyToSlug_idx" ON "professional_conversations"("replyToSlug");

ALTER TABLE "professional_conversations"
  ADD CONSTRAINT "professional_conversations_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "professional_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "professional_conversations"
  ADD CONSTRAINT "professional_conversations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. ConversationParticipant

CREATE TABLE "conversation_participants" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId"         TEXT,
  "memberId"       TEXT,
  "role"           "ConversationRole" NOT NULL,
  "hiddenFromUser" BOOLEAN NOT NULL DEFAULT false,
  "hiddenAt"       TIMESTAMP(3),
  "lastReadAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_participants_conversationId_userId_memberId_key"
  ON "conversation_participants"("conversationId", "userId", "memberId");
CREATE INDEX "conversation_participants_conversationId_idx" ON "conversation_participants"("conversationId");
CREATE INDEX "conversation_participants_userId_idx" ON "conversation_participants"("userId");
CREATE INDEX "conversation_participants_memberId_idx" ON "conversation_participants"("memberId");

ALTER TABLE "conversation_participants"
  ADD CONSTRAINT "conversation_participants_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "professional_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_participants"
  ADD CONSTRAINT "conversation_participants_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_participants"
  ADD CONSTRAINT "conversation_participants_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "organization_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. ConversationMessage

CREATE TABLE "conversation_messages" (
  "id"                TEXT NOT NULL,
  "conversationId"    TEXT NOT NULL,
  "senderUserId"      TEXT,
  "senderRole"        "ConversationRole" NOT NULL,
  "body"              TEXT NOT NULL,
  "channel"           "MessageChannel" NOT NULL DEFAULT 'IN_APP',
  "externalMessageId" TEXT,
  "inboundFromEmail"  TEXT,
  "inboundSubject"    TEXT,
  "retentionUntil"    TIMESTAMP(3) NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_messages_conversationId_createdAt_idx"
  ON "conversation_messages"("conversationId", "createdAt");
CREATE INDEX "conversation_messages_retentionUntil_idx" ON "conversation_messages"("retentionUntil");

ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "professional_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_senderUserId_fkey"
  FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
