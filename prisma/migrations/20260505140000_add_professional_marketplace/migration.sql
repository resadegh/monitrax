-- Phase 32C PR4a — Professional Marketplace
--
-- Additive migration. Creates `professional_listings` + `professional_ratings`
-- tables and four supporting enums. No existing rows are touched. No data
-- backfill is required (every Org starts without a listing; listings are
-- opt-in). CLAUDE.md §12.11 destructive-write checklist NOT required (no
-- update/upsert/delete on existing rows). CLAUDE.md §12.12 schema-change
-- protocol satisfied: this file ships in the same PR as `prisma/schema.prisma`.

-- 1. Enums

-- Extend AuditAction with marketplace lifecycle events (additive — no
-- existing audit-log rows are touched).
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MARKETPLACE_LISTING_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MARKETPLACE_LISTING_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MARKETPLACE_LISTING_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MARKETPLACE_LISTING_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MARKETPLACE_LISTING_SUSPENDED';

CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

CREATE TYPE "ProfessionalSpecialisation" AS ENUM (
  'RETIREMENT_PLANNING',
  'WEALTH_BUILDING',
  'TAX_OPTIMISATION',
  'ESTATE_PLANNING',
  'RISK_INSURANCE',
  'HOME_LOANS',
  'INVESTMENT_LOANS',
  'REFINANCE',
  'COMMERCIAL_LENDING',
  'FIRST_HOME_BUYER',
  'PERSONAL_TAX',
  'SMALL_BUSINESS',
  'TRUST_ACCOUNTING',
  'SMSF_ACCOUNTING',
  'PROPERTY_INVESTORS'
);

CREATE TYPE "ListingTargetTier" AS ENUM ('EMERGING', 'GROWING', 'ESTABLISHED', 'HIGH_NET_WORTH');

CREATE TYPE "ListingRegion" AS ENUM (
  'NSW_SYDNEY_METRO',
  'NSW_REGIONAL',
  'VIC_MELBOURNE_METRO',
  'VIC_REGIONAL',
  'QLD_BRISBANE_METRO',
  'QLD_REGIONAL',
  'WA',
  'SA',
  'TAS',
  'ACT',
  'NT',
  'NATIONAL'
);

-- 2. ProfessionalListing table

CREATE TABLE "professional_listings" (
  "id"                          TEXT NOT NULL,
  "organizationId"              TEXT NOT NULL,
  "publicSlug"                  TEXT NOT NULL,
  "displayName"                 TEXT NOT NULL,
  "tagline"                     VARCHAR(140),
  "blurb"                       TEXT,
  "heroImageUrl"                TEXT,
  "discipline"                  "OrganizationType" NOT NULL,
  "specialisations"             "ProfessionalSpecialisation"[] DEFAULT ARRAY[]::"ProfessionalSpecialisation"[],
  "targetTiers"                 "ListingTargetTier"[]          DEFAULT ARRAY[]::"ListingTargetTier"[],
  "regions"                     "ListingRegion"[]              DEFAULT ARRAY[]::"ListingRegion"[],
  "afslNumber"                  TEXT,
  "creditRepNumber"             TEXT,
  "tpbNumber"                   TEXT,
  "abn"                         TEXT,
  "leadFeeTierEmerging"         DECIMAL(8, 2) NOT NULL DEFAULT 80,
  "leadFeeTierGrowing"          DECIMAL(8, 2) NOT NULL DEFAULT 150,
  "leadFeeTierEstablished"      DECIMAL(8, 2) NOT NULL DEFAULT 250,
  "status"                      "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt"                 TIMESTAMP(3),
  "reviewedAt"                  TIMESTAMP(3),
  "reviewedByAdminId"           TEXT,
  "rejectionReason"             TEXT,
  "verificationNotes"           TEXT,
  "asicCrossCheckedAt"          TIMESTAMP(3),
  "tpbCrossCheckedAt"           TIMESTAMP(3),
  "ratingsCount"                INTEGER NOT NULL DEFAULT 0,
  "averageRating"               DECIMAL(3, 2),
  "acceptedRequestsCount"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "professional_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "professional_listings_organizationId_key" ON "professional_listings"("organizationId");
CREATE UNIQUE INDEX "professional_listings_publicSlug_key" ON "professional_listings"("publicSlug");
CREATE INDEX "professional_listings_status_idx" ON "professional_listings"("status");
CREATE INDEX "professional_listings_discipline_status_idx" ON "professional_listings"("discipline", "status");
CREATE INDEX "professional_listings_publicSlug_idx" ON "professional_listings"("publicSlug");

ALTER TABLE "professional_listings"
  ADD CONSTRAINT "professional_listings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_listings"
  ADD CONSTRAINT "professional_listings_reviewedByAdminId_fkey"
  FOREIGN KEY ("reviewedByAdminId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. ProfessionalRating table

CREATE TABLE "professional_ratings" (
  "id"            TEXT NOT NULL,
  "listingId"     TEXT NOT NULL,
  "raterUserId"   TEXT NOT NULL,
  "stars"         INTEGER NOT NULL,
  "comment"       TEXT,
  "isPublic"      BOOLEAN NOT NULL DEFAULT true,
  "flaggedAt"     TIMESTAMP(3),
  "flaggedReason" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "professional_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "professional_ratings_listingId_raterUserId_key" ON "professional_ratings"("listingId", "raterUserId");
CREATE INDEX "professional_ratings_listingId_idx" ON "professional_ratings"("listingId");

ALTER TABLE "professional_ratings"
  ADD CONSTRAINT "professional_ratings_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "professional_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_ratings"
  ADD CONSTRAINT "professional_ratings_raterUserId_fkey"
  FOREIGN KEY ("raterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
