-- Phase 38 PR 3: Share Pass — generic share-link engine for My Vault
-- "Send to accountant" + future content types (Reports / property summaries /
-- net-worth snapshots) and future delivery methods (Xero/MYOB push).
--
-- Schema design rationale: see prisma/schema.prisma SharePackage block + the
-- documentation in docs/IMPLEMENTATION_PLAN.md Phase 38 PR 3.

-- CreateEnum
CREATE TYPE "SharePackagePurpose" AS ENUM (
  'TAX_RETURN',
  'LOAN_APPLICATION',
  'INSURANCE_CLAIM',
  'ADVISER_REVIEW',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "SharePackageContentType" AS ENUM (
  'DOCUMENT_BUNDLE'
);

-- CreateEnum
CREATE TYPE "SharePackageDeliveryMethod" AS ENUM (
  'LINK',
  'EMAIL_LINK',
  'DOWNLOAD_ONLY'
);

-- CreateTable
CREATE TABLE "SharePackage" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "token"           TEXT NOT NULL,
    "recipientName"   TEXT,
    "recipientEmail"  TEXT,
    "purpose"         "SharePackagePurpose" NOT NULL,
    "contentType"     "SharePackageContentType" NOT NULL,
    "contentRefs"     JSONB NOT NULL,
    "contentLabel"    TEXT,
    "deliveryMethod"  "SharePackageDeliveryMethod" NOT NULL DEFAULT 'LINK',
    "expiresAt"       TIMESTAMP(3) NOT NULL,
    "revokedAt"       TIMESTAMP(3),
    "revokeReason"    TEXT,
    "viewCount"       INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt"    TIMESTAMP(3),
    "watermarkText"   TEXT,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharePackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharePackage_token_key" ON "SharePackage"("token");

-- CreateIndex
CREATE INDEX "SharePackage_userId_idx" ON "SharePackage"("userId");

-- CreateIndex
CREATE INDEX "SharePackage_token_idx" ON "SharePackage"("token");

-- CreateIndex
CREATE INDEX "SharePackage_expiresAt_revokedAt_idx" ON "SharePackage"("expiresAt", "revokedAt");

-- AddForeignKey
ALTER TABLE "SharePackage" ADD CONSTRAINT "SharePackage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
