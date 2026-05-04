/**
 * TEST DATA LOADER
 * Loads test scenarios into the application via REST APIs
 *
 * @module lib/testing/loader
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/auth';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import type {
  TestScenarioInput,
  TestLoadResult,
  TestPropertyInput,
  TestLoanInput,
  TestAccountInput,
  TestIncomeInput,
  TestExpenseInput,
  TestInvestmentAccountInput,
  TestHoldingInput,
  TestInvestmentTransactionInput,
  TestDepreciationScheduleInput,
} from './types';
import { normalizeScenario, type FlexibleScenarioInput } from './normalizer';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PASSWORD = 'TestPassword123!';

// =============================================================================
// LOADER CLASS
// =============================================================================

export class TestScenarioLoader {
  private prisma: PrismaClient;
  private userId: string | null = null;
  // Phase 41a: cache the test user's default LegalEntity id once per loader run.
  private ownerEntityId: string | null = null;
  private entityMappings: TestLoadResult['entityMappings'] = {
    properties: {},
    loans: {},
    accounts: {},
    income: {},
    expenses: {},
    investmentAccounts: {},
    holdings: {},
  };
  private errors: TestLoadResult['errors'] = [];
  private stats: TestLoadResult['stats'] = {
    propertiesCreated: 0,
    loansCreated: 0,
    accountsCreated: 0,
    incomeCreated: 0,
    expensesCreated: 0,
    investmentAccountsCreated: 0,
    holdingsCreated: 0,
    transactionsCreated: 0,
    depreciationSchedulesCreated: 0,
  };

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Load a complete test scenario (accepts flexible input format)
   */
  async loadScenario(rawScenario: TestScenarioInput | FlexibleScenarioInput): Promise<TestLoadResult> {
    // Normalize the input to standardized format
    const scenario = normalizeScenario(rawScenario as FlexibleScenarioInput);
    // Reset state
    this.entityMappings = {
      properties: {},
      loans: {},
      accounts: {},
      income: {},
      expenses: {},
      investmentAccounts: {},
      holdings: {},
    };
    this.errors = [];
    this.stats = {
      propertiesCreated: 0,
      loansCreated: 0,
      accountsCreated: 0,
      incomeCreated: 0,
      expensesCreated: 0,
      investmentAccountsCreated: 0,
      holdingsCreated: 0,
      transactionsCreated: 0,
      depreciationSchedulesCreated: 0,
    };

    try {
      // 1. Create or get test user
      this.userId = await this.createOrGetTestUser(scenario.testUser);

      // 2. Load entities in dependency order
      // Order matters: accounts before loans (for offset), properties before loans/income/expenses

      // Properties first (no dependencies)
      if (scenario.data.properties) {
        await this.loadProperties(scenario.data.properties);
      }

      // Accounts second (no dependencies)
      if (scenario.data.accounts) {
        await this.loadAccounts(scenario.data.accounts);
      }

      // Loans third (depends on properties and accounts)
      if (scenario.data.loans) {
        await this.loadLoans(scenario.data.loans);
      }

      // Investment accounts (no dependencies)
      if (scenario.data.investmentAccounts) {
        await this.loadInvestmentAccounts(scenario.data.investmentAccounts);
      }

      // Holdings (depends on investment accounts)
      if (scenario.data.holdings) {
        await this.loadHoldings(scenario.data.holdings);
      }

      // Investment transactions (depends on investment accounts and holdings)
      if (scenario.data.investmentTransactions) {
        await this.loadInvestmentTransactions(scenario.data.investmentTransactions);
      }

      // Income (depends on properties and investment accounts)
      if (scenario.data.income) {
        await this.loadIncome(scenario.data.income);
      }

      // Expenses (depends on properties, loans, investment accounts)
      if (scenario.data.expenses) {
        await this.loadExpenses(scenario.data.expenses);
      }

      // Depreciation schedules (depends on properties)
      if (scenario.data.depreciationSchedules) {
        await this.loadDepreciationSchedules(scenario.data.depreciationSchedules);
      }

      return {
        success: this.errors.length === 0,
        scenarioId: scenario.scenarioId,
        userId: this.userId,
        entityMappings: this.entityMappings,
        stats: this.stats,
        errors: this.errors,
      };
    } catch (error) {
      return {
        success: false,
        scenarioId: scenario.scenarioId,
        userId: this.userId || '',
        entityMappings: this.entityMappings,
        stats: this.stats,
        errors: [
          ...this.errors,
          {
            entity: 'scenario',
            name: scenario.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  /**
   * Create or get test user
   */
  private async createOrGetTestUser(testUser: TestScenarioInput['testUser']): Promise<string> {
    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email: testUser.email },
    });

    if (!user) {
      // Hash the password before storing
      const plainPassword = testUser.password || DEFAULT_PASSWORD;
      const hashedPassword = await hashPassword(plainPassword);

      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: testUser.email,
          name: testUser.name,
          password: hashedPassword,
          emailVerified: true,
          onboardingCompleted: true,
        },
      });
    }

    return user.id;
  }

  /**
   * Resolve (and cache) the test user's default `LegalEntity` id. Phase 41a
   * — every owned row needs an `ownerEntityId`; until the wizard ships,
   * test scenarios pin to the user's PERSONAL_NAME entity (created on
   * demand by the canonical helper).
   */
  private async getOwnerEntityId(): Promise<string> {
    if (this.ownerEntityId) return this.ownerEntityId;
    if (!this.userId) {
      throw new Error('TestScenarioLoader: userId not set when resolving ownerEntityId');
    }
    this.ownerEntityId = await getDefaultLegalEntityId(this.userId, this.prisma);
    return this.ownerEntityId;
  }

  /**
   * Load properties
   */
  private async loadProperties(properties: TestPropertyInput[]): Promise<void> {
    const ownerEntityId = await this.getOwnerEntityId();
    for (const prop of properties) {
      try {
        const created = await this.prisma.property.create({
          data: {
            userId: this.userId!,
            ownerEntityId,
            name: prop.name,
            type: prop.type,
            address: prop.address,
            purchasePrice: prop.purchasePrice,
            purchaseDate: new Date(prop.purchaseDate),
            currentValue: prop.currentValue,
            valuationDate: prop.valuationDate ? new Date(prop.valuationDate) : new Date(),
            latitude: prop.latitude,
            longitude: prop.longitude,
            suburb: prop.suburb,
            state: prop.state,
            postcode: prop.postcode,
          },
        });
        this.entityMappings.properties[prop.name] = created.id;
        this.stats.propertiesCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'property',
          name: prop.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Load accounts
   */
  private async loadAccounts(accounts: TestAccountInput[]): Promise<void> {
    const ownerEntityId = await this.getOwnerEntityId();
    for (const account of accounts) {
      try {
        const created = await this.prisma.account.create({
          data: {
            userId: this.userId!,
            ownerEntityId,
            name: account.name,
            type: account.type,
            institution: account.institution,
            currentBalance: account.currentBalance,
            interestRate: account.interestRate,
          },
        });
        this.entityMappings.accounts[account.name] = created.id;
        this.stats.accountsCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'account',
          name: account.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Load loans
   */
  private async loadLoans(loans: TestLoanInput[]): Promise<void> {
    const ownerEntityId = await this.getOwnerEntityId();
    for (const loan of loans) {
      try {
        // Resolve references
        const propertyId = loan.propertyRef
          ? this.entityMappings.properties[loan.propertyRef]
          : undefined;
        const offsetAccountId = loan.offsetAccountRef
          ? this.entityMappings.accounts[loan.offsetAccountRef]
          : undefined;

        const created = await this.prisma.loan.create({
          data: {
            userId: this.userId!,
            ownerEntityId,
            name: loan.name,
            type: loan.type,
            principal: loan.principal,
            interestRateAnnual: loan.interestRateAnnual,
            rateType: loan.rateType,
            isInterestOnly: loan.isInterestOnly,
            termMonthsRemaining: loan.termMonthsRemaining,
            minRepayment: loan.minRepayment,
            repaymentFrequency: loan.repaymentFrequency,
            fixedExpiry: loan.fixedExpiry ? new Date(loan.fixedExpiry) : undefined,
            extraRepaymentCap: loan.extraRepaymentCap,
            propertyId,
            offsetAccountId,
          },
        });
        this.entityMappings.loans[loan.name] = created.id;
        this.stats.loansCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'loan',
          name: loan.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Load investment accounts
   */
  private async loadInvestmentAccounts(accounts: TestInvestmentAccountInput[]): Promise<void> {
    const ownerEntityId = await this.getOwnerEntityId();
    for (const account of accounts) {
      try {
        const created = await this.prisma.investmentAccount.create({
          data: {
            userId: this.userId!,
            ownerEntityId,
            name: account.name,
            type: account.type,
            platform: account.platform,
            currency: account.currency || 'AUD',
            cashBalance: account.cashBalance || 0,
            openingBalance: account.openingBalance || 0,
            costBasisMethod: account.costBasisMethod || 'FIFO',
          },
        });
        this.entityMappings.investmentAccounts[account.name] = created.id;
        this.stats.investmentAccountsCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'investmentAccount',
          name: account.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Load holdings
   */
  private async loadHoldings(holdings: TestHoldingInput[]): Promise<void> {
    for (const holding of holdings) {
      try {
        const investmentAccountId = this.entityMappings.investmentAccounts[holding.investmentAccountRef];
        if (!investmentAccountId) {
          throw new Error(`Investment account not found: ${holding.investmentAccountRef}`);
        }

        const created = await this.prisma.investmentHolding.create({
          data: {
            investmentAccountId,
            ticker: holding.ticker,
            name: holding.name,
            type: holding.type,
            units: holding.units,
            averagePrice: holding.averagePrice,
            currentPrice: holding.currentPrice,
            currentValue: holding.currentPrice
              ? holding.units * holding.currentPrice
              : holding.units * holding.averagePrice,
            totalCostBasis: holding.units * holding.averagePrice,
            frankingPercentage: holding.frankingPercentage,
          },
        });
        this.entityMappings.holdings[holding.ticker] = created.id;
        this.stats.holdingsCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'holding',
          name: holding.ticker,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Load investment transactions
   */
  private async loadInvestmentTransactions(
    transactions: TestInvestmentTransactionInput[]
  ): Promise<void> {
    for (const tx of transactions) {
      try {
        const investmentAccountId =
          this.entityMappings.investmentAccounts[tx.investmentAccountRef];
        if (!investmentAccountId) {
          throw new Error(`Investment account not found: ${tx.investmentAccountRef}`);
        }

        const holdingId = tx.holdingRef
          ? this.entityMappings.holdings[tx.holdingRef]
          : undefined;

        await this.prisma.investmentTransaction.create({
          data: {
            investmentAccountId,
            holdingId,
            type: tx.type,
            date: new Date(tx.date),
            price: tx.price,
            units: tx.units,
            fees: tx.fees || 0,
            notes: tx.notes,
            totalAmount: tx.price * tx.units + (tx.fees || 0),
          },
        });
        this.stats.transactionsCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'investmentTransaction',
          name: `${tx.type} ${tx.holdingRef || 'cash'}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Load income
   */
  private async loadIncome(incomeItems: TestIncomeInput[]): Promise<void> {
    const ownerEntityId = await this.getOwnerEntityId();
    for (const income of incomeItems) {
      try {
        // Resolve references
        const propertyId = income.propertyRef
          ? this.entityMappings.properties[income.propertyRef]
          : undefined;
        const investmentAccountId = income.investmentAccountRef
          ? this.entityMappings.investmentAccounts[income.investmentAccountRef]
          : undefined;

        const created = await this.prisma.income.create({
          data: {
            userId: this.userId!,
            ownerEntityId,
            name: income.name,
            type: income.type,
            sourceType: income.sourceType || 'GENERAL',
            amount: income.amount,
            frequency: income.frequency,
            isTaxable: income.isTaxable ?? true,
            salaryType: income.salaryType,
            superGuaranteeRate: income.superGuaranteeRate,
            salarySacrifice: income.salarySacrifice,
            frankingPercentage: income.frankingPercentage,
            propertyId,
            investmentAccountId,
            startDate: income.startDate ? new Date(income.startDate) : undefined,
            endDate: income.endDate ? new Date(income.endDate) : undefined,
          },
        });
        this.entityMappings.income[income.name] = created.id;
        this.stats.incomeCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'income',
          name: income.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Load expenses
   */
  private async loadExpenses(expenses: TestExpenseInput[]): Promise<void> {
    const ownerEntityId = await this.getOwnerEntityId();
    for (const expense of expenses) {
      try {
        // Resolve references
        const propertyId = expense.propertyRef
          ? this.entityMappings.properties[expense.propertyRef]
          : undefined;
        const loanId = expense.loanRef
          ? this.entityMappings.loans[expense.loanRef]
          : undefined;
        const investmentAccountId = expense.investmentAccountRef
          ? this.entityMappings.investmentAccounts[expense.investmentAccountRef]
          : undefined;

        const created = await this.prisma.expense.create({
          data: {
            userId: this.userId!,
            ownerEntityId,
            name: expense.name,
            vendorName: expense.vendorName,
            category: expense.category,
            sourceType: expense.sourceType || 'GENERAL',
            amount: expense.amount,
            frequency: expense.frequency,
            isEssential: expense.isEssential ?? true,
            isTaxDeductible: expense.isTaxDeductible ?? false,
            propertyId,
            loanId,
            investmentAccountId,
          },
        });
        this.entityMappings.expenses[expense.name] = created.id;
        this.stats.expensesCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'expense',
          name: expense.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Load depreciation schedules
   */
  private async loadDepreciationSchedules(
    schedules: TestDepreciationScheduleInput[]
  ): Promise<void> {
    for (const schedule of schedules) {
      try {
        const propertyId = this.entityMappings.properties[schedule.propertyRef];
        if (!propertyId) {
          throw new Error(`Property not found: ${schedule.propertyRef}`);
        }

        await this.prisma.depreciationSchedule.create({
          data: {
            propertyId,
            assetName: schedule.assetName,
            category: schedule.category,
            method: schedule.method,
            cost: schedule.cost,
            rate: schedule.rate,
            startDate: new Date(schedule.startDate),
            notes: schedule.notes,
          },
        });
        this.stats.depreciationSchedulesCreated++;
      } catch (error) {
        this.errors.push({
          entity: 'depreciationSchedule',
          name: schedule.assetName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load a test scenario from a fixture file
 */
export async function loadTestScenario(
  scenario: TestScenarioInput,
  prisma?: PrismaClient
): Promise<TestLoadResult> {
  const loader = new TestScenarioLoader(prisma);
  try {
    return await loader.loadScenario(scenario);
  } finally {
    if (!prisma) {
      await loader.disconnect();
    }
  }
}

/**
 * Load a test scenario from JSON file path
 */
export async function loadTestScenarioFromFile(
  filePath: string,
  prisma?: PrismaClient
): Promise<TestLoadResult> {
  const fs = await import('fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  const scenario: TestScenarioInput = JSON.parse(content);
  return loadTestScenario(scenario, prisma);
}
