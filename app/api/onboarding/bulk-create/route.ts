import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
// Prisma's Json? columns disallow raw `null` — use Prisma.JsonNull
// (sentinel meaning "write SQL NULL") to clear a JSONB field.
// See: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields#using-null-values
import { Prisma } from '@prisma/client';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
// Phase 41b: TFN at-rest encryption for wizard-defined entities (CLAUDE.md §13).
import { encryptTfn } from '@/lib/security/tfnEncryption';

// Prisma transaction client type
type TransactionClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// =============================================================================
// TYPES (matching wizard types - which match Prisma schema)
// =============================================================================

// Prisma enums
type PropertyType = 'HOME' | 'INVESTMENT';
type RateType = 'VARIABLE' | 'FIXED';
type RepaymentFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
type AccountType = 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD';
type InvestmentAccountType = 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';
type HoldingType = 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO';
type AssetType = 'VEHICLE' | 'ELECTRONICS' | 'FURNITURE' | 'EQUIPMENT' | 'COLLECTIBLE' | 'OTHER';
type IncomeType = 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';
type SalaryType = 'GROSS' | 'NET';
type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
type ExpenseCategory =
  | 'HOUSING'
  | 'RENT'
  | 'RATES'
  | 'INSURANCE'
  | 'MAINTENANCE'
  | 'PERSONAL'
  | 'UTILITIES'
  | 'FOOD'
  | 'GROCERIES'
  | 'TRANSPORT'
  | 'ENTERTAINMENT'
  | 'SUBSCRIPTION'
  | 'STRATA'
  | 'LAND_TAX'
  | 'LOAN_INTEREST'
  | 'REGISTRATION'
  | 'MODIFICATIONS'
  | 'HEALTH'
  | 'EDUCATION'
  | 'OTHER';

interface PropertyLoanInput {
  id: string;
  name: string;
  lender: string;
  principal: number;
  interestRateAnnual: number;
  rateType: RateType;
  isInterestOnly: boolean;
  termMonthsRemaining: number;
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
}

interface PropertyIncomeInput {
  id: string;
  type: 'RENTAL';
  amount: number;
  frequency: Frequency;
  tenantName?: string;
}

interface PropertyExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

interface PropertyInput {
  id: string;
  name: string;
  address: string;
  type: PropertyType;
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  hasLoan: boolean;
  loan?: PropertyLoanInput;
  income?: PropertyIncomeInput;
  expenses: PropertyExpenseInput[];
}

// Phase 12 PR 3b: data source tier for an account entered in the wizard.
//   MANUAL — user typed the balance; bulk-create writes a new Account row
//   BASIQ  — account was imported via Basiq consent flow; row already
//            exists in the DB, bulk-create skips it
//   IMPORT — account was created by the Phase 18 file-import flow; row
//            already exists in the DB, bulk-create skips it
type AccountDataSource = 'BASIQ' | 'IMPORT' | 'MANUAL';

interface AccountInput {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  currentBalance: number;
  interestRate?: number;
  linkedLoanId?: string;
  // PR 3b: data source tier + pointer to pre-existing DB row
  source?: AccountDataSource;
  existingAccountId?: string;
}

interface HoldingInput {
  id: string;
  ticker: string;
  name?: string;
  units: number;
  averagePrice: number;
  type: HoldingType;
}

interface InvestmentAccountInput {
  id: string;
  name: string;
  platform?: string;
  type: InvestmentAccountType;
  cashBalance: number;
  holdings: HoldingInput[];
}

interface AssetExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
}

interface AssetInput {
  id: string;
  name: string;
  type: AssetType;
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  description?: string;
  expenses: AssetExpenseInput[];
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
}

interface IncomeInput {
  id: string;
  name: string;
  type: IncomeType;
  amount: number;
  frequency: Frequency;
  salaryType?: SalaryType;
}

interface ExpenseInput {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  frequency: Frequency;
  isEssential?: boolean;
  isTaxDeductible?: boolean;
}

// Phase 29: Household
type HouseholdRelationship = 'SELF' | 'SPOUSE' | 'PARTNER' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
type HouseholdPetTypeEnum = 'DOG' | 'CAT' | 'BIRD' | 'FISH' | 'RABBIT' | 'REPTILE' | 'OTHER';

interface HouseholdMemberInput {
  id: string;
  name: string;
  relationship: HouseholdRelationship;
  dateOfBirth?: string;
  isIncomeEarner: boolean;
}

interface HouseholdPetInput {
  id: string;
  name: string;
  type: HouseholdPetTypeEnum;
  breed?: string;
}

// Phase 12 PR 3b: Housing situation drives renter path + Properties visibility
type HousingSituation = 'OWN' | 'RENT' | 'BOTH';

// Phase 12 PR 3b: Lifestyle fields for Phase 28 budget AI
type LifestylePreference = 'FRUGAL' | 'MODERATE' | 'COMFORTABLE';
type DiningFrequency = 'NEVER' | 'RARELY' | 'SOMETIMES' | 'OFTEN';

