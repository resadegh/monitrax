import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

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
type ExpenseCategory = 'HOUSING' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'TRANSPORT' | 'ENTERTAINMENT' | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION' | 'MODIFICATIONS' | 'OTHER';

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

interface WizardData {
  profileType: string | null;
  country: string;
  taxYear: string;
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

function normalizeToMonthly(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'WEEKLY':
      return (amount * 52) / 12;
    case 'FORTNIGHTLY':
      return (amount * 26) / 12;
    case 'MONTHLY':
      return amount;
    case 'QUARTERLY':
      return amount / 3;
    case 'ANNUAL':
      return amount / 12;
    default:
      return amount;
  }
}

// Map PropertyType to LoanType
function getLoanType(propertyType: PropertyType): 'HOME' | 'INVESTMENT' {
  return propertyType === 'HOME' ? 'HOME' : 'INVESTMENT';
}

// =============================================================================
// POST - Bulk create all onboarding data
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
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
        // 2. Create Properties with Loans
        // =======================================================================
        const createdProperties = [];
        for (const prop of data.properties) {
          const now = new Date();
          // Create property
          const property = await tx.property.create({
            data: {
              userId,
              name: prop.name || prop.address || 'Property',
              type: prop.type,
              address: prop.address || null,
              purchasePrice: prop.purchasePrice,
              purchaseDate: prop.purchaseDate ? new Date(prop.purchaseDate) : now,
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
            const monthlyAmount = normalizeToMonthly(prop.income.amount, prop.income.frequency);
            await tx.income.create({
              data: {
                userId,
                propertyId: property.id,
                name: `Rent - ${prop.name || prop.address}`,
                type: 'RENTAL',
                sourceType: 'PROPERTY',
                amount: monthlyAmount,
                frequency: prop.income.frequency,
              },
            });
          }

          // Create property expenses
          for (const expense of prop.expenses) {
            if (expense.amount > 0) {
              const monthlyAmount = normalizeToMonthly(expense.amount, expense.frequency);
              await tx.expense.create({
                data: {
                  userId,
                  propertyId: property.id,
                  name: expense.name || expense.category,
                  category: expense.category,
                  sourceType: 'PROPERTY',
                  amount: monthlyAmount,
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
          // Get linked loan ID if offset
          let offsetAccountId: string | null = null;

          const account = await tx.account.create({
            data: {
              userId,
              name: acc.name || `${acc.type} Account`,
              type: acc.type,
              institution: acc.institution || null,
              currentBalance: acc.type === 'CREDIT_CARD' ? -Math.abs(acc.currentBalance) : acc.currentBalance,
              interestRate: acc.interestRate || null,
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
          const createdAsset = await tx.asset.create({
            data: {
              userId,
              name: asset.name || getAssetName(asset),
              type: asset.type,
              description: asset.description || null,
              purchasePrice: asset.purchasePrice,
              purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : now,
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
              const monthlyAmount = normalizeToMonthly(expense.amount, expense.frequency);
              await tx.expense.create({
                data: {
                  userId,
                  assetId: createdAsset.id,
                  name: expense.name,
                  category: expense.category,
                  sourceType: 'ASSET',
                  amount: monthlyAmount,
                  frequency: expense.frequency,
                },
              });
            }
          }
        }

        // =======================================================================
        // 6. Create Income Sources
        // =======================================================================
        const createdIncome = [];
        for (const inc of data.income) {
          if (inc.amount > 0) {
            const monthlyAmount = normalizeToMonthly(inc.amount, inc.frequency);
            const income = await tx.income.create({
              data: {
                userId,
                name: inc.name || inc.type,
                type: inc.type,
                sourceType: 'GENERAL',
                amount: monthlyAmount,
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
            const monthlyAmount = normalizeToMonthly(exp.amount, exp.frequency);
            const expense = await tx.expense.create({
              data: {
                userId,
                name: exp.name || exp.category,
                category: exp.category,
                sourceType: 'GENERAL',
                amount: monthlyAmount,
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
            dismissedWelcomeModal: true,
            hasSeenGuidedTour: true,
          },
          update: {
            country: data.country,
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
        };
      });

      return NextResponse.json({
        success: true,
        message: 'Onboarding data saved successfully',
        summary: result,
      });
    } catch (error) {
      console.error('Bulk create error:', error);
      return NextResponse.json(
        { error: 'Failed to save onboarding data', details: String(error) },
        { status: 500 }
      );
    }
  });
}

// Helper to generate asset name
function getAssetName(asset: AssetInput): string {
  if (asset.type === 'VEHICLE' && asset.vehicleMake) {
    return `${asset.vehicleYear || ''} ${asset.vehicleMake} ${asset.vehicleModel || ''}`.trim();
  }
  return asset.type;
}
