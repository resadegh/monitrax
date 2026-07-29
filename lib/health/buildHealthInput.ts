/**
 * Canonical builder for the Financial Health Engine input.
 *
 * SSOT (CLAUDE.md §12.2 / §12.2.1): this is the ONE place that assembles a
 * `FinancialHealthInput` from the database. It was previously duplicated verbatim
 * in `app/api/financial-health/route.ts` and `app/api/dashboard/insights/route.ts`
 * (MON-030 stage 1) — two copies of the same builder feeding two health surfaces.
 * The copies were verified line-by-line equivalent before consolidation (the only
 * difference — one copy's `totalEntities` also counted empty investment ACCOUNTS —
 * feeds only `consistencyScore`'s `totalEntities > 0` gate, which is identical in
 * every case, so this is a pure refactor with NO behaviour change).
 *
 * NOTE (not this PR's scope): investments are valued at `units × averagePrice`
 * (cost basis, "Simplified"), NOT the canonical market value the net-worth engine
 * uses. That is a separate correctness question (a future MON), deliberately
 * preserved verbatim here so the extraction changes nothing.
 *
 * This is a data-assembly SERVICE (it fetches), kept separate from the pure
 * scoring engine in `aggregateEngine.ts` (§6.4 — engines stay pure).
 */
import prisma from '@/lib/db';
import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';
import { toMonthly } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import type {
  FinancialHealthInput,
  PropertyData,
  LoanData,
  AccountData,
  InvestmentData,
  IncomeData,
  ExpenseData,
  InsightData,
} from './types';

/** Net (after-PAYG) monthly amount for SALARY income; gross monthly otherwise. */
function getNetMonthlyIncome(incomeItem: { amount: number; frequency: string; type: string }): number {
  if (incomeItem.type === 'SALARY') {
    const takeHome = calculateTakeHomePay(
      incomeItem.amount,
      incomeItem.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL',
    );
    return toMonthly(takeHome.netAmount, incomeItem.frequency as Frequency);
  }
  // Non-salary income: gross amount (tax calculated at year end).
  return toMonthly(incomeItem.amount, incomeItem.frequency as Frequency);
}

/** Assemble the canonical `FinancialHealthInput` for a user from the database. */
export async function buildHealthInput(userId: string): Promise<FinancialHealthInput> {
  const [properties, loans, accounts, income, expenses, holdings, scoreSnapshots] = await Promise.all([
    prisma.property.findMany({ where: { userId }, include: { loans: true, income: true, expenses: true } }),
    prisma.loan.findMany({ where: { userId }, include: { property: true, offsetAccount: true } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    prisma.investmentHolding.findMany({ where: { investmentAccount: { userId } } }),
    // MON-134: stored monthly score snapshots — the ONLY trend input (D15).
    // Last 24 months, oldest first; the engine stays pure and never fetches.
    prisma.healthScoreSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotDate: 'asc' },
      take: 24,
      select: { snapshotDate: true, score: true, formulaVersion: true },
    }),
  ]);

  // Totals (investments at cost basis — see file header note).
  const totalPropertyValue = properties.reduce((sum: number, p: any) => sum + Number(p.currentValue), 0);
  const totalAccountBalances = accounts.reduce((sum: number, a: any) => sum + Number(a.currentBalance), 0);
  const totalInvestmentValue = holdings.reduce((sum: number, h: any) => sum + Number(h.units) * Number(h.averagePrice), 0);
  const totalAssets = totalPropertyValue + totalAccountBalances + totalInvestmentValue;
  const totalLiabilities = loans.reduce((sum: number, l: any) => sum + Number(l.principal), 0);
  const netWorth = totalAssets - totalLiabilities;

  const propertyData: PropertyData[] = properties.map((p: any) => {
    const propertyLoans = loans.filter((l: any) => l.propertyId === p.id);
    const debt = propertyLoans.reduce((sum: number, l: any) => sum + Number(l.principal), 0);
    const propertyIncome = income.filter((i: any) => i.propertyId === p.id);
    const propertyExpenses = expenses.filter((e: any) => e.propertyId === p.id);
    const monthlyIncome = propertyIncome.reduce(
      (sum: number, i: any) => sum + toMonthly(Number(i.amount), i.frequency as Frequency),
      0,
    );
    const monthlyExpenses = propertyExpenses.reduce(
      (sum: number, e: any) => sum + toMonthly(Number(e.amount), e.frequency as Frequency),
      0,
    );
    return {
      id: p.id,
      name: p.name,
      type: p.type as 'HOME' | 'INVESTMENT',
      currentValue: Number(p.currentValue),
      purchasePrice: Number(p.purchasePrice),
      debt,
      monthlyIncome,
      monthlyExpenses,
    };
  });

  const loanData: LoanData[] = loans.map((l: any) => {
    const monthlyInterest = (Number(l.principal) * Number(l.interestRateAnnual)) / 12;
    const monthlyRepayment = l.isInterestOnly ? monthlyInterest : Number(l.minRepayment) || monthlyInterest * 1.2;
    return {
      id: l.id,
      name: l.name,
      type: l.type as 'HOME' | 'INVESTMENT',
      principal: Number(l.principal),
      interestRate: Number(l.interestRateAnnual),
      isInterestOnly: l.isInterestOnly,
      monthlyRepayment,
      propertyId: l.propertyId || undefined,
    };
  });

  const accountData: AccountData[] = accounts.map((a: any) => ({
    id: a.id,
    name: a.name,
    type: a.type as 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD',
    balance: Number(a.currentBalance),
  }));

  const investmentData: InvestmentData[] = holdings.map((h: any) => ({
    id: h.id,
    ticker: h.ticker,
    type: h.type as 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO',
    value: Number(h.units) * Number(h.averagePrice),
    costBase: Number(h.units) * Number(h.averagePrice), // Simplified — see header note.
  }));

  const incomeData: IncomeData[] = income.map((i: any) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    monthlyAmount: getNetMonthlyIncome({ amount: Number(i.amount), frequency: i.frequency, type: i.type }),
    isTaxable: i.isTaxable,
  }));

  const expenseData: ExpenseData[] = expenses.map((e: any) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    monthlyAmount: toMonthly(Number(e.amount), e.frequency as Frequency),
    isEssential: e.isEssential,
  }));

  const insights: InsightData[] = [];

  const orphanedLoans = loans.filter((l: any) => !l.propertyId);
  const rentalIncomeWithoutProperty = income.filter(
    (i: any) => (i.type === 'RENT' || i.type === 'RENTAL') && !i.propertyId,
  );
  const orphanCount = orphanedLoans.length + rentalIncomeWithoutProperty.length;
  const totalEntities =
    properties.length + loans.length + income.length + expenses.length + accounts.length + holdings.length;
  const consistencyScore = totalEntities > 0 ? Math.max(0, 100 - orphanCount * 10) : 100;

  return {
    userId,
    portfolioSnapshot: {
      netWorth,
      totalAssets,
      totalLiabilities,
      properties: propertyData,
      loans: loanData,
      accounts: accountData,
      investments: investmentData,
      income: incomeData,
      expenses: expenseData,
    },
    insights,
    linkageHealth: {
      orphans: [
        ...orphanedLoans.map((l: any) => `loan:${l.id}`),
        ...rentalIncomeWithoutProperty.map((i: any) => `income:${i.id}`),
      ],
      missingLinks: [],
      consistencyScore,
    },
    healthScoreHistory: scoreSnapshots,
  };
}
