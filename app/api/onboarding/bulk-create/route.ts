import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';

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

interface AccountInput {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  currentBalance: number;
  interestRate?: number;
  linkedLoanId?: string;
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

interface WizardData {
  profileType: string | null;
  country: string;
  taxYear: string;
  // Phase 29: Household
  householdMembers?: HouseholdMemberInput[];
  householdPets?: HouseholdPetInput[];
  carsCount?: number;
  properties: PropertyInput[];
  accounts: AccountInput[];
  investments: InvestmentAccountInput[];
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
    try {
      const userId = auth.userId;
      const data: WizardData = await request.json();

      // ID mapping for linking (temp ID -> real ID)
      const loanIdMap = new Map<string, string>();

      // Start a transaction to create all data atomically
      const result = await prisma.$transaction(async (tx: TransactionClient) => {
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
        //
        // The wizard collects members/pets/carsCount but previously discarded
        // them. The Phase 28 budget AI depends on this data, so we upsert a
        // HouseholdProfile and its children here. Lifestyle preferences are
        // not captured by the wizard yet — they fall back to schema defaults
        // (MODERATE / SOMETIMES) until the redesigned step lands in PR 3.
        // =======================================================================
        const householdMembers = data.householdMembers ?? [];
        const householdPets = data.householdPets ?? [];
        const carsCount = data.carsCount ?? 0;

        if (householdMembers.length > 0 || householdPets.length > 0 || carsCount > 0) {
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
            },
            update: {
              adultsCount,
              childrenCount,
              childrenAges,
              petsCount: householdPets.length,
              petTypes,
              carsCount,
              isComplete: true,
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
          // Create property
          const property = await tx.property.create({
            data: {
              userId,
              name: prop.name || prop.address || 'Property',
              type: prop.type,
              address: prop.address || null,
              purchasePrice: prop.purchasePrice,
              purchaseDate,
              currentValue: prop.currentValue,
              valuationDate: now,
            },
          });
          createdProperties.push(property);

          // Create loan if exists
          if (prop.hasLoan && prop.loan) {
            const loan = await tx.loan.create({
              data: {
                userId,
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
        // =======================================================================
        const createdAccounts = [];
        for (const acc of data.accounts) {
          const account = await tx.account.create({
            data: {
              userId,
              name: acc.name || `${acc.type} Account`,
              type: acc.type,
              institution: acc.institution || null,
              currentBalance: acc.type === 'CREDIT_CARD' ? -Math.abs(acc.currentBalance) : acc.currentBalance,
              interestRate: acc.interestRate || null,
              // Onboarded accounts are always manually entered.
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
        // 5. Create Personal Assets
        // =======================================================================
        const createdAssets = [];
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
        // =======================================================================
        const createdExpenses = [];
        for (const exp of data.expenses) {
          if (exp.amount > 0) {
            const expense = await tx.expense.create({
              data: {
                userId,
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
        await tx.userPreference.upsert({
          where: { userId },
          create: {
            userId,
            country: data.country,
            taxYear: data.taxYear || null,
            dismissedWelcomeModal: true,
            hasSeenGuidedTour: true,
          },
          update: {
            country: data.country,
            taxYear: data.taxYear || null,
            dismissedWelcomeModal: true,
          },
        });

        return {
          properties: createdProperties.length,
          accounts: createdAccounts.length,
          investments: createdInvestments.length,
          assets: createdAssets.length,
          income: createdIncome.length,
          expenses: createdExpenses.length,
          householdMembers: householdMembers.length,
          householdPets: householdPets.length,
        };
      });

      return NextResponse.json({
        success: true,
        message: 'Onboarding data saved successfully',
        summary: result,
      });
    } catch (error) {
      console.error('Bulk create error:', error);
      // Validation errors thrown from inside the transaction (e.g. missing
      // purchase date) are user-recoverable and should return 400, not 500.
      const message = error instanceof Error ? error.message : String(error);
      const isValidationError =
        message.includes('missing a purchase date') ||
        message.includes('invalid purchase date');
      return NextResponse.json(
        {
          error: isValidationError ? message : 'Failed to save onboarding data',
          details: isValidationError ? undefined : message,
        },
        { status: isValidationError ? 400 : 500 }
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
