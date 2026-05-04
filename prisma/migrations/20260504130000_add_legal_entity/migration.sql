-- Phase 41a — Entity Layer foundation
--
-- Introduces the `LegalEntity` model + back-references on every
-- ownership-bearing table (Property, Loan, Account, InvestmentAccount,
-- Asset, Income, Expense). Up Next #25.
--
-- Migration shape:
--   1. Create `LegalEntityType` + `LegalEntityRole` enums (additive).
--   2. Create `legal_entities` table + its self-FK + user-FK.
--   3. Add `ownerEntityId` column NULLABLE on each owned table (additive).
--   4. Backfill: one PERSONAL_NAME `LegalEntity` per existing user
--      (named after the user's display name), then UPDATE every owned
--      row to point at its user's PERSONAL_NAME entity.
--   5. Lock down: ALTER each `ownerEntityId` to NOT NULL + add the FK
--      with ON DELETE RESTRICT (we never want to silently lose
--      ownership on entity removal — a user has to migrate the rows
--      first).
--
-- CLAUDE.md §12.11 destructive-write checklist: the backfill includes
-- an `UPDATE ... SET ownerEntityId = ...` against every existing row in
-- seven tables. The clause is guarded so it ONLY mutates rows whose
-- `ownerEntityId IS NULL` (i.e. rows that have never been touched by
-- any other code path), and it sets a single field that did not exist
-- before this migration ran. There is no risk of clobbering user-entered
-- data — the column is brand new. See the PR description for the full
-- §12.11 answer.
--
-- CLAUDE.md §12.12: this migration ships in the same PR as the matching
-- `prisma/schema.prisma` change. `prisma migrate deploy` runs it on
-- preview and production builds before the function bundle is served.
--
-- CLAUDE.md §13: `tfnEncrypted` is OPTIONAL (nullable, default-off). The
-- field is encrypted at rest via `lib/security/tfnEncryption.ts` (mirrors
-- the `MFAMethod.secret` Phase 10 pattern). TFN is never logged, never
-- sent to AI, never returned in default API responses.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------

CREATE TYPE "LegalEntityType" AS ENUM (
    'PERSONAL_NAME',
    'COMPANY',
    'DISCRETIONARY_TRUST',
    'UNIT_TRUST',
    'SMSF',
    'PARTNERSHIP',
    'SOLE_TRADER'
);

CREATE TYPE "LegalEntityRole" AS ENUM (
    'HOLDING',
    'OPERATING',
    'INVESTMENT',
    'SUPERANNUATION',
    'PERSONAL'
);

-- ---------------------------------------------------------------------------
-- 2. legal_entities table
-- ---------------------------------------------------------------------------

CREATE TABLE "legal_entities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LegalEntityType" NOT NULL,
    "role" "LegalEntityRole" NOT NULL,
    "abn" TEXT,
    "acn" TEXT,
    "tfnEncrypted" TEXT,
    "tradingName" TEXT,
    "establishedDate" TIMESTAMP(3),
    "parentEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_entities_userId_idx" ON "legal_entities"("userId");
CREATE INDEX "legal_entities_type_idx" ON "legal_entities"("type");
CREATE INDEX "legal_entities_parentEntityId_idx" ON "legal_entities"("parentEntityId");

ALTER TABLE "legal_entities"
    ADD CONSTRAINT "legal_entities_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "legal_entities"
    ADD CONSTRAINT "legal_entities_parentEntityId_fkey"
    FOREIGN KEY ("parentEntityId") REFERENCES "legal_entities"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Add ownerEntityId column (NULLABLE for the backfill window)
-- ---------------------------------------------------------------------------

ALTER TABLE "properties"          ADD COLUMN "ownerEntityId" TEXT;
ALTER TABLE "loans"               ADD COLUMN "ownerEntityId" TEXT;
ALTER TABLE "accounts"            ADD COLUMN "ownerEntityId" TEXT;
ALTER TABLE "investment_accounts" ADD COLUMN "ownerEntityId" TEXT;
ALTER TABLE "assets"              ADD COLUMN "ownerEntityId" TEXT;
ALTER TABLE "income"              ADD COLUMN "ownerEntityId" TEXT;
ALTER TABLE "expenses"            ADD COLUMN "ownerEntityId" TEXT;

-- ---------------------------------------------------------------------------
-- 4. Backfill
-- ---------------------------------------------------------------------------
--
-- Insert one PERSONAL_NAME LegalEntity per existing user. The entity is
-- named after the user's display name (`users.name`). The user's natural
-- ownership is the default and will keep its identity even after a user
-- adds a Trust / Pty Ltd / SMSF in the Phase 41b wizard.
--
-- `gen_random_uuid()` is built into Postgres ≥ 13 (no extension required).
-- Cloud SQL Postgres on Monitrax is on a supported version (see
-- `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md`).

INSERT INTO "legal_entities"
    ("id", "userId", "name", "type", "role", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    u."id",
    u."name",
    'PERSONAL_NAME'::"LegalEntityType",
    'PERSONAL'::"LegalEntityRole",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users" u;

-- Reassign every owned row to its user's PERSONAL_NAME entity. The
-- `ownerEntityId IS NULL` guard ensures this only touches rows the
-- migration just added the column to (i.e. every existing row), and never
-- clobbers a row whose entity has already been set.

UPDATE "properties" p SET "ownerEntityId" = le."id"
FROM "legal_entities" le
WHERE le."userId" = p."userId"
  AND le."type" = 'PERSONAL_NAME'
  AND p."ownerEntityId" IS NULL;

UPDATE "loans" l SET "ownerEntityId" = le."id"
FROM "legal_entities" le
WHERE le."userId" = l."userId"
  AND le."type" = 'PERSONAL_NAME'
  AND l."ownerEntityId" IS NULL;

UPDATE "accounts" a SET "ownerEntityId" = le."id"
FROM "legal_entities" le
WHERE le."userId" = a."userId"
  AND le."type" = 'PERSONAL_NAME'
  AND a."ownerEntityId" IS NULL;

UPDATE "investment_accounts" ia SET "ownerEntityId" = le."id"
FROM "legal_entities" le
WHERE le."userId" = ia."userId"
  AND le."type" = 'PERSONAL_NAME'
  AND ia."ownerEntityId" IS NULL;

UPDATE "assets" ast SET "ownerEntityId" = le."id"
FROM "legal_entities" le
WHERE le."userId" = ast."userId"
  AND le."type" = 'PERSONAL_NAME'
  AND ast."ownerEntityId" IS NULL;

UPDATE "income" i SET "ownerEntityId" = le."id"
FROM "legal_entities" le
WHERE le."userId" = i."userId"
  AND le."type" = 'PERSONAL_NAME'
  AND i."ownerEntityId" IS NULL;

UPDATE "expenses" e SET "ownerEntityId" = le."id"
FROM "legal_entities" le
WHERE le."userId" = e."userId"
  AND le."type" = 'PERSONAL_NAME'
  AND e."ownerEntityId" IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Lock down: NOT NULL + indexes + foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE "properties"          ALTER COLUMN "ownerEntityId" SET NOT NULL;
ALTER TABLE "loans"               ALTER COLUMN "ownerEntityId" SET NOT NULL;
ALTER TABLE "accounts"            ALTER COLUMN "ownerEntityId" SET NOT NULL;
ALTER TABLE "investment_accounts" ALTER COLUMN "ownerEntityId" SET NOT NULL;
ALTER TABLE "assets"              ALTER COLUMN "ownerEntityId" SET NOT NULL;
ALTER TABLE "income"              ALTER COLUMN "ownerEntityId" SET NOT NULL;
ALTER TABLE "expenses"            ALTER COLUMN "ownerEntityId" SET NOT NULL;

CREATE INDEX "properties_ownerEntityId_idx"          ON "properties"("ownerEntityId");
CREATE INDEX "loans_ownerEntityId_idx"               ON "loans"("ownerEntityId");
CREATE INDEX "accounts_ownerEntityId_idx"            ON "accounts"("ownerEntityId");
CREATE INDEX "investment_accounts_ownerEntityId_idx" ON "investment_accounts"("ownerEntityId");
CREATE INDEX "assets_ownerEntityId_idx"              ON "assets"("ownerEntityId");
CREATE INDEX "income_ownerEntityId_idx"              ON "income"("ownerEntityId");
CREATE INDEX "expenses_ownerEntityId_idx"            ON "expenses"("ownerEntityId");

-- ON DELETE RESTRICT on every owned-table FK: deleting a LegalEntity is
-- never silent — the user has to migrate every owned row off it first.
-- This protects against accidental "delete the trust, lose the property"
-- failure modes.

ALTER TABLE "properties"
    ADD CONSTRAINT "properties_ownerEntityId_fkey"
    FOREIGN KEY ("ownerEntityId") REFERENCES "legal_entities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "loans"
    ADD CONSTRAINT "loans_ownerEntityId_fkey"
    FOREIGN KEY ("ownerEntityId") REFERENCES "legal_entities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_ownerEntityId_fkey"
    FOREIGN KEY ("ownerEntityId") REFERENCES "legal_entities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "investment_accounts"
    ADD CONSTRAINT "investment_accounts_ownerEntityId_fkey"
    FOREIGN KEY ("ownerEntityId") REFERENCES "legal_entities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assets"
    ADD CONSTRAINT "assets_ownerEntityId_fkey"
    FOREIGN KEY ("ownerEntityId") REFERENCES "legal_entities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "income"
    ADD CONSTRAINT "income_ownerEntityId_fkey"
    FOREIGN KEY ("ownerEntityId") REFERENCES "legal_entities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses"
    ADD CONSTRAINT "expenses_ownerEntityId_fkey"
    FOREIGN KEY ("ownerEntityId") REFERENCES "legal_entities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
