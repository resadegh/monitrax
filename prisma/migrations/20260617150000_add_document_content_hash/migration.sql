-- Phase 50 D.1 — document-level dedup.
-- Adds a nullable SHA-256 content hash to documents + a (userId, contentHash)
-- index so processUpload can detect a byte-identical re-upload before storing.
-- Additive + nullable: safe, no backfill required (old rows keep contentHash NULL).

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "contentHash" TEXT;

-- CreateIndex
CREATE INDEX "documents_userId_contentHash_idx" ON "documents"("userId", "contentHash");
