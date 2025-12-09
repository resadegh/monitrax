import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

// =============================================================================
// TYPES (matching wizard types)
// =============================================================================

interface PropertyLoanInput {
  id: string;
  lender: string;
  principal: number;
  interestRate: number;
  rateType: 'FIXED' | 'VARIABLE';
  isInterestOnly: boolean;
  repaymentAmount: number;
  repaymentFrequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
}

interface PropertyIncomeInput {
  id: string;
  type: 'RENT';
  amount: number;
  frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
  tenantName?: string;
}

interface PropertyExpenseInput {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
}

interface PropertyInput {
  id: string;
  name: string;
  address: string;
  type: 'PRIMARY_RESIDENCE' | 'INVESTMENT' | 'HOLIDAY_HOME';
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
  type: 'TRANSACTION' | 'SAVINGS' | 'OFFSET' | 'CREDIT_CARD';
  balance: number;
  isOffset: boolean;
  linkedLoanId?: string;
}

interface HoldingInput {
  id: string;
  ticker: string;
  units: number;
  averagePrice: number;
}

interface InvestmentAccountInput {
  id: string;
  name: string;
  platform: string;
  type: 'BROKERAGE' | 'SUPER' | 'MANAGED_FUND' | 'CRYPTO';
  cashBalance: number;
  holdings: HoldingInput[];
}

interface AssetExpenseInput {
  id: string;
  name: string;
  amount: number;
  frequency: string;
}

interface AssetInput {
  id: string;
  name: string;
  type: 'VEHICLE' | 'ELECTRONICS' | 'JEWELLERY' | 'FURNITURE' | 'COLLECTIBLE' | 'OTHER';
  purchasePrice: number;
  currentValue: number;
  purchaseDate?: string;
  expenses: AssetExpenseInput[];
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
}

interface IncomeInput {
  id: string;
  name: string;
  type: 'SALARY' | 'DIVIDENDS' | 'INTEREST' | 'RENTAL' | 'BUSINESS' | 'OTHER';
  amount: number;
  frequency: string;
  salaryType?: 'GROSS' | 'NET';
}

interface ExpenseInput {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
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

function normalizeToMonthly(amount: number, frequency: string): number {
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
      const result = await prisma.$transaction(async (tx: typeof prisma) => {
      // =======================================================================
      // 1. Update user onboarding status
      // =======================================================================
      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
          onboardingProfileType: data.profileType as any,
        },
      });

      // =======================================================================
      // 2. Create Properties with Loans
      // =======================================================================
      const createdProperties = [];
      for (const prop of data.properties) {
        // Create property
        const property = await tx.property.create({
          data: {
            userId,
            name: prop.name || prop.address,
            address: prop.address,
            type: prop.type,
            purchasePrice: prop.purchasePrice,
            currentValue: prop.currentValue,
            purchaseDate: prop.purchaseDate ? new Date(prop.purchaseDate) : null,
          },
        });
        createdProperties.push(property);

        // Create loan if exists
        if (prop.hasLoan && prop.loan) {
          const loan = await tx.loan.create({
            data: {
              userId,
              propertyId: property.id,
              lender: prop.loan.lender,
              principal: prop.loan.principal,
              interestRate: prop.loan.interestRate,
              rateType: prop.loan.rateType,
              isInterestOnly: prop.loan.isInterestOnly,
              repaymentAmount: prop.loan.repaymentAmount,
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
              type: 'RENT',
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
                amount: monthlyAmount,
                frequency: expense.frequency,
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
        let linkedLoanId = null;
        if (acc.isOffset && acc.linkedLoanId) {
          linkedLoanId = loanIdMap.get(acc.linkedLoanId);
        }

        const account = await tx.account.create({
          data: {
            userId,
            name: acc.name || `${acc.type} Account`,
            type: acc.type,
            balance: acc.type === 'CREDIT_CARD' ? -Math.abs(acc.balance) : acc.balance,
            isOffset: acc.isOffset,
            linkedLoanId,
          },
        });
        createdAccounts.push(account);
      }

      // =======================================================================
      // 4. Create Investment Accounts with Holdings
      // =======================================================================
      const createdInvestments = [];
      for (const inv of data.investments) {
        const investmentAccount = await tx.investmentAccount.create({
          data: {
            userId,
            name: inv.name || `${inv.platform} - ${inv.type}`,
            platform: inv.platform,
            type: inv.type,
            cashBalance: inv.cashBalance,
          },
        });
        createdInvestments.push(investmentAccount);

        // Create holdings
        for (const holding of inv.holdings) {
          if (holding.ticker && holding.units > 0) {
            await tx.holding.create({
              data: {
                investmentAccountId: investmentAccount.id,
                ticker: holding.ticker.toUpperCase(),
                units: holding.units,
                averagePrice: holding.averagePrice,
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
        const createdAsset = await tx.asset.create({
          data: {
            userId,
            name: asset.name || getAssetName(asset),
            type: asset.type,
            purchasePrice: asset.purchasePrice,
            currentValue: asset.currentValue,
            purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : null,
            ...(asset.type === 'VEHICLE' && {
              vehicleMake: asset.vehicleMake,
              vehicleModel: asset.vehicleModel,
              vehicleYear: asset.vehicleYear,
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
                category: 'ASSET_EXPENSE',
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
              amount: monthlyAmount,
              frequency: inc.frequency,
              ...(inc.type === 'SALARY' && {
                isGross: inc.salaryType === 'GROSS',
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
              amount: monthlyAmount,
              frequency: exp.frequency,
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