// Phase 12 PR 3b: Non-property loans (CAR/STUDENT/PERSONAL/BUSINESS)
type DebtLoanType = 'CAR' | 'STUDENT' | 'PERSONAL' | 'BUSINESS';

interface DebtInput {
  id: string;
  name: string;
  type: DebtLoanType;
  lender?: string;
  principal: number;
  interestRateAnnual: number; // percentage — converted to decimal below
  minRepayment: number;
  repaymentFrequency: RepaymentFrequency;
  termMonthsRemaining?: number;
  linkedAssetId?: string;
  isHecsHelp?: boolean;
}

// Phase 12 PR 3b: SuperannuationAccount minimum-viable fields
interface SuperAccountInput {
  id: string;
  name: string;
  fundName: string;
  currentBalance: number;
}

// Phase 41b: optional entity rows captured by the EntitiesStep wizard.
// Mirrors the EntityInput shape from
// `components/onboarding/wizard/types.ts` but kept locally typed so this
// route doesn't add a client→server coupling.
type LegalEntityType =
  | 'PERSONAL_NAME'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST'
  | 'SMSF'
  | 'PARTNERSHIP'
  | 'SOLE_TRADER';
type LegalEntityRole =
  | 'PERSONAL'
  | 'HOLDING'
  | 'OPERATING'
  | 'INVESTMENT'
  | 'SUPERANNUATION';
interface EntityInput {
  id: string;                        // wizard-local temp id
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  abn?: string;
  acn?: string;
  tfn?: string;                      // raw; encrypted by encryptTfn() before persistence
  tradingName?: string;
  establishedDate?: string;
  parentEntityTempId?: string;       // wizard-local pointer to another EntityInput.id
}

