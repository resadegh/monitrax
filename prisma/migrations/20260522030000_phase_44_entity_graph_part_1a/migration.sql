-- Phase 44 — Entity Graph & Structure Modelling, Part 1a (schema).
-- Design contract: docs/blueprint/PHASE_44_ENTITY_GRAPH.md.
--
-- Purely additive: 8 new enums, 15 enum-value extensions, 22 new columns
-- on legal_entities, 5 new tables (+ their indexes + foreign keys), and a
-- data migration converting the legacy LegalEntity.parentEntityId
-- trustee->trust pointer into TRUSTEE_OF edges.
--
-- Per CLAUDE.md §12.11 destructive-write checklist:
--   * Operation: CREATE TYPE x8 + ALTER TYPE ADD VALUE x15 + ALTER TABLE
--     ADD COLUMN x22 + CREATE TABLE x5 + CREATE INDEX + ADD FOREIGN KEY
--     + one additive INSERT (the parentEntityId backfill).
--   * Columns overwritten: NONE. Rows updated/deleted: NONE — the data
--     migration only INSERTs new entity_relationships rows.
--   * Guard: structural — there is no UPDATE and no DELETE in this file.
--   -> §12.11 N/A by structural argument. User confirmation: NOT REQUIRED.
--
-- Per CLAUDE.md §12.12: schema.prisma + this migration ship in the same
-- PR. Hand-written (the build sandbox has no database to run
-- `prisma migrate dev` against) following Prisma's generated-SQL
-- conventions. The Vercel preview build runs `prisma migrate deploy`
-- against monitrax-db-dev and is the canonical verification; the
-- production deploy applies it to monitrax-db-prod.
--
-- New enum values are APPENDED (schema.prisma lists them last too) so the
-- DB enum order matches schema.prisma — no future migrate-dev drift.

-- ============================================================ CreateEnum
CREATE TYPE "EntityRelationshipType" AS ENUM ('TRUSTEE_OF', 'APPOINTOR_OF', 'GUARDIAN_OF', 'POWER_HOLDER_OF', 'SETTLOR_OF', 'BENEFICIARY_OF', 'EXECUTOR_OF', 'ADMINISTRATOR_OF', 'LEGAL_PERSONAL_REPRESENTATIVE_FOR', 'UNITHOLDER_OF', 'SHAREHOLDER_OF', 'DIRECTOR_OF', 'SECRETARY_OF', 'PUBLIC_OFFICER_OF', 'MEMBER_OF', 'PARTNER_OF', 'OPERATES_AS_SOLE_TRADER', 'FAMILY_MEMBER_OF', 'ASSOCIATE_OF');

CREATE TYPE "BeneficiaryClass" AS ENUM ('PRIMARY', 'GENERAL', 'DEFAULT', 'NAMED', 'RESIDUARY', 'SPECIFIC_GIFT', 'LIFE_TENANT', 'REMAINDERMAN');

CREATE TYPE "StructuralState" AS ENUM ('VALID', 'NON_COMPLIANT_BUT_RECORDED', 'IMPOSSIBLE_SYSTEM_ERROR');

CREATE TYPE "ShareClass" AS ENUM ('ORDINARY', 'PREFERENCE', 'REDEEMABLE_PREFERENCE', 'A_CLASS', 'B_CLASS', 'C_CLASS', 'OTHER');

CREATE TYPE "EquityKind" AS ENUM ('SHARE', 'UNIT');

CREATE TYPE "TenancyType" AS ENUM ('SOLE', 'JOINT_TENANTS', 'TENANTS_IN_COMMON', 'OTHER');

CREATE TYPE "BeneficialOwnershipBasis" AS ENUM ('BARE_TRUST', 'NOMINEE', 'CUSTODIAN', 'RESULTING_TRUST', 'OTHER');

CREATE TYPE "CompanySubtype" AS ENUM ('PROPRIETARY', 'PUBLIC', 'LIMITED_BY_GUARANTEE', 'UNLIMITED', 'NO_LIABILITY');

-- ============================================================= AlterEnum
ALTER TYPE "LegalEntityType" ADD VALUE 'INDIVIDUAL';
ALTER TYPE "LegalEntityType" ADD VALUE 'FIXED_TRUST';
ALTER TYPE "LegalEntityType" ADD VALUE 'HYBRID_TRUST';
ALTER TYPE "LegalEntityType" ADD VALUE 'BARE_TRUST';
ALTER TYPE "LegalEntityType" ADD VALUE 'TESTAMENTARY_TRUST';
ALTER TYPE "LegalEntityType" ADD VALUE 'DECEASED_ESTATE';
ALTER TYPE "LegalEntityType" ADD VALUE 'FOREIGN_COMPANY';
ALTER TYPE "LegalEntityType" ADD VALUE 'INCORPORATED_ASSOCIATION';
ALTER TYPE "LegalEntityType" ADD VALUE 'CO_OPERATIVE';
ALTER TYPE "LegalEntityType" ADD VALUE 'STRATA_BODY_CORPORATE';
ALTER TYPE "LegalEntityType" ADD VALUE 'CUSTODIAN_PLATFORM';
ALTER TYPE "LegalEntityType" ADD VALUE 'OTHER';

ALTER TYPE "LegalEntityRole" ADD VALUE 'CORPORATE_TRUSTEE';

ALTER TYPE "TrustType" ADD VALUE 'HYBRID';
ALTER TYPE "TrustType" ADD VALUE 'TESTAMENTARY';

