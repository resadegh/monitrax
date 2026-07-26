-- MON-101 (capture Stage 1): FTE/IEE beneficiary facts on DistributionAllocation.
-- Additive only — new enum + three nullable columns; no existing row is touched.
-- null = never-asked; the assembler's all-or-nothing gate means a null can never
-- fabricate an FTDT / TFN-withholding classification.
CREATE TYPE "FamilyGroupRelationship" AS ENUM ('TEST_INDIVIDUAL', 'FAMILY_MEMBER', 'CONTROLLED_ENTITY', 'OUTSIDE_FAMILY');

ALTER TABLE "distribution_allocations" ADD COLUMN "relationship" "FamilyGroupRelationship";
ALTER TABLE "distribution_allocations" ADD COLUMN "hasQuotedTfn" BOOLEAN;
ALTER TABLE "distribution_allocations" ADD COLUMN "coveredByIee" BOOLEAN;
