/**
 * Canonical Cashflow-Forecasting-Engine (CFE) input builder — the ONE source
 * (CLAUDE.md §12.2.1) for assembling `CFEInput` from a user's data.
 *
 * Before MON-027 this assembly was copy-pasted in `app/api/cashflow/route.ts` and
 * `app/api/cashflow/stress-test/route.ts`, and the copies had DRIFTED: the
 * stress-test copy counted internal transfers as cashflow and used PRE-tax income
 * (a raw frequency normaliser), while the cashflow copy excluded transfers and used
 * AFTER-tax income (`normalizeIncomeStream`). Two builders → the stress-test
 * forecast ran on a different, wrong basis than the main cashflow forecast. This
 * is the single builder both routes now use.
 *
 * Correct basis (§19.1): transfers excluded (they are internal account-to-account
 * moves, not cashflow) and income tax-normalised to AFTER-tax (a cash-balance
 * forecast must project the money that actually lands, net of PAYG).
 *
 * @see lib/cashflow/forecasting.ts (generateForecast — consumes this input)
 */

import prisma from '@/lib/db';
// MON-131 T1-B: per-stream after-tax income reads the ONE banked-income
// producer's per-row attribution (D17) — `normalizeIncomeStream` (an
// estimated-tax re-derivation, the salary-take-home duplicate class) is
// deleted with `lib/cashflow/incomeNormalizer.ts`.
import {
  assembleBankedIncomeForUser,
  bankedMonthlyPerRow,
} from '@/lib/income/banked/assembly';
import type {
  CFEInput,
  AccountBalance,
  TransactionRecord,
  RecurringPaymentData,
  IncomeStream,
  LoanSchedule,
} from './types';

/**
 * Assemble the canonical `CFEInput` for a user (after-tax income, transfers
 * excluded). The ONE builder — do not re-implement in a route.
 */
export async function buildCFEInput(
  userId: string,
  forecastDays: number = 90,
): Promise<CFEInput> {
  const [accounts, transactions, recurringPayments, assembledBanked, loans] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId },
        include: { linkedLoan: true },
      }),
      prisma.unifiedTransaction.findMany({
        where: {
          userId,
          date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // last 90 days
          isTransfer: { not: true }, // §19.1 — transfers are not cashflow
        },
        orderBy: { date: 'desc' },
      }),
      prisma.recurringPayment.findMany({ where: { userId, isActive: true } }),
      assembleBankedIncomeForUser(userId),
      prisma.loan.findMany({ where: { userId }, include: { offsetAccount: true } }),
    ]);

  const income = assembledBanked.raw.income;
  const perRowBankedMonthly = bankedMonthlyPerRow(assembledBanked.banked, income);

  const accountBalances: AccountBalance[] = accounts.map((a: any) => ({
    accountId: a.id,
    accountName: a.name,
    accountType: a.type,
    currentBalance: Number(a.currentBalance),
    lastUpdated: a.updatedAt,
    linkedLoanId: a.linkedLoan?.id,
  }));

  const transactionRecords: TransactionRecord[] = transactions.map((t: any) => ({
    id: t.id,
    accountId: t.accountId,
    date: t.date,
    amount: Math.abs(Number(t.amount)),
    direction: t.direction,
    categoryLevel1: t.categoryLevel1,
    categoryLevel2: t.categoryLevel2,
    merchantStandardised: t.merchantStandardised,
    isRecurring: t.isRecurring,
  }));

  const recurringData: RecurringPaymentData[] = recurringPayments.map((rp: any) => ({
    id: rp.id,
    merchantStandardised: rp.merchantStandardised,
    accountId: rp.accountId,
    pattern: rp.pattern,
    expectedAmount: Number(rp.expectedAmount),
    nextExpected: rp.nextExpected,
    lastOccurrence: rp.lastOccurrence,
    isActive: rp.isActive,
  }));

  // BANKED income streams (D17) — the correct basis for a cash forecast:
  // the money that actually lands, from the ONE producer's per-row values.
  const incomeStreams: IncomeStream[] = income.map((i: any) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    monthlyAmount: perRowBankedMonthly.get(i.id) ?? 0,
    frequency: i.frequency,
    volatility: 0.1,
    salaryType: i.salaryType || null,
    grossAmount: i.grossAmount != null ? Number(i.grossAmount) : null,
    netAmount: i.netAmount != null ? Number(i.netAmount) : null,
    paygWithholding: i.paygWithholding != null ? Number(i.paygWithholding) : null,
  }));

  const loanSchedules: LoanSchedule[] = loans.map((l: any) => ({
    loanId: l.id,
    loanName: l.name,
    principal: Number(l.principal),
    interestRate: Number(l.interestRateAnnual),
    monthlyRepayment: Number(l.minRepayment),
    repaymentDate: 15,
    isInterestOnly: l.isInterestOnly,
    offsetAccountId: l.offsetAccountId,
    offsetBalance: l.offsetAccount ? Number(l.offsetAccount.currentBalance) : undefined,
  }));

  return {
    userId,
    accounts: accountBalances,
    transactions: transactionRecords,
    recurringPayments: recurringData,
    incomeStreams,
    loanSchedules,
    config: { forecastDays, granularity: 'DAILY', includeConfidenceBands: true },
  };
}