-- ============================================================ AlterTable
ALTER TABLE "legal_entities"
  ADD COLUMN "companySubtype" "CompanySubtype",
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "directorIdEncrypted" TEXT,
  ADD COLUMN "householdMemberId" TEXT,
  ADD COLUMN "canHoldLegalTitle" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "taxReportingEntity" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requiresTrusteeOrNomineeForLegalTitle" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taxResidencyStatus" TEXT,
  ADD COLUMN "centralManagementControlCountry" TEXT,
  ADD COLUMN "placeOfIncorporation" TEXT,
  ADD COLUMN "governingJurisdiction" TEXT,
  ADD COLUMN "registrationJurisdiction" TEXT,
  ADD COLUMN "vestingDate" TIMESTAMP(3),
  ADD COLUMN "perpetuityPeriod" TEXT,
  ADD COLUMN "deedDate" TIMESTAMP(3),
  ADD COLUMN "lastVariationDate" TIMESTAMP(3),
  ADD COLUMN "trustProperLawJurisdiction" TEXT,
  ADD COLUMN "estateAdministrationStatus" TEXT,
  ADD COLUMN "regulatoryStatus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "unsupportedStructure" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "structuralState" "StructuralState" NOT NULL DEFAULT 'VALID',
  ADD COLUMN "accountantVerified" BOOLEAN NOT NULL DEFAULT false;

-- =========================================================== CreateTable
CREATE TABLE "entity_relationships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "type" "EntityRelationshipType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "beneficiaryClass" "BeneficiaryClass",
    "partnerInterestPct" DECIMAL(9,6),
    "partnerCapitalAmount" DECIMAL(19,4),
    "familyRelation" TEXT,
    "lprReason" TEXT,
    "appointorPower" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "powerType" TEXT,
    "powerSubject" TEXT,
    "tfnQuoted" BOOLEAN,
    "sourceDocumentId" TEXT,
    "notes" TEXT,
    "structuralState" "StructuralState" NOT NULL DEFAULT 'VALID',
    "accountantVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "entity_relationships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "share_parcels" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "kind" "EquityKind" NOT NULL,
    "shareClass" "ShareClass" NOT NULL DEFAULT 'ORDINARY',
    "quantity" DECIMAL(24,8) NOT NULL,
    "paidPerUnit" DECIMAL(19,6) NOT NULL,
    "unpaidPerUnit" DECIMAL(19,6) NOT NULL DEFAULT 0,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "disposedAt" TIMESTAMP(3),
    CONSTRAINT "share_parcels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ownership_groups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ownedObjectType" TEXT NOT NULL,
    "ownedObjectId" TEXT NOT NULL,
    "tenancyType" "TenancyType" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ownership_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ownership_stakes" (
    "id" TEXT NOT NULL,
    "ownershipGroupId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sharePct" DECIMAL(9,6),
    "survivorshipApplies" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "ownership_stakes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "beneficial_ownership_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalOwnerEntityId" TEXT NOT NULL,
    "beneficialOwnerEntityId" TEXT NOT NULL,
    "ownedObjectType" TEXT NOT NULL,
    "ownedObjectId" TEXT NOT NULL,
    "basis" "BeneficialOwnershipBasis" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "sourceDocumentId" TEXT,
    "accountantVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "beneficial_ownership_overrides_pkey" PRIMARY KEY ("id")
);

-- =========================================================== CreateIndex
CREATE INDEX "entity_relationships_userId_idx" ON "entity_relationships"("userId");
CREATE INDEX "entity_relationships_fromEntityId_idx" ON "entity_relationships"("fromEntityId");
CREATE INDEX "entity_relationships_toEntityId_idx" ON "entity_relationships"("toEntityId");
CREATE INDEX "entity_relationships_type_idx" ON "entity_relationships"("type");

CREATE INDEX "share_parcels_relationshipId_idx" ON "share_parcels"("relationshipId");

CREATE INDEX "ownership_groups_userId_idx" ON "ownership_groups"("userId");
CREATE INDEX "ownership_groups_ownedObjectType_ownedObjectId_idx" ON "ownership_groups"("ownedObjectType", "ownedObjectId");

CREATE INDEX "ownership_stakes_ownershipGroupId_idx" ON "ownership_stakes"("ownershipGroupId");
CREATE INDEX "ownership_stakes_entityId_idx" ON "ownership_stakes"("entityId");

CREATE INDEX "beneficial_ownership_overrides_userId_idx" ON "beneficial_ownership_overrides"("userId");
CREATE INDEX "beneficial_ownership_overrides_ownedObjectType_ownedObjectId_idx" ON "beneficial_ownership_overrides"("ownedObjectType", "ownedObjectId");

-- ========================================================== AddForeignKey
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "share_parcels" ADD CONSTRAINT "share_parcels_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "entity_relationships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ownership_groups" ADD CONSTRAINT "ownership_groups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ownership_stakes" ADD CONSTRAINT "ownership_stakes_ownershipGroupId_fkey" FOREIGN KEY ("ownershipGroupId") REFERENCES "ownership_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ownership_stakes" ADD CONSTRAINT "ownership_stakes_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "legal_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "beneficial_ownership_overrides" ADD CONSTRAINT "beneficial_ownership_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===================================================== DataMigration
-- Convert the legacy LegalEntity.parentEntityId trustee->trust pointer
-- into first-class TRUSTEE_OF edges. parentEntityId stays in the table
-- (frozen read-only — PHASE_44 §10); this only ADDS edges.
-- `from` = the trustee (the parent entity); `to` = the trust (the child).
INSERT INTO "entity_relationships" (
  "id", "userId", "fromEntityId", "toEntityId", "type",
  "effectiveFrom", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  child."userId",
  child."parentEntityId",
  child."id",
  'TRUSTEE_OF'::"EntityRelationshipType",
  child."createdAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "legal_entities" child
WHERE child."parentEntityId" IS NOT NULL;
