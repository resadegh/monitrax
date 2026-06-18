-- Phase 50 D.4 — Learned routing (suggest-only).
-- Remembers which entity a user chose for documents from a given vendor so the
-- next document from that vendor can PRE-SELECT the same entity. Suggestion
-- layer only; never writes a financial record or applies a link on its own.

CREATE TABLE "vendor_entity_hints" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorKey" TEXT NOT NULL,
    "entityType" "LinkedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_entity_hints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_entity_hints_userId_vendorKey_idx" ON "vendor_entity_hints"("userId", "vendorKey");

CREATE UNIQUE INDEX "vendor_entity_hints_userId_vendorKey_entityType_entityId_key" ON "vendor_entity_hints"("userId", "vendorKey", "entityType", "entityId");

ALTER TABLE "vendor_entity_hints" ADD CONSTRAINT "vendor_entity_hints_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
