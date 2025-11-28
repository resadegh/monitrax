/**
 * CROSS-MODULE SANITY CHECKS
 * Validates data consistency and calculations across modules
 *
 * Run with: npm run test:sanity
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_USER_A_ID = '00000000-0000-0000-0000-000000000001';
const TEST_USER_B_ID = '00000000-0000-0000-0000-000000000002';

// =============================================================================
// ACCOUNTING IDENTITY CHECKS
// =============================================================================

describe('Accounting Identity Checks', () => {
  describe('Assets = Liabilities + Equity (for properties)', () => {
    it('should satisfy accounting equation for Portfolio A', async () => {
      const properties = await prisma.property.findMany({
        where: { userId: TEST_USER_A_ID },
      });
      const loans = await prisma.loan.findMany({
        where: { userId: TEST_USER_A_ID },
      });

      const totalPropertyValue = properties.reduce(
        (sum, p) => sum + Number(p.currentValue),
        0
      );
      const totalLoanValue = loans.reduce(
        (sum, l) => sum + Number(l.principal),
        0
      );
      const totalEquity = totalPropertyValue - totalLoanValue;

      // Equity should be positive for Portfolio A
      expect(totalEquity).toBeGreaterThan(0);

      // Verify: Assets = Liabilities + Equity
      expect(totalPropertyValue).toBe(totalLoanValue + totalEquity);
    });

    it('should have minimal equity for high-LVR Portfolio B', async () => {
      const properties = await prisma.property.findMany({
        where: { userId: TEST_USER_B_ID },
      });
      const loans = await prisma.loan.findMany({
        where: { userId: TEST_USER_B_ID },
      });

      const totalPropertyValue = properties.reduce(
        (sum, p) => sum + Number(p.currentValue),
        0
      );
      const totalLoanValue = loans.reduce(
        (sum, l) => sum + Number(l.principal),
        0
      );
      const equityPercentage = (totalPropertyValue - totalLoanValue) / totalPropertyValue;

      // Portfolio B should have very low equity (< 10%)
      expect(equityPercentage).toBeLessThan(0.10);
    });
  });
});

// =============================================================================
// REFERENTIAL INTEGRITY CHECKS
// =============================================================================

describe('Referential Integrity Checks', () => {
  describe('All Foreign Keys Resolve', () => {
    it('should have valid propertyId on all loans', async () => {
      const loans = await prisma.loan.findMany({
        where: { propertyId: { not: null } },
      });

      for (const loan of loans) {
        const property = await prisma.property.findUnique({
          where: { id: loan.propertyId! },
        });
        expect(property).not.toBeNull();
        expect(property!.userId).toBe(loan.userId);
      }
    });

    it('should have valid offsetAccountId on loans with offset', async () => {
      const loans = await prisma.loan.findMany({
        where: { offsetAccountId: { not: null } },
      });

      for (const loan of loans) {
        const account = await prisma.account.findUnique({
          where: { id: loan.offsetAccountId! },
        });
        expect(account).not.toBeNull();
        expect(account!.type).toBe('OFFSET');
        expect(account!.userId).toBe(loan.userId);
      }
    });

    it('should have valid investmentAccountId on holdings', async () => {
      const holdings = await prisma.investmentHolding.findMany();

      for (const holding of holdings) {
        const account = await prisma.investmentAccount.findUnique({
          where: { id: holding.investmentAccountId },
        });
        expect(account).not.toBeNull();
      }
    });

    it('should have valid holdingId on investment transactions', async () => {
      const transactions = await prisma.investmentTransaction.findMany({
        where: { holdingId: { not: null } },
      });

      for (const tx of transactions) {
        const holding = await prisma.investmentHolding.findUnique({
          where: { id: tx.holdingId! },
        });
        expect(holding).not.toBeNull();
      }
    });
  });

  describe('User Ownership Consistency', () => {
    it('should have consistent userId across related entities', async () => {
      const loans = await prisma.loan.findMany({
        include: {
          property: true,
          offsetAccount: true,
        },
      });

      for (const loan of loans) {
        if (loan.property) {
          expect(loan.property.userId).toBe(loan.userId);
        }
        if (loan.offsetAccount) {
          expect(loan.offsetAccount.userId).toBe(loan.userId);
        }
      }
    });
  });
});

// =============================================================================
// CALCULATION CONSISTENCY CHECKS
// =============================================================================

describe('Calculation Consistency Checks', () => {
  describe('Interest Rate Bounds', () => {
    it('should have interest rates between 0% and 30%', async () => {
      const loans = await prisma.loan.findMany();
      for (const loan of loans) {
        const rate = Number(loan.interestRateAnnual);
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(0.30);
      }

      const accounts = await prisma.account.findMany({
        where: { interestRate: { not: null } },
      });
      for (const account of accounts) {
        const rate = Number(account.interestRate);
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(0.30);
      }
    });
  });

  describe('LVR Bounds', () => {
    it('should have LVR between 0% and 110%', async () => {
      const loans = await prisma.loan.findMany({
        where: { propertyId: { not: null } },
        include: { property: true },
      });

      for (const loan of loans) {
        if (loan.property && Number(loan.property.currentValue) > 0) {
          const lvr = Number(loan.principal) / Number(loan.property.currentValue);
          expect(lvr).toBeGreaterThanOrEqual(0);
          expect(lvr).toBeLessThanOrEqual(1.10); // Allow slightly over 100% for underwater
        }
      }
    });
  });

  describe('Depreciation Rate Bounds', () => {
    it('should have depreciation rates between 0% and 100%', async () => {
      const schedules = await prisma.depreciationSchedule.findMany();
      for (const schedule of schedules) {
        const rate = Number(schedule.rate);
        expect(rate).toBeGreaterThan(0);
        expect(rate).toBeLessThanOrEqual(1.0);
      }
    });

    it('should have DIV43 rate of 2.5%', async () => {
      const div43Schedules = await prisma.depreciationSchedule.findMany({
        where: { category: 'DIV43' },
      });
      for (const schedule of div43Schedules) {
        expect(Number(schedule.rate)).toBe(0.025);
      }
    });
  });

  describe('Investment Transaction Consistency', () => {
    it('should have positive prices and units for BUY transactions', async () => {
      const buys = await prisma.investmentTransaction.findMany({
        where: { type: 'BUY' },
      });

      for (const buy of buys) {
        expect(Number(buy.price)).toBeGreaterThan(0);
        expect(Number(buy.units)).toBeGreaterThan(0);
      }
    });

    it('should have matching units between holdings and transactions', async () => {
      const holdings = await prisma.investmentHolding.findMany({
        include: {
          transactions: true,
        },
      });

      for (const holding of holdings) {
        const buyUnits = holding.transactions
          .filter((t) => t.type === 'BUY')
          .reduce((sum, t) => sum + Number(t.units), 0);
        const sellUnits = holding.transactions
          .filter((t) => t.type === 'SELL')
          .reduce((sum, t) => sum + Number(t.units), 0);
        const netUnits = buyUnits - sellUnits;

        expect(Number(holding.units)).toBe(netUnits);
      }
    });
  });

  describe('Expense Category Consistency', () => {
    it('should have tax deductible flag consistent with category', async () => {
      const propertyExpenses = await prisma.expense.findMany({
        where: {
          sourceType: 'PROPERTY',
          property: { type: 'INVESTMENT' },
        },
        include: { property: true },
      });

      // Investment property expenses should be tax deductible
      for (const expense of propertyExpenses) {
        expect(expense.isTaxDeductible).toBe(true);
      }

      // Home loan interest should NOT be tax deductible
      const homeLoanInterest = await prisma.expense.findMany({
        where: {
          category: 'LOAN_INTEREST',
          loan: { type: 'HOME' },
        },
        include: { loan: true },
      });

      for (const expense of homeLoanInterest) {
        expect(expense.isTaxDeductible).toBe(false);
      }
    });
  });
});

// =============================================================================
// BUSINESS RULE CHECKS
// =============================================================================

describe('Business Rule Checks', () => {
  describe('Offset Account Rules', () => {
    it('should only link offset to one loan', async () => {
      const offsets = await prisma.account.findMany({
        where: { type: 'OFFSET' },
      });

      for (const offset of offsets) {
        const linkedLoans = await prisma.loan.findMany({
          where: { offsetAccountId: offset.id },
        });
        expect(linkedLoans.length).toBeLessThanOrEqual(1);
      }
    });

    it('should have non-negative balance in offset', async () => {
      const offsets = await prisma.account.findMany({
        where: { type: 'OFFSET' },
      });

      for (const offset of offsets) {
        expect(Number(offset.currentBalance)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Fixed Loan Rules', () => {
    it('should have expiry date for fixed loans', async () => {
      const fixedLoans = await prisma.loan.findMany({
        where: { rateType: 'FIXED' },
      });

      for (const loan of fixedLoans) {
        expect(loan.fixedExpiry).not.toBeNull();
        expect(new Date(loan.fixedExpiry!).getTime()).toBeGreaterThan(Date.now());
      }
    });
  });

  describe('Property Type Rules', () => {
    it('should only have depreciation on investment properties', async () => {
      const schedules = await prisma.depreciationSchedule.findMany({
        include: { property: true },
      });

      for (const schedule of schedules) {
        expect(schedule.property.type).toBe('INVESTMENT');
      }
    });

    it('should only have rental income on investment properties', async () => {
      const rentals = await prisma.income.findMany({
        where: { type: 'RENTAL' },
        include: { property: true },
      });

      for (const rental of rentals) {
        expect(rental.property).not.toBeNull();
        expect(rental.property!.type).toBe('INVESTMENT');
      }
    });
  });

  describe('Investment Holding Rules', () => {
    it('should have franking only for Australian holdings', async () => {
      const holdings = await prisma.investmentHolding.findMany();

      for (const holding of holdings) {
        if (holding.ticker === 'VGS' || holding.type === 'CRYPTO') {
          // International or crypto should have 0 franking
          expect(Number(holding.frankingPercentage)).toBe(0);
        }
        // VAS (Australian) can have franking
        if (holding.ticker === 'VAS') {
          expect(Number(holding.frankingPercentage)).toBeGreaterThan(0);
        }
      }
    });
  });
});

// =============================================================================
// DATA QUALITY CHECKS
// =============================================================================

describe('Data Quality Checks', () => {
  describe('No Orphaned Records', () => {
    it('should not have expenses without a user', async () => {
      const orphanedExpenses = await prisma.expense.findMany({
        where: { userId: null as any },
      });
      expect(orphanedExpenses.length).toBe(0);
    });

    it('should not have incomes without a user', async () => {
      const orphanedIncomes = await prisma.income.findMany({
        where: { userId: null as any },
      });
      expect(orphanedIncomes.length).toBe(0);
    });
  });

  describe('Required Fields Present', () => {
    it('should have names for all entities', async () => {
      const properties = await prisma.property.findMany();
      for (const p of properties) {
        expect(p.name).toBeTruthy();
      }

      const loans = await prisma.loan.findMany();
      for (const l of loans) {
        expect(l.name).toBeTruthy();
      }

      const accounts = await prisma.account.findMany();
      for (const a of accounts) {
        expect(a.name).toBeTruthy();
      }
    });

    it('should have positive amounts for income and expenses', async () => {
      const incomes = await prisma.income.findMany();
      for (const i of incomes) {
        expect(Number(i.amount)).toBeGreaterThan(0);
      }

      const expenses = await prisma.expense.findMany();
      for (const e of expenses) {
        expect(Number(e.amount)).toBeGreaterThan(0);
      }
    });
  });

  describe('Date Sanity', () => {
    it('should have purchase dates before valuation dates', async () => {
      const properties = await prisma.property.findMany({
        where: {
          valuationDate: { not: null },
        },
      });

      for (const p of properties) {
        if (p.valuationDate) {
          expect(new Date(p.purchaseDate).getTime()).toBeLessThanOrEqual(
            new Date(p.valuationDate).getTime()
          );
        }
      }
    });

    it('should have depreciation start dates matching property purchase', async () => {
      const schedules = await prisma.depreciationSchedule.findMany({
        include: { property: true },
      });

      for (const s of schedules) {
        // Depreciation start should be on or after property purchase
        expect(new Date(s.startDate).getTime()).toBeGreaterThanOrEqual(
          new Date(s.property.purchaseDate).getTime()
        );
      }
    });
  });
});

// Cleanup
afterAll(async () => {
  await prisma.$disconnect();
});
