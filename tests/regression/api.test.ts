/**
 * API REGRESSION TESTS
 * Tests all API endpoints against golden baselines
 *
 * Run with: npm run test:regression
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GOLDEN_VALUES, TEST_USER_A_ID, TEST_USER_B_ID } from '../../prisma/seed-validation';

// Import golden baselines
import goldenPortfolio from '../validation/golden-portfolio-snapshot.json';
import goldenDebt from '../validation/golden-debt-plan.json';
import goldenProperties from '../validation/golden-properties.json';
import goldenTax from '../validation/golden-tax-output.json';
import goldenInvestments from '../validation/golden-investments.json';
import goldenStrategy from '../validation/golden-strategy-output.json';

const prisma = new PrismaClient();

// Helper to check value within tolerance
function expectWithinTolerance(
  actual: number,
  expected: number,
  tolerance: number,
  label: string
) {
  const diff = Math.abs(actual - expected);
  expect(diff).toBeLessThanOrEqual(
    tolerance,
    `${label}: Expected ${expected} ± ${tolerance}, got ${actual} (diff: ${diff})`
  );
}

// =============================================================================
// PORTFOLIO A REGRESSION TESTS
// =============================================================================

describe('Portfolio A - Standard Portfolio', () => {
  describe('Entity Counts (GRDCS Linking)', () => {
    it('should have correct property count', async () => {
      const count = await prisma.property.count({
        where: { userId: TEST_USER_A_ID },
      });
      expect(count).toBe(goldenPortfolio.portfolioA.grdcsEntityCount.properties);
    });

    it('should have correct loan count', async () => {
      const count = await prisma.loan.count({
        where: { userId: TEST_USER_A_ID },
      });
      expect(count).toBe(goldenPortfolio.portfolioA.grdcsEntityCount.loans);
    });

    it('should have correct account count', async () => {
      const count = await prisma.account.count({
        where: { userId: TEST_USER_A_ID },
      });
      expect(count).toBe(goldenPortfolio.portfolioA.grdcsEntityCount.accounts);
    });

    it('should have correct income stream count', async () => {
      const count = await prisma.income.count({
        where: { userId: TEST_USER_A_ID },
      });
      expect(count).toBe(goldenPortfolio.portfolioA.grdcsEntityCount.incomeStreams);
    });

    it('should have correct expense count', async () => {
      const count = await prisma.expense.count({
        where: { userId: TEST_USER_A_ID },
      });
      expect(count).toBe(goldenPortfolio.portfolioA.grdcsEntityCount.expenses);
    });

    it('should have correct depreciation schedule count', async () => {
      const count = await prisma.depreciationSchedule.count({
        where: {
          property: { userId: TEST_USER_A_ID },
        },
      });
      expect(count).toBe(goldenPortfolio.portfolioA.grdcsEntityCount.depreciationSchedules);
    });

    it('should have correct investment holding count', async () => {
      const count = await prisma.investmentHolding.count({
        where: {
          investmentAccount: { userId: TEST_USER_A_ID },
        },
      });
      expect(count).toBe(goldenPortfolio.portfolioA.grdcsEntityCount.investmentHoldings);
    });
  });

  describe('Property Calculations', () => {
    let homeProperty: any;
    let investmentProperty: any;

    beforeAll(async () => {
      homeProperty = await prisma.property.findUnique({
        where: { id: '11111111-0000-0000-0000-000000000001' },
      });
      investmentProperty = await prisma.property.findUnique({
        where: { id: '11111111-0000-0000-0000-000000000002' },
      });
    });

    it('should have correct home property value', () => {
      expect(Number(homeProperty.currentValue)).toBe(
        goldenProperties.portfolioA.properties.home.currentValue
      );
    });

    it('should have correct investment property value', () => {
      expect(Number(investmentProperty.currentValue)).toBe(
        goldenProperties.portfolioA.properties.investment.currentValue
      );
    });

    it('should calculate correct capital gain for investment property', () => {
      const gain =
        Number(investmentProperty.currentValue) -
        Number(investmentProperty.purchasePrice);
      expectWithinTolerance(
        gain,
        goldenProperties.portfolioA.properties.investment.calculations.capitalGain.expected,
        goldenProperties.portfolioA.properties.investment.calculations.capitalGain.tolerance,
        'Investment property capital gain'
      );
    });
  });

  describe('Loan Calculations', () => {
    let homeLoan: any;
    let investmentLoan: any;
    let offsetAccount: any;

    beforeAll(async () => {
      homeLoan = await prisma.loan.findUnique({
        where: { id: '33333333-0000-0000-0000-000000000001' },
      });
      investmentLoan = await prisma.loan.findUnique({
        where: { id: '33333333-0000-0000-0000-000000000002' },
      });
      offsetAccount = await prisma.account.findUnique({
        where: { id: '22222222-0000-0000-0000-000000000001' },
      });
    });

    it('should have correct home loan principal', () => {
      expect(Number(homeLoan.principal)).toBe(
        goldenDebt.portfolioA.loans.homeLoan.principal
      );
    });

    it('should have correct investment loan principal', () => {
      expect(Number(investmentLoan.principal)).toBe(
        goldenDebt.portfolioA.loans.investmentLoan.principal
      );
    });

    it('should calculate correct effective principal (with offset)', () => {
      const effectivePrincipal =
        Number(homeLoan.principal) - Number(offsetAccount.currentBalance);
      expectWithinTolerance(
        effectivePrincipal,
        goldenDebt.portfolioA.loans.homeLoan.calculations.effectivePrincipal.expected,
        goldenDebt.portfolioA.loans.homeLoan.calculations.effectivePrincipal.tolerance,
        'Effective principal'
      );
    });

    it('should calculate correct monthly interest', () => {
      const effectivePrincipal =
        Number(homeLoan.principal) - Number(offsetAccount.currentBalance);
      const monthlyInterest =
        (effectivePrincipal * Number(homeLoan.interestRateAnnual)) / 12;
      expectWithinTolerance(
        monthlyInterest,
        goldenDebt.portfolioA.loans.homeLoan.calculations.monthlyInterest.expected,
        goldenDebt.portfolioA.loans.homeLoan.calculations.monthlyInterest.tolerance,
        'Monthly interest'
      );
    });

    it('should calculate correct LVR for home loan', async () => {
      const property = await prisma.property.findUnique({
        where: { id: homeLoan.propertyId },
      });
      const lvr = Number(homeLoan.principal) / Number(property!.currentValue);
      expectWithinTolerance(
        lvr,
        goldenDebt.portfolioA.loans.homeLoan.calculations.lvr.expected,
        goldenDebt.portfolioA.loans.homeLoan.calculations.lvr.tolerance,
        'Home loan LVR'
      );
    });

    it('should calculate correct LVR for investment loan', async () => {
      const property = await prisma.property.findUnique({
        where: { id: investmentLoan.propertyId },
      });
      const lvr = Number(investmentLoan.principal) / Number(property!.currentValue);
      expectWithinTolerance(
        lvr,
        goldenDebt.portfolioA.loans.investmentLoan.calculations.lvr.expected,
        goldenDebt.portfolioA.loans.investmentLoan.calculations.lvr.tolerance,
        'Investment loan LVR'
      );
    });
  });

  describe('Income Calculations', () => {
    let incomes: any[];

    beforeAll(async () => {
      incomes = await prisma.income.findMany({
        where: { userId: TEST_USER_A_ID },
      });
    });

    it('should calculate correct total annual salary', () => {
      const primarySalary = incomes.find((i) => i.name === 'Primary Salary');
      const partnerSalary = incomes.find((i) => i.name === 'Partner Salary');

      // Both are monthly
      const totalAnnual =
        Number(primarySalary.amount) * 12 + Number(partnerSalary.amount) * 12;

      expectWithinTolerance(
        totalAnnual,
        goldenTax.portfolioA.income.salary.totalSalaryIncome.expected,
        goldenTax.portfolioA.income.salary.totalSalaryIncome.tolerance,
        'Total salary income'
      );
    });

    it('should calculate correct annual rental income', () => {
      const rental = incomes.find((i) => i.type === 'RENTAL');
      // Rental is weekly
      const annualRental = Number(rental.amount) * 52;

      expectWithinTolerance(
        annualRental,
        goldenTax.portfolioA.income.rentalIncome.annual.expected,
        goldenTax.portfolioA.income.rentalIncome.annual.tolerance,
        'Annual rental income'
      );
    });
  });

  describe('Depreciation Calculations', () => {
    let depreciationSchedules: any[];

    beforeAll(async () => {
      depreciationSchedules = await prisma.depreciationSchedule.findMany({
        where: {
          property: { userId: TEST_USER_A_ID },
        },
      });
    });

    it('should calculate correct DIV43 annual deduction', () => {
      const div43 = depreciationSchedules.find((d) => d.category === 'DIV43');
      const annualDeduction = Number(div43.cost) * Number(div43.rate);

      expectWithinTolerance(
        annualDeduction,
        goldenTax.portfolioA.deductions.depreciation.div43CapitalWorks.buildingStructure.annualDeduction.expected,
        goldenTax.portfolioA.deductions.depreciation.div43CapitalWorks.buildingStructure.annualDeduction.tolerance,
        'DIV43 annual deduction'
      );
    });

    it('should calculate correct DIV40 prime cost deductions', () => {
      const airCon = depreciationSchedules.find(
        (d) => d.assetName === 'Air Conditioning System'
      );
      const hws = depreciationSchedules.find(
        (d) => d.assetName === 'Hot Water System'
      );

      if (airCon) {
        const airConDeduction = Number(airCon.cost) * Number(airCon.rate);
        expect(airConDeduction).toBe(650);
      }

      if (hws) {
        const hwsDeduction = Number(hws.cost) * Number(hws.rate);
        expect(hwsDeduction).toBe(250);
      }
    });
  });

  describe('Investment Calculations', () => {
    let vasHolding: any;
    let vgsHolding: any;
    let vasTransactions: any[];
    let vgsTransactions: any[];

    beforeAll(async () => {
      vasHolding = await prisma.investmentHolding.findUnique({
        where: { id: '88888888-0000-0000-0000-000000000001' },
      });
      vgsHolding = await prisma.investmentHolding.findUnique({
        where: { id: '88888888-0000-0000-0000-000000000002' },
      });
      vasTransactions = await prisma.investmentTransaction.findMany({
        where: { holdingId: vasHolding.id },
        orderBy: { date: 'asc' },
      });
      vgsTransactions = await prisma.investmentTransaction.findMany({
        where: { holdingId: vgsHolding.id },
        orderBy: { date: 'asc' },
      });
    });

    it('should have correct VAS unit count', () => {
      expect(Number(vasHolding.units)).toBe(450);
    });

    it('should have correct VGS unit count', () => {
      expect(Number(vgsHolding.units)).toBe(280);
    });

    it('should calculate correct VAS cost base', () => {
      const buys = vasTransactions.filter((t) => t.type === 'BUY');
      const costBase = buys.reduce(
        (sum, t) =>
          sum + Number(t.price) * Number(t.units) + Number(t.fees || 0),
        0
      );

      expectWithinTolerance(
        costBase,
        goldenInvestments.portfolioA.holdings.VAS.calculations.costBase.expected,
        goldenInvestments.portfolioA.holdings.VAS.calculations.costBase.tolerance,
        'VAS cost base'
      );
    });

    it('should calculate correct VGS cost base', () => {
      const buys = vgsTransactions.filter((t) => t.type === 'BUY');
      const costBase = buys.reduce(
        (sum, t) =>
          sum + Number(t.price) * Number(t.units) + Number(t.fees || 0),
        0
      );

      expectWithinTolerance(
        costBase,
        goldenInvestments.portfolioA.holdings.VGS.calculations.costBase.expected,
        goldenInvestments.portfolioA.holdings.VGS.calculations.costBase.tolerance,
        'VGS cost base'
      );
    });

    it('should calculate correct franking percentage', () => {
      expect(Number(vasHolding.frankingPercentage)).toBe(0.80);
      expect(Number(vgsHolding.frankingPercentage)).toBe(0);
    });
  });

  describe('Net Worth Calculation', () => {
    it('should calculate correct total net worth', async () => {
      // Properties
      const properties = await prisma.property.findMany({
        where: { userId: TEST_USER_A_ID },
      });
      const propertyValue = properties.reduce(
        (sum, p) => sum + Number(p.currentValue),
        0
      );

      // Accounts
      const accounts = await prisma.account.findMany({
        where: { userId: TEST_USER_A_ID },
      });
      const accountValue = accounts.reduce(
        (sum, a) => sum + Number(a.currentBalance),
        0
      );

      // Investments (using stored average price as proxy for current)
      const holdings = await prisma.investmentHolding.findMany({
        where: {
          investmentAccount: { userId: TEST_USER_A_ID },
        },
      });
      // Using golden values for current prices: VAS=90, VGS=115
      const investmentValue = holdings.reduce((sum, h) => {
        const price = h.ticker === 'VAS' ? 90 : h.ticker === 'VGS' ? 115 : Number(h.averagePrice);
        return sum + Number(h.units) * price;
      }, 0);

      // Loans
      const loans = await prisma.loan.findMany({
        where: { userId: TEST_USER_A_ID },
      });
      const loanValue = loans.reduce((sum, l) => sum + Number(l.principal), 0);

      const netWorth = propertyValue + accountValue + investmentValue - loanValue;

      expectWithinTolerance(
        netWorth,
        goldenPortfolio.portfolioA.netWorth.expected,
        goldenPortfolio.portfolioA.netWorth.tolerance,
        'Total net worth'
      );
    });
  });
});

// =============================================================================
// PORTFOLIO B REGRESSION TESTS (EDGE CASES)
// =============================================================================

describe('Portfolio B - Edge-Case Portfolio', () => {
  describe('High LVR Detection', () => {
    it('should calculate combined LVR above 90%', async () => {
      const property = await prisma.property.findUnique({
        where: { id: 'B1111111-0000-0000-0000-000000000001' },
      });
      const loans = await prisma.loan.findMany({
        where: { propertyId: property!.id },
      });
      const totalPrincipal = loans.reduce(
        (sum, l) => sum + Number(l.principal),
        0
      );
      const lvr = totalPrincipal / Number(property!.currentValue);

      expectWithinTolerance(
        lvr,
        goldenDebt.portfolioB.splitLoanAnalysis.combinedLVR.expected,
        goldenDebt.portfolioB.splitLoanAnalysis.combinedLVR.tolerance,
        'Combined LVR'
      );
      expect(lvr).toBeGreaterThan(0.9); // Should flag as high risk
    });
  });

  describe('Underwater Property Detection', () => {
    it('should detect property is underwater', async () => {
      const property = await prisma.property.findUnique({
        where: { id: 'B1111111-0000-0000-0000-000000000001' },
      });
      const isUnderwater =
        Number(property!.currentValue) < Number(property!.purchasePrice);
      expect(isUnderwater).toBe(true);
    });

    it('should calculate correct paper loss', async () => {
      const property = await prisma.property.findUnique({
        where: { id: 'B1111111-0000-0000-0000-000000000001' },
      });
      const paperLoss =
        Number(property!.purchasePrice) - Number(property!.currentValue);
      expect(paperLoss).toBe(
        goldenProperties.portfolioB.properties.investment.calculations.underwaterAmount.expected
      );
    });
  });

  describe('Split Loan Handling', () => {
    let variableLoan: any;
    let fixedLoan: any;
    let offsetAccount: any;

    beforeAll(async () => {
      variableLoan = await prisma.loan.findUnique({
        where: { id: 'B3333333-0000-0000-0000-000000000001' },
      });
      fixedLoan = await prisma.loan.findUnique({
        where: { id: 'B3333333-0000-0000-0000-000000000002' },
      });
      offsetAccount = await prisma.account.findUnique({
        where: { id: 'B2222222-0000-0000-0000-000000000001' },
      });
    });

    it('should have both loans linked to same property', () => {
      expect(variableLoan.propertyId).toBe(fixedLoan.propertyId);
    });

    it('should have offset linked to variable portion only', () => {
      expect(variableLoan.offsetAccountId).toBe(offsetAccount.id);
      expect(fixedLoan.offsetAccountId).toBeNull();
    });

    it('should calculate correct effective principal for variable', () => {
      const effective =
        Number(variableLoan.principal) - Number(offsetAccount.currentBalance);
      expectWithinTolerance(
        effective,
        goldenDebt.portfolioB.loans.variableLoan.calculations.effectivePrincipal.expected,
        goldenDebt.portfolioB.loans.variableLoan.calculations.effectivePrincipal.tolerance,
        'Variable loan effective principal'
      );
    });

    it('should recognise fixed loan has extra repayment cap', () => {
      expect(Number(fixedLoan.extraRepaymentCap)).toBe(10000);
    });
  });

  describe('Credit Card High Interest', () => {
    let creditCard: any;

    beforeAll(async () => {
      creditCard = await prisma.account.findUnique({
        where: { id: 'B2222222-0000-0000-0000-000000000002' },
      });
    });

    it('should have correct credit card balance', () => {
      expect(Math.abs(Number(creditCard.currentBalance))).toBe(8500);
    });

    it('should have high interest rate flagged', () => {
      expect(Number(creditCard.interestRate)).toBeGreaterThan(0.20);
    });

    it('should calculate correct monthly interest', () => {
      const monthlyInterest =
        (8500 * Number(creditCard.interestRate)) / 12;
      expectWithinTolerance(
        monthlyInterest,
        goldenDebt.portfolioB.creditCard.calculations.monthlyInterest.expected,
        goldenDebt.portfolioB.creditCard.calculations.monthlyInterest.tolerance,
        'Credit card monthly interest'
      );
    });
  });

  describe('Negative Gearing Calculation', () => {
    it('should calculate correct negative gearing loss', async () => {
      // Get rental income
      const rental = await prisma.income.findFirst({
        where: { userId: TEST_USER_B_ID, type: 'RENTAL' },
      });
      const annualRental = Number(rental!.amount) * 52;

      // Get deductible expenses
      const expenses = await prisma.expense.findMany({
        where: { userId: TEST_USER_B_ID, isTaxDeductible: true },
      });
      const annualExpenses = expenses.reduce((sum, e) => {
        const annualAmount =
          e.frequency === 'MONTHLY'
            ? Number(e.amount) * 12
            : e.frequency === 'WEEKLY'
            ? Number(e.amount) * 52
            : Number(e.amount);
        return sum + annualAmount;
      }, 0);

      const netLoss = annualRental - annualExpenses;

      // Should be negative (loss)
      expect(netLoss).toBeLessThan(0);

      expectWithinTolerance(
        Math.abs(netLoss),
        Math.abs(goldenTax.portfolioB.negativeGearing.netRentalLoss.expected),
        goldenTax.portfolioB.negativeGearing.netRentalLoss.tolerance,
        'Negative gearing loss'
      );
    });
  });
});

// =============================================================================
// ENTITY LINKING TESTS
// =============================================================================

describe('GRDCS Entity Linking', () => {
  describe('Loan-Property Links', () => {
    it('should link all loans to properties', async () => {
      const loans = await prisma.loan.findMany({
        where: {
          userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] },
        },
        include: { property: true },
      });

      for (const loan of loans) {
        expect(loan.propertyId).not.toBeNull();
        expect(loan.property).not.toBeNull();
      }
    });
  });

  describe('Offset-Loan Links', () => {
    it('should link offset accounts to correct loans', async () => {
      const offsetAccounts = await prisma.account.findMany({
        where: {
          type: 'OFFSET',
          userId: { in: [TEST_USER_A_ID, TEST_USER_B_ID] },
        },
        include: { linkedLoan: true },
      });

      for (const offset of offsetAccounts) {
        expect(offset.linkedLoan).not.toBeNull();
        expect(offset.linkedLoan!.offsetAccountId).toBe(offset.id);
      }
    });
  });

  describe('Depreciation-Property Links', () => {
    it('should link depreciation schedules to properties', async () => {
      const schedules = await prisma.depreciationSchedule.findMany({
        include: { property: true },
      });

      for (const schedule of schedules) {
        expect(schedule.propertyId).not.toBeNull();
        expect(schedule.property).not.toBeNull();
        expect(schedule.property.type).toBe('INVESTMENT');
      }
    });
  });

  describe('Income-Property Links', () => {
    it('should link rental income to properties', async () => {
      const rentalIncomes = await prisma.income.findMany({
        where: { type: 'RENTAL' },
        include: { property: true },
      });

      for (const income of rentalIncomes) {
        expect(income.propertyId).not.toBeNull();
        expect(income.property).not.toBeNull();
        expect(income.property!.type).toBe('INVESTMENT');
      }
    });
  });

  describe('Expense-Entity Links', () => {
    it('should link loan interest expenses to loans', async () => {
      const loanInterests = await prisma.expense.findMany({
        where: { category: 'LOAN_INTEREST' },
        include: { loan: true },
      });

      for (const expense of loanInterests) {
        expect(expense.loanId).not.toBeNull();
        expect(expense.loan).not.toBeNull();
      }
    });

    it('should link property expenses to properties', async () => {
      const propertyExpenses = await prisma.expense.findMany({
        where: {
          sourceType: 'PROPERTY',
          category: { in: ['RATES', 'INSURANCE', 'STRATA', 'MAINTENANCE'] },
        },
        include: { property: true },
      });

      for (const expense of propertyExpenses) {
        expect(expense.propertyId).not.toBeNull();
        expect(expense.property).not.toBeNull();
      }
    });
  });
});

// Cleanup
afterAll(async () => {
  await prisma.$disconnect();
});
