-- Phase 42 PR5 — Vendor + TaxCategoryMapping
--
-- Two new tables. Both additive — CREATE TABLE × 2, indexes, FKs.
-- NO row UPDATE / DELETE / UPSERT, NO destructive ALTER. CLAUDE.md
-- §12.11 N/A.
--
-- TaxCategoryMapping system seeds: the SQL below `INSERT`s ~60
-- system rows (userId IS NULL) covering common AU rental + employee
-- + small-business deductions. These are PURE INSERTS into a freshly
-- created table — no existing data is at risk. The mappings reference
-- `canonical_category_registry` rows via `categoryLevel1/level2`
-- triples; each user's registry rows are seeded lazily by Phase 42
-- PR1's `resolveOrCreateCategory()` so the system mappings only
-- become active for a user once they have matching categories.
-- Until then, the system rows simply exist as a template.
--
-- IMPORTANT: the system seeds use a synthetic placeholder category
-- id of `00000000-0000-0000-0000-system` — but this won't satisfy the
-- FK. Instead the system mappings are seeded in-app by
-- `lib/bookkeeping/taxCategoryMapping.ts:seedSystemMappings()` which
-- runs lazily on first user request. Keeping the SQL migration
-- table-only avoids the FK-bootstrap problem.

-- 1. Vendor ------------------------------------------------------------------
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalisedName" TEXT NOT NULL,
    "mcc" TEXT,
    "abn" TEXT,
    "defaultCategoryId" TEXT,
    "defaultIsTaxDeductible" BOOLEAN NOT NULL DEFAULT false,
    "suggestedFrequency" TEXT,
    "websiteUrl" TEXT,
    "cancelUrl" TEXT,
    "contractDocumentId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendors_userId_normalisedName_key"
    ON "vendors"("userId", "normalisedName");
CREATE INDEX "vendors_userId_idx" ON "vendors"("userId");
CREATE INDEX "vendors_userId_mcc_idx" ON "vendors"("userId", "mcc");

ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vendors"
    ADD CONSTRAINT "vendors_defaultCategoryId_fkey"
        FOREIGN KEY ("defaultCategoryId") REFERENCES "canonical_category_registry"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. TaxCategoryMapping ------------------------------------------------------
CREATE TABLE "tax_category_mapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "canonicalCategoryId" TEXT NOT NULL,
    "atoLabel" TEXT NOT NULL,
    "schedule" TEXT,
    "lineItem" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_category_mapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_category_mapping_userId_canonicalCategoryId_atoLabel_key"
    ON "tax_category_mapping"("userId", "canonicalCategoryId", "atoLabel");
CREATE INDEX "tax_category_mapping_userId_idx" ON "tax_category_mapping"("userId");
CREATE INDEX "tax_category_mapping_atoLabel_idx" ON "tax_category_mapping"("atoLabel");
CREATE INDEX "tax_category_mapping_canonicalCategoryId_idx"
    ON "tax_category_mapping"("canonicalCategoryId");

ALTER TABLE "tax_category_mapping"
    ADD CONSTRAINT "tax_category_mapping_canonicalCategoryId_fkey"
        FOREIGN KEY ("canonicalCategoryId") REFERENCES "canonical_category_registry"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tax_category_mapping"
    ADD CONSTRAINT "tax_category_mapping_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
