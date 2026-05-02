-- Phase 40: My Guide AI Financial Advice
--
-- Adds two new tables for the AI advisor surface on /dashboard/cfo:
--   • AIAdviceDocument     — cached AI-generated advice doc (24h TTL)
--   • AIAdviceChatMessage  — follow-up Q&A scoped to an advice doc
--
-- Both are additive — no DROP, no ALTER on existing tables. Per CLAUDE.md
-- §12.11 destructive-write checklist: this migration creates new structures
-- only, so the checklist is N/A.

-- CreateTable
CREATE TABLE "AIAdviceDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "trailStage" TEXT NOT NULL,
    "document" JSONB NOT NULL,
    "modelUsed" TEXT,
    "tokensUsed" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAdviceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIAdviceChatMessage" (
    "id" TEXT NOT NULL,
    "adviceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIAdviceChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIAdviceDocument_userId_expiresAt_idx" ON "AIAdviceDocument"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AIAdviceDocument_userId_fingerprint_idx" ON "AIAdviceDocument"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "AIAdviceChatMessage_adviceId_createdAt_idx" ON "AIAdviceChatMessage"("adviceId", "createdAt");

-- AddForeignKey
ALTER TABLE "AIAdviceDocument" ADD CONSTRAINT "AIAdviceDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIAdviceChatMessage" ADD CONSTRAINT "AIAdviceChatMessage_adviceId_fkey" FOREIGN KEY ("adviceId") REFERENCES "AIAdviceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
