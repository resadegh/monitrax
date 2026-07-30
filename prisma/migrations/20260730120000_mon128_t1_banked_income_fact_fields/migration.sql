-- MON-131 Tranche 1 (MON-128) — banked-income FACT fields.
-- Table names are the @@map'ped names ("income", "properties") — NOT the
-- Prisma model names (the MON-135 migration lesson: the table name is part
-- of the input contract; verify the @@map).
-- All columns nullable, no backfill: null = UNDETERMINED by design (no
-- default that asserts a tax position — build brief §5).

-- Income.actualNetPay: payslip/bank-credit actual net pay, per the ROW'S OWN
-- frequency period (D33 — deliberately not already-annual).
ALTER TABLE "income" ADD COLUMN "actualNetPay" DOUBLE PRECISION;

-- Income.helpLoanDeclared: study loan (HELP/STSL) declared to the employer.
-- null = undetermined; absence is not evidence of absence.
ALTER TABLE "income" ADD COLUMN "helpLoanDeclared" BOOLEAN;

-- Property availability FACTs (X7 / D43) — intake-only this tranche.
ALTER TABLE "properties" ADD COLUMN "genuinelyAvailableForRent" BOOLEAN;
ALTER TABLE "properties" ADD COLUMN "availableDaysPerYear" INTEGER;