interface WizardData {
  profileType: string | null;
  country: string;
  taxYear: string;
  // PR 3b: Welcome answers driving renter path + step filtering
  housing?: HousingSituation | null;
  debtCategories?: string[];
  // Phase 29: Household
  householdMembers?: HouseholdMemberInput[];
  householdPets?: HouseholdPetInput[];
  carsCount?: number;
  // PR 3b: Household lifestyle fields (Phase 28 budget AI)
  lifestylePreference?: LifestylePreference | null;
  diningOutFrequency?: DiningFrequency | null;
  hobbiesWithCosts?: string;
  // Phase 41b: optional entity layer rows
  entities?: EntityInput[];
  properties: PropertyInput[];
  // PR 3b: Non-property loans
  debts?: DebtInput[];
  accounts: AccountInput[];
  investments: InvestmentAccountInput[];
  // PR 3b: Superannuation accounts
  superAccounts?: SuperAccountInput[];
  assets: AssetInput[];
  income: IncomeInput[];
  expenses: ExpenseInput[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Fix: frequency double-conversion bug (docs/changelog/CHANGELOG_2026_04_12_ONBOARDING_CORRECTNESS.md).
// The canonical Income/Expense contract (per lib/utils/frequencies.ts and /api/income)
// stores `amount` at the given `frequency` — downstream engines call toAnnual/toMonthly.
// This file previously called normalizeToMonthly() AND stored the original frequency,
// which caused every amount to be read by the snapshot engine at the wrong scale
// (e.g. $1000/week became $225K/year instead of $52K/year). We now pass the
// amount and frequency through unchanged.

// Map PropertyType to LoanType
function getLoanType(propertyType: PropertyType): 'HOME' | 'INVESTMENT' {
  return propertyType === 'HOME' ? 'HOME' : 'INVESTMENT';
}

// =============================================================================
// POST - Bulk create all onboarding data
// =============================================================================

export const POST = withPermission('onboarding.complete', async (request, auth) => {
    // Hoisted out of the try block so the catch handler can include
    // them in the structured error log without scope errors.
    const userId = auth.userId;
    let parsedPayload: WizardData | undefined;
    try {
      parsedPayload = (await request.json()) as WizardData;
      const data = parsedPayload;

      // ID mapping for linking (temp ID -> real ID)
      const loanIdMap = new Map<string, string>();

      // Start a transaction to create all data atomically.
      //
      // Prisma's default interactive-transaction timeout is 5 seconds —
      // far too short for the full bulk-create payload, which can issue
      // ~50–80 sequential writes on a healthy account (3 properties ×
      // [property + loan + rent + expenses], 1+ accounts, 9+ general
      // expenses, household profile + members + pets, super accounts,
      // debts, assets, etc.). On a slow Cloud SQL connection or first
      // cold-start of the build the cumulative latency easily exceeds
      // 5s, the transaction aborts, the 500 propagates to the client,
      // and the wizard's "Launching..." button reverts with no
      // user-visible feedback (see handleSubmit's silent catch in
      // components/onboarding/wizard/WizardContainer.tsx — also fixed
      // in this PR).
      //
      // 30s is a generous ceiling (well below the Vercel function
      // timeout) and matches what equivalent bulk-write endpoints in
      // this codebase use for similar payload sizes. `maxWait` is
      // bumped to 10s so we don't reject the transaction at the slot-
      // acquisition stage during traffic spikes.
      const result = await prisma.$transaction(
        async (tx: TransactionClient) => {
        // Phase 41a: resolve the user's PERSONAL_NAME LegalEntity inside the
        // transaction (creates one on demand for brand-new registrations).
        // Used as the FALLBACK ownerEntityId for every owned row that
        // wasn't explicitly attached to a user-defined entity in Phase
        // 41b's wizard step.
        const ownerEntityId = await getDefaultLegalEntityId(userId, tx);

        // =======================================================================
        // Phase 41b — persist wizard-defined LegalEntity rows
        //
        // The EntitiesStep collects optional Trust / SMSF / Pty Ltd /
        // Partnership / Sole Trader entries with wizard-local temp ids.
        // Two-pass write so trustee→trust parent FKs can resolve to real
        // DB ids:
        //   1. Insert all entities WITHOUT parentEntityId.
        //   2. UPDATE each entity that had a parentEntityTempId, mapping
        //      the temp id to the real entity id created in pass 1.
        // The temp→real mapping is kept in `wizardEntityMap` for future
        // wizard steps (Phase 41c+) that may want to attach properties
        // to a non-default entity.
        // =======================================================================
        const wizardEntityMap = new Map<string, string>();
        if (data.entities && data.entities.length > 0) {
          // Pass 1 — create entities, no parent linkage yet
          for (const entity of data.entities) {
            if (!entity.name?.trim()) continue;   // skip malformed wizard rows
            const created = await tx.legalEntity.create({
              data: {
                userId,
                name: entity.name.trim(),
                type: entity.type,
                role: entity.role,
                abn: entity.abn?.replace(/\D+/g, '') || null,
                acn: entity.acn?.replace(/\D+/g, '') || null,
                tfnEncrypted: encryptTfn(entity.tfn ?? null),
                tradingName: entity.tradingName?.trim() || null,
                establishedDate: entity.establishedDate
                  ? new Date(entity.establishedDate)
                  : null,
                // Phase 41E.5 — reform-aware inputs from the wizard.
                // Only persist trustType when the entity is a trust type
                // (mirrors the entity edit form's payload logic).
                trustType:
                  entity.trustType &&
                  (entity.type === 'DISCRETIONARY_TRUST' || entity.type === 'UNIT_TRUST')
                    ? entity.trustType
                    : null,
                isForeignResident: entity.isForeignResident ?? false,
                // parentEntityId set in pass 2 below
              },
              select: { id: true },
            });
            wizardEntityMap.set(entity.id, created.id);
          }

          // Pass 2 — wire up trustee → trust parent FKs
          for (const entity of data.entities) {
            if (!entity.parentEntityTempId) continue;
            const realId = wizardEntityMap.get(entity.id);
            const realParentId = wizardEntityMap.get(entity.parentEntityTempId);
            if (!realId || !realParentId) continue;
            await tx.legalEntity.update({
              where: { id: realId },
              data: { parentEntityId: realParentId },
            });
          }
        }

        // =======================================================================
        // 1. Update user onboarding status
        // =======================================================================
        await tx.user.update({
          where: { id: userId },
          data: {
            onboardingCompleted: true,
            onboardingCompletedAt: new Date(),
            onboardingProfileType: data.profileType as 'HOMEOWNER' | 'INVESTOR' | 'MIXED' | 'STARTER' | null,
          },
        });

        // =======================================================================
        // 1a. Phase 29 — Household profile, members, pets
        //                + Phase 12 PR 3b lifestyle fields
        //
        // The wizard collects members/pets/carsCount + (PR 3b) lifestyle
        // preferences for the Phase 28 budget AI. We upsert a
        // HouseholdProfile and its children here. Lifestyle fields come
        // from Welcome step + Household step's "Your lifestyle" section.
        // Falls back to schema defaults (MODERATE / SOMETIMES) only when
        // the user hasn't picked one.
        // =======================================================================
        const householdMembers = data.householdMembers ?? [];
        const householdPets = data.householdPets ?? [];
        const carsCount = data.carsCount ?? 0;
        // PR 3b lifestyle inputs (may be null/undefined if user skipped)
        const lifestylePreference = data.lifestylePreference ?? undefined;
        const diningOutFrequency = data.diningOutFrequency ?? undefined;
        const hobbiesWithCosts = data.hobbiesWithCosts?.trim() || undefined;
        const hasLifestyleData =
          !!lifestylePreference || !!diningOutFrequency || !!hobbiesWithCosts;

        if (
          householdMembers.length > 0 ||
          householdPets.length > 0 ||
          carsCount > 0 ||
          hasLifestyleData
        ) {
          const childrenAges: number[] = [];
          let adultsCount = 0;
          let childrenCount = 0;
          for (const m of householdMembers) {
            if (m.relationship === 'CHILD') {
              childrenCount += 1;
              if (m.dateOfBirth) {
                const dob = new Date(m.dateOfBirth);
                if (!Number.isNaN(dob.getTime())) {
                  const ageMs = Date.now() - dob.getTime();
                  const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
                  if (ageYears >= 0) childrenAges.push(ageYears);
                }
              }
            } else {
              adultsCount += 1;
            }
          }
          // Ensure at least one adult — the user themselves — to satisfy the
          // "adultsCount default 1" schema contract even when no SELF member
          // was explicitly added.
          if (adultsCount === 0) adultsCount = 1;

          const petTypes = Array.from(new Set(householdPets.map((p) => p.type.toLowerCase())));

          const householdProfile = await tx.householdProfile.upsert({
            where: { userId },
            create: {
              userId,
              adultsCount,
              childrenCount,
              childrenAges,
              petsCount: householdPets.length,
              petTypes,
              carsCount,
              isComplete: true,
              // PR 3b: lifestyle fields for Phase 28 budget AI
              ...(lifestylePreference && { lifestylePreference }),
              ...(diningOutFrequency && { diningOutFrequency }),
              ...(hobbiesWithCosts && { hobbiesWithCosts }),
            },
            update: {
              adultsCount,
              childrenCount,
              childrenAges,
              petsCount: householdPets.length,
              petTypes,
              carsCount,
              isComplete: true,
              // PR 3b: lifestyle fields — only overwrite if the wizard
              // actually captured them (so we don't clobber existing
              // Settings values with null on a re-run).
              ...(lifestylePreference && { lifestylePreference }),
              ...(diningOutFrequency && { diningOutFrequency }),
              ...(hobbiesWithCosts && { hobbiesWithCosts }),
            },
          });

          // Replace members/pets idempotently: delete any existing rows for
          // this profile, then recreate from the wizard payload. This keeps
          // re-running onboarding safe (consistent with the atomic-bulk model).
          await tx.householdMember.deleteMany({
            where: { householdProfileId: householdProfile.id },
          });
          await tx.householdPet.deleteMany({
            where: { householdProfileId: householdProfile.id },
          });

          for (let i = 0; i < householdMembers.length; i++) {
            const m = householdMembers[i];
            if (!m.name?.trim()) continue;
            await tx.householdMember.create({
              data: {
                householdProfileId: householdProfile.id,
                name: m.name.trim(),
                relationship: m.relationship,
                dateOfBirth: m.dateOfBirth ? new Date(m.dateOfBirth) : null,
                isIncomeEarner: m.relationship === 'CHILD' ? false : m.isIncomeEarner,
                sortOrder: i,
              },
            });
          }

          for (let i = 0; i < householdPets.length; i++) {
            const p = householdPets[i];
            if (!p.name?.trim()) continue;
            await tx.householdPet.create({
              data: {
                householdProfileId: householdProfile.id,
                name: p.name.trim(),
                type: p.type,
                breed: p.breed?.trim() || null,
                sortOrder: i,
              },
            });
          }
        }

        // =======================================================================
        // 2. Create Properties with Loans
        // =======================================================================
        const createdProperties = [];
        for (const prop of data.properties) {
          const now = new Date();
          // Reject missing purchase date instead of silently defaulting to today.
          // A wrong purchase date corrupts CGT, depreciation and equity history
          // downstream; an approximate one from the user is infinitely better.
          if (!prop.purchaseDate) {
            throw new Error(`Property "${prop.name || prop.address || 'unnamed'}" is missing a purchase date.`);
          }
          const purchaseDate = new Date(prop.purchaseDate);
          if (Number.isNaN(purchaseDate.getTime())) {
            throw new Error(`Property "${prop.name || prop.address || 'unnamed'}" has an invalid purchase date.`);
          }
          // Phase 41E.5 — reform-aware fields.
          // Same backfill rule as the 41E.0 schema migration: if the
          // wizard didn't ask for the contract date (pre-cut-over
          // purchaseDate), default acquisitionContractDate := purchaseDate
          // (unambiguously grandfathered). For post-cut-over the wizard
          // prompts for both fields explicitly.
          const REFORM_CUT_OVER_UTC_MS = Date.UTC(2026, 4, 12, 9, 30, 0); // 2026-05-12T09:30:00Z
          const isPostCutOverPurchase = purchaseDate.getTime() > REFORM_CUT_OVER_UTC_MS;
          const acquisitionContractDate = prop.acquisitionContractDate
            ? new Date(prop.acquisitionContractDate)
            : isPostCutOverPurchase
              ? null // user didn't confirm; engine surfaces UC-PROPERTY-CONTRACT-DATE-UNKNOWN
              : purchaseDate; // auto-backfill for pre-cut-over (grandfathered)
          // Create property
          const property = await tx.property.create({
            data: {
              userId,
              ownerEntityId,
              name: prop.name || prop.address || 'Property',
              type: prop.type,
              address: prop.address || null,
              purchasePrice: prop.purchasePrice,
              purchaseDate,
              currentValue: prop.currentValue,
              valuationDate: now,
              // Phase 41E.5 — reform fields from wizard.
              acquisitionContractDate,
              isNewBuild: isPostCutOverPurchase ? (prop.isNewBuild ?? null) : null,
              newBuildEvidence: isPostCutOverPurchase ? (prop.newBuildEvidence ?? null) : null,
            },
          });
          createdProperties.push(property);

          // Create loan if exists
          if (prop.hasLoan && prop.loan) {
            const loan = await tx.loan.create({
              data: {
                userId,
                ownerEntityId,
                propertyId: property.id,
                name: prop.loan.name || `${prop.loan.lender} - ${prop.name}`,
                type: getLoanType(prop.type),
                principal: prop.loan.principal,
                interestRateAnnual: prop.loan.interestRateAnnual / 100, // Convert from percentage to decimal
                rateType: prop.loan.rateType,
                isInterestOnly: prop.loan.isInterestOnly,
                termMonthsRemaining: prop.loan.termMonthsRemaining || 360, // Default 30 years
                minRepayment: prop.loan.minRepayment,
                repaymentFrequency: prop.loan.repaymentFrequency,
              },
            });
            // Map temp ID to real ID for offset linking
            loanIdMap.set(prop.loan.id, loan.id);
          }

          // Create rental income if investment property
          if (prop.type === 'INVESTMENT' && prop.income && prop.income.amount > 0) {
            await tx.income.create({
              data: {
                userId,
                ownerEntityId,
                propertyId: property.id,
                name: `Rent - ${prop.name || prop.address}`,
                type: 'RENTAL',
                sourceType: 'PROPERTY',
                // Canonical contract: store amount AT the given frequency (no conversion).
                amount: prop.income.amount,
                frequency: prop.income.frequency,
              },
            });
          }

          // Create property expenses
          for (const expense of prop.expenses) {
            if (expense.amount > 0) {
              await tx.expense.create({
                data: {
                  userId,
                  ownerEntityId,
                  propertyId: property.id,
                  name: expense.name || expense.category,
                  category: expense.category,
                  sourceType: 'PROPERTY',
                  // Canonical contract: store amount AT the given frequency (no conversion).
                  amount: expense.amount,
                  frequency: expense.frequency,
                  isTaxDeductible: prop.type === 'INVESTMENT', // Investment property expenses are tax deductible
                },
              });
            }
          }
        }

        // =======================================================================
        // 3. Create Bank Accounts
        //
        // PR 3b: accounts with source='BASIQ' or 'IMPORT' are already
        // persisted (by the Basiq sync or the Phase 18 import flow) and
        // pointed to via `existingAccountId`. We skip writing them here
        // to avoid duplicates. MANUAL accounts (or untagged legacy rows)
        // still get created as before.
        // =======================================================================
        const createdAccounts = [];
        for (const acc of data.accounts) {
          // Skip BASIQ / IMPORT rows — they already exist in the DB
          if (acc.source === 'BASIQ' || acc.source === 'IMPORT') {
            // We still honour offset→loan linking for pre-existing
            // accounts: if the user chose an imported account as the
            // offset, write the link to the loan now.
            if (
              acc.type === 'OFFSET' &&
              acc.linkedLoanId &&
              acc.existingAccountId
            ) {
              const realLoanId = loanIdMap.get(acc.linkedLoanId);
              if (realLoanId) {
                await tx.loan.update({
                  where: { id: realLoanId },
                  data: { offsetAccountId: acc.existingAccountId },
                });
              }
            }
            continue;
          }

          const account = await tx.account.create({
            data: {
              userId,
              ownerEntityId,
              name: acc.name || `${acc.type} Account`,
              type: acc.type,
              institution: acc.institution || null,
              currentBalance:
                acc.type === 'CREDIT_CARD'
                  ? -Math.abs(acc.currentBalance)
                  : acc.currentBalance,
              interestRate: acc.interestRate || null,
              // PR 1 + PR 3b: MANUAL is the only source that reaches
              // this branch now. BASIQ/IMPORT are skipped above.
              balanceSource: 'MANUAL',
              balanceLastUpdatedAt: new Date(),
            },
          });
          createdAccounts.push(account);

          // If this is an offset account linked to a loan, update the loan
          if (acc.type === 'OFFSET' && acc.linkedLoanId) {
            const realLoanId = loanIdMap.get(acc.linkedLoanId);
            if (realLoanId) {
              await tx.loan.update({
                where: { id: realLoanId },
                data: { offsetAccountId: account.id },
              });
            }
          }
        }

        // =======================================================================
        // 4. Create Investment Accounts with Holdings
        // =======================================================================
        const createdInvestments = [];
        for (const inv of data.investments) {
          const investmentAccount = await tx.investmentAccount.create({
            data: {
              userId,
              ownerEntityId,
              name: inv.name || `${inv.platform || ''} - ${inv.type}`.trim(),
              type: inv.type,
              platform: inv.platform || null,
              cashBalance: inv.cashBalance,
            },
          });
          createdInvestments.push(investmentAccount);

          // Create holdings
          for (const holding of inv.holdings) {
            if (holding.ticker && holding.units > 0) {
              await tx.investmentHolding.create({
                data: {
                  investmentAccountId: investmentAccount.id,
                  ticker: holding.ticker.toUpperCase(),
                  name: holding.name || null,
                  units: holding.units,
                  averagePrice: holding.averagePrice,
                  type: holding.type,
                  totalCostBasis: holding.units * holding.averagePrice,
                },
              });
            }
          }
        }

        // =======================================================================
        // 4a. Phase 12 PR 3b — SuperannuationAccount rows
        //
        // Super is no longer routed through InvestmentAccount(type=SUPERS).
        // Creates real SuperannuationAccount rows with the minimum viable
        // fields (name, fundName, currentBalance). Everything else defers
        // to a future Settings > Retirement page.
        // =======================================================================
        // Typed as the minimal structural shape we push — avoids the
        // `implicitly has type any[]` strict-mode error if a future
        // edit adds a read site to this array.
        const createdSuper: Array<{ id: string }> = [];
        const superInputs = data.superAccounts ?? [];
        for (const s of superInputs) {
          if (!s.fundName?.trim() && s.currentBalance <= 0) {
            // Skip empty rows — user may have clicked "Add" without filling
            continue;
          }
          const superAccount = await tx.superannuationAccount.create({
            data: {
              userId,
              name: s.name?.trim() || 'My Super',
              fundName: s.fundName?.trim() || null,
              currentBalance: s.currentBalance,
            },
          });
          createdSuper.push(superAccount);
        }

        // =======================================================================
        // 4b. Phase 12 PR 3b — Non-property loans (CAR/STUDENT/PERSONAL/BUSINESS)
        //
        // Captured by the new DebtsStep. CAR loans can link to an Asset
        // (vehicle) via linkedAssetId — the asset is created below in
        // section 5, so we resolve the wizard temp-ID → real ID via a
        // second pass after Assets are written. For now, stash the debt
        // rows to write later.
        // =======================================================================
        const debtInputs = data.debts ?? [];
        // We write the non-CAR debts immediately; CAR debts wait until
        // after the Assets loop so we can resolve linkedAssetId.
        const carDebtsToWriteAfterAssets: typeof debtInputs = [];
        // Typed for the same reason as createdAssets / createdSuper above.
        const createdDebts: Array<{ id: string }> = [];
        for (const debt of debtInputs) {
          if (debt.principal <= 0) continue;
          if (debt.type === 'CAR' && debt.linkedAssetId) {
            carDebtsToWriteAfterAssets.push(debt);
            continue;
          }
          const loan = await tx.loan.create({
            data: {
              userId,
              ownerEntityId,
              name: debt.name?.trim() || debt.type,
              type: debt.type, // CAR | STUDENT | PERSONAL | BUSINESS
              principal: debt.principal,
              interestRateAnnual: (debt.interestRateAnnual || 0) / 100,
              rateType: 'VARIABLE',
              isInterestOnly: false,
              termMonthsRemaining: debt.termMonthsRemaining || 60,
              // HECS/STUDENT is income-contingent — we record 0 as
              // minRepayment since there's no fixed amount. The Tax
              // Intelligence Engine (Phase 20) handles HECS repayment
              // from the user's salary separately.
              minRepayment: debt.isHecsHelp ? 0 : debt.minRepayment,
              repaymentFrequency: debt.repaymentFrequency || 'MONTHLY',
            },
          });
          createdDebts.push(loan);
        }

        // =======================================================================
        // 5. Create Personal Assets
        // =======================================================================
        // Fix (PR 3b.11): explicit element type. The CAR→Asset linking
        // second pass (section 5a below) reads `createdAssets[i].id`,
        // which means TypeScript strict mode can't fall back to the
        // push-site inference. A structural `{ id: string }` type is
        // enough — it's satisfied by the full Prisma `Asset` object we
        // push, and covers the only field we read.
        const createdAssets: Array<{ id: string }> = [];
        for (const asset of data.assets) {
          const now = new Date();
          if (!asset.purchaseDate) {
            throw new Error(`Asset "${asset.name || asset.type}" is missing a purchase date.`);
          }
          const assetPurchaseDate = new Date(asset.purchaseDate);
          if (Number.isNaN(assetPurchaseDate.getTime())) {
            throw new Error(`Asset "${asset.name || asset.type}" has an invalid purchase date.`);
          }
          const createdAsset = await tx.asset.create({
            data: {
              userId,
              ownerEntityId,
              name: asset.name || getAssetName(asset),
              type: asset.type,
              description: asset.description || null,
              purchasePrice: asset.purchasePrice,
              purchaseDate: assetPurchaseDate,
              currentValue: asset.currentValue,
              valuationDate: now,
              ...(asset.type === 'VEHICLE' && {
                vehicleMake: asset.vehicleMake || null,
                vehicleModel: asset.vehicleModel || null,
                vehicleYear: asset.vehicleYear || null,
              }),
            },
          });
          createdAssets.push(createdAsset);

          // Create asset expenses
          for (const expense of asset.expenses) {
            if (expense.amount > 0) {
              await tx.expense.create({
                data: {
                  userId,
                  ownerEntityId,
                  assetId: createdAsset.id,
                  name: expense.name,
                  category: expense.category,
                  sourceType: 'ASSET',
                  // Canonical contract: store amount AT the given frequency.
                  amount: expense.amount,
                  frequency: expense.frequency,
                },
              });
            }
          }
        }

        // =======================================================================
        // 5a. Phase 12 PR 3b — CAR debts linked to vehicle Assets
        //
        // Second pass after Assets are written, so we can resolve the
        // wizard temp-ID → real DB Asset ID for linkedAssetId. If the
        // linked asset doesn't exist (user deleted it mid-flow), we
        // still write the loan but without the link.
        // =======================================================================
        const wizardAssetIdToRealId = new Map<string, string>();
        data.assets.forEach((asset, i) => {
          if (createdAssets[i]) {
            wizardAssetIdToRealId.set(asset.id, createdAssets[i].id);
          }
        });
        for (const debt of carDebtsToWriteAfterAssets) {
          const realAssetId = debt.linkedAssetId
            ? wizardAssetIdToRealId.get(debt.linkedAssetId) || null
            : null;
          const loan = await tx.loan.create({
            data: {
              userId,
              ownerEntityId,
              name: debt.name?.trim() || 'Car loan',
              type: 'CAR',
              principal: debt.principal,
              interestRateAnnual: (debt.interestRateAnnual || 0) / 100,
              rateType: 'VARIABLE',
              isInterestOnly: false,
              termMonthsRemaining: debt.termMonthsRemaining || 60,
              minRepayment: debt.minRepayment,
              repaymentFrequency: debt.repaymentFrequency || 'MONTHLY',
              linkedAssetId: realAssetId,
            },
          });
          createdDebts.push(loan);
        }

        // =======================================================================
        // 6. Create Income Sources
        // =======================================================================
        // Pick the first investment account (if any) so INVESTMENT-type income
        // can be linked to a real InvestmentAccount rather than floating free.
        const firstInvestmentAccountId = createdInvestments[0]?.id ?? null;

        const createdIncome = [];
        for (const inc of data.income) {
          if (inc.amount > 0) {
            // Route sourceType based on the income type (not always GENERAL).
            // Per schema (prisma/schema.prisma) and IncomeSourceType enum:
            //   GENERAL    — salary, other personal income
            //   PROPERTY   — handled earlier in the property loop
            //   INVESTMENT — dividends, distributions, investment interest
            let sourceType: 'GENERAL' | 'INVESTMENT' = 'GENERAL';
            let investmentAccountId: string | null = null;
            if (inc.type === 'INVESTMENT') {
              sourceType = 'INVESTMENT';
              investmentAccountId = firstInvestmentAccountId;
            }

            const income = await tx.income.create({
              data: {
                userId,
                ownerEntityId,
                name: inc.name || inc.type,
                type: inc.type,
                sourceType,
                investmentAccountId,
                // Canonical contract: store amount AT the given frequency.
                amount: inc.amount,
                frequency: inc.frequency,
                ...(inc.type === 'SALARY' && inc.salaryType && {
                  salaryType: inc.salaryType,
                }),
              },
            });
            createdIncome.push(income);
          }
        }

        // =======================================================================
        // 7. Create Expenses
        //
        // Phase 12 PR 3b — Renter path note:
        //   When the user picks housing === 'RENT' or 'BOTH' on the
        //   Welcome step, the Properties step is hidden (see
        //   getStepsForProfile in wizard/types.ts). Rent is modelled as
        //   a regular Expense row with category='RENT' — NOT as a
        //   Property(type=RENTAL). The user adds the rent row themselves
        //   in the Income/Expenses step UI. We do NOT auto-seed a rent
        //   expense here because we don't know the amount — a $0 row
        //   would be worse than none. Plan doc §3 row 3 for details.
        // =======================================================================
        const createdExpenses = [];
        for (const exp of data.expenses) {
          if (exp.amount > 0) {
            const expense = await tx.expense.create({
              data: {
                userId,
                ownerEntityId,
                name: exp.name || exp.category,
                category: exp.category,
                sourceType: 'GENERAL',
                // Canonical contract: store amount AT the given frequency.
                amount: exp.amount,
                frequency: exp.frequency,
                isEssential: exp.isEssential ?? true,
                isTaxDeductible: exp.isTaxDeductible ?? false,
              },
            });
            createdExpenses.push(expense);
          }
        }

        // =======================================================================
        // 8. Update user preferences
        // =======================================================================
        // Phase 12 PR 2: wiping `onboardingDraft` on success is what makes the
        // resume banner disappear and keeps the DB from growing a stale copy
        // of the user's financial data after they've finished onboarding.
        await tx.userPreference.upsert({
          where: { userId },
          create: {
            userId,
            country: data.country,
            taxYear: data.taxYear || null,
            dismissedWelcomeModal: true,
            hasSeenGuidedTour: true,
            // Prisma Json? — raw `null` is rejected by the generated
            // type, so we use Prisma.JsonNull to write SQL NULL.
            onboardingDraft: Prisma.JsonNull,
          },
          update: {
            country: data.country,
            taxYear: data.taxYear || null,
            dismissedWelcomeModal: true,
            onboardingDraft: Prisma.JsonNull,
          },
        });

        return {
          properties: createdProperties.length,
          accounts: createdAccounts.length,
          investments: createdInvestments.length,
          // PR 3b new entity counts
          superAccounts: createdSuper.length,
          debts: createdDebts.length,
          assets: createdAssets.length,
          income: createdIncome.length,
          expenses: createdExpenses.length,
          householdMembers: householdMembers.length,
          householdPets: householdPets.length,
        };
        },
        {
          maxWait: 10_000, // ms — wait up to 10s for a tx slot
          timeout: 30_000, // ms — allow up to 30s for the full bulk write
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Onboarding data saved successfully',
        summary: result,
      });
    } catch (error) {
      // Log a structured snapshot so we can correlate the failure with
      // the user's payload shape without exposing financial values
      // (count-only — no balances, names, or addresses leak into the
      // log). Indispensable when a real user hits a 500 and we need
      // to reproduce.
      try {
        // `parsedPayload` is set after request.json() returns. If we
        // crashed before that point this snapshot is just the user id
        // and a null payload — still useful for correlating failures.
        const p = parsedPayload;
        const payloadSummary: Record<string, unknown> = {
          userId,
          profileType: p?.profileType ?? null,
          housing: p?.housing ?? null,
          counts: {
            properties: p?.properties?.length ?? 0,
            propertiesWithLoan: p?.properties?.filter((x) => x.hasLoan).length ?? 0,
            accounts: p?.accounts?.length ?? 0,
            accountsByType: {
              MANUAL: p?.accounts?.filter((a) => !a.source || a.source === 'MANUAL').length ?? 0,
              IMPORT: p?.accounts?.filter((a) => a.source === 'IMPORT').length ?? 0,
              BASIQ: p?.accounts?.filter((a) => a.source === 'BASIQ').length ?? 0,
            },
            investments: p?.investments?.length ?? 0,
            superAccounts: p?.superAccounts?.length ?? 0,
            debts: p?.debts?.length ?? 0,
            assets: p?.assets?.length ?? 0,
            income: p?.income?.length ?? 0,
            expenses: p?.expenses?.length ?? 0,
            householdMembers: p?.householdMembers?.length ?? 0,
            householdPets: p?.householdPets?.length ?? 0,
          },
        };
        console.error('Bulk create error:', error, payloadSummary);
      } catch {
        console.error('Bulk create error:', error);
      }

      const message = error instanceof Error ? error.message : String(error);

      // Validation errors thrown from inside the transaction (e.g.
      // missing purchase date) are user-recoverable and should
      // return 400, not 500.
      const isValidationError =
        message.includes('missing a purchase date') ||
        message.includes('invalid purchase date');
      if (isValidationError) {
        return NextResponse.json({ error: message }, { status: 400 });
      }

      // Translate common Prisma error codes into actionable messages
      // so the user (and we, when reading server logs) get useful
      // information instead of a generic "Failed to save…".
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code: string | undefined = (error as any)?.code;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta: Record<string, unknown> | undefined = (error as any)?.meta;

      if (code === 'P2028') {
        // Transaction timeout — the bumped 30s ceiling we set should
        // already cover real-world onboarding payloads, so this means
        // either the DB is under load or there's a slow query in the
        // hot path.
        return NextResponse.json(
          {
            error: 'Saving took too long',
            details:
              'The save timed out after 30 seconds. Please try again — your answers are still saved.',
          },
          { status: 504 }
        );
      }

      if (code === 'P2002') {
        // Unique constraint
        const target = Array.isArray(meta?.target)
          ? (meta!.target as string[]).join(', ')
          : (meta?.target as string | undefined) ?? 'a field';
        return NextResponse.json(
          {
            error: 'Duplicate value',
            details: `A record with the same ${target} already exists. Please review your entries and try again.`,
          },
          { status: 409 }
        );
      }

      if (code === 'P2003') {
        // Foreign key violation
        const field =
          (meta?.field_name as string | undefined) ??
          (meta?.constraint as string | undefined) ??
          'a linked record';
        return NextResponse.json(
          {
            error: 'Linked record missing',
            details: `Couldn't find ${field}. Please go back and check your linked accounts/loans, then try again.`,
          },
          { status: 400 }
        );
      }

      // Fallback: 500 with the raw message in `details` so the
      // client banner can show what actually went wrong instead of
      // the generic copy.
      return NextResponse.json(
        {
          error: 'Failed to save onboarding data',
          details: message,
        },
        { status: 500 }
      );
    }
});

// Helper to generate asset name
function getAssetName(asset: AssetInput): string {
  if (asset.type === 'VEHICLE' && asset.vehicleMake) {
    return `${asset.vehicleYear || ''} ${asset.vehicleMake} ${asset.vehicleModel || ''}`.trim();
  }
  return asset.type;
}
