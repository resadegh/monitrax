/**
 * TEST DATA RESET
 * Clears all test data for a user
 *
 * @module lib/testing/reset
 */

import { PrismaClient } from '@prisma/client';
import type { TestResetResult } from './types';

// =============================================================================
// RESET CLASS
// =============================================================================

export class TestScenarioReset {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Reset all data for a test user
   */
  async resetUser(userId: string): Promise<TestResetResult> {
    const deleted: TestResetResult['deleted'] = {
      properties: 0,
      loans: 0,
      accounts: 0,
      income: 0,
      expenses: 0,
      investmentAccounts: 0,
      holdings: 0,
      transactions: 0,
      depreciationSchedules: 0,
    };

    try {
      // Delete in reverse dependency order

      // 1. Depreciation schedules (depends on properties)
      const depSchedules = await this.prisma.depreciationSchedule.deleteMany({
        where: { property: { userId } },
      });
      deleted.depreciationSchedules = depSchedules.count;

      // 2. Investment transactions (depends on holdings and investment accounts)
      const invTransactions = await this.prisma.investmentTransaction.deleteMany({
        where: { investmentAccount: { userId } },
      });
      deleted.transactions = invTransactions.count;

      // 3. Holdings (depends on investment accounts)
      const holdings = await this.prisma.investmentHolding.deleteMany({
        where: { investmentAccount: { userId } },
      });
      deleted.holdings = holdings.count;

      // 4. Expenses (depends on properties, loans)
      const expenses = await this.prisma.expense.deleteMany({
        where: { userId },
      });
      deleted.expenses = expenses.count;

      // 5. Income (depends on properties, investment accounts)
      const income = await this.prisma.income.deleteMany({
        where: { userId },
      });
      deleted.income = income.count;

      // 6. Bank transactions (depends on accounts)
      await this.prisma.transaction.deleteMany({
        where: { userId },
      });

      // 7. Loans (depends on properties, accounts)
      const loans = await this.prisma.loan.deleteMany({
        where: { userId },
      });
      deleted.loans = loans.count;

      // 8. Investment accounts
      const investmentAccounts = await this.prisma.investmentAccount.deleteMany({
        where: { userId },
      });
      deleted.investmentAccounts = investmentAccounts.count;

      // 9. Accounts
      const accounts = await this.prisma.account.deleteMany({
        where: { userId },
      });
      deleted.accounts = accounts.count;

      // 10. Properties (no dependencies remaining)
      const properties = await this.prisma.property.deleteMany({
        where: { userId },
      });
      deleted.properties = properties.count;

      return {
        success: true,
        userId,
        deleted,
      };
    } catch (error) {
      return {
        success: false,
        userId,
        deleted,
      };
    }
  }

  /**
   * Delete a test user completely
   */
  async deleteTestUser(userId: string): Promise<{ success: boolean; userId: string }> {
    try {
      // First reset all data
      await this.resetUser(userId);

      // Then delete the user
      await this.prisma.user.delete({
        where: { id: userId },
      });

      return { success: true, userId };
    } catch (error) {
      return { success: false, userId };
    }
  }

  /**
   * Find test user by email
   */
  async findTestUser(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user?.id || null;
  }

  /**
   * Reset test user by email
   */
  async resetByEmail(email: string): Promise<TestResetResult | null> {
    const userId = await this.findTestUser(email);
    if (!userId) {
      return null;
    }
    return this.resetUser(userId);
  }

  /**
   * Delete test user by email
   */
  async deleteByEmail(email: string): Promise<{ success: boolean; userId: string } | null> {
    const userId = await this.findTestUser(email);
    if (!userId) {
      return null;
    }
    return this.deleteTestUser(userId);
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
 * Reset all data for a test user
 */
export async function resetTestUser(
  userId: string,
  prisma?: PrismaClient
): Promise<TestResetResult> {
  const resetter = new TestScenarioReset(prisma);
  try {
    return await resetter.resetUser(userId);
  } finally {
    if (!prisma) {
      await resetter.disconnect();
    }
  }
}

/**
 * Reset test user by email
 */
export async function resetTestUserByEmail(
  email: string,
  prisma?: PrismaClient
): Promise<TestResetResult | null> {
  const resetter = new TestScenarioReset(prisma);
  try {
    return await resetter.resetByEmail(email);
  } finally {
    if (!prisma) {
      await resetter.disconnect();
    }
  }
}

/**
 * Delete test user completely
 */
export async function deleteTestUser(
  userId: string,
  prisma?: PrismaClient
): Promise<{ success: boolean; userId: string }> {
  const resetter = new TestScenarioReset(prisma);
  try {
    return await resetter.deleteTestUser(userId);
  } finally {
    if (!prisma) {
      await resetter.disconnect();
    }
  }
}
