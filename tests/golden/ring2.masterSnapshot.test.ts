/**
 * NEOAUDIT RING 2 — Golden Household end-to-end through the REAL master service
 * (CLAUDE.md Part 23 Ring 2; NEOAUDIT.md §8 step 3).
 *
 * What this proves that Ring 0 (engine fixtures) and Ring 1 (wiring gates)
 * cannot: the full fetch → map → engine → snapshot ASSEMBLY path produces the
 * exact hand-computed numbers on a known dataset. The MON-028 class — a select
 * that silently drops a field, a mapping that feeds an engine partial inputs —
 * lives between the engines and the wires, and only an end-to-end run on known
 * data catches it.
 *
 * Mechanics: `vi.mock('@/lib/db')` serves the golden rows (shaped exactly like
 * fetchAllUserData's selects) through a Proxy that THROWS on any model the
 * golden DB doesn't serve — so a new query in the service fails this test
 * loudly instead of silently returning undefined.
 *
 * Includes NEGATIVE CONTROLS: a harness that can't fail is decoration, so we
 * prove the parity check catches a dropped-loan join and the Ring-3 report
 * catches a zeroed-liabilities snapshot.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { GOLDEN_DB } = await import('./goldenHousehold');
  const models = GOLDEN_DB as Record<string, unknown[]>;
  const mockDb = new Proxy(
    {},
    {
      get(_target, model: string) {
        // Vitest/Node may probe promise-like props on the proxy — ignore them.
        if (model === 'then' || model === 'catch' || typeof model === 'symbol') return undefined;
        if (!(model in models)) {
          throw new Error(
            `[Ring2 golden] master service queried prisma.${model} — not served by the golden DB. Extend tests/golden/goldenHousehold.ts.`,
          );
        }
        return {
          findMany: async () => structuredClone(models[model]),
          findUnique: async () => null,
          findFirst: async () => null,
        };
      },
    },
  );
  return { default: mockDb, prisma: mockDb };
});

import { getMasterFinancialSnapshot, type MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';
import { computeSelfAuditReport } from '@/lib/verification/selfAuditInvariants';
import { GOLDEN_DB, EXPECTED, GOLDEN_USER_ID } from './goldenHousehold';

let snapshot: MasterFinancialSnapshot;

beforeAll(async () => {
  snapshot = await getMasterFinancialSnapshot(GOLDEN_USER_ID);
});

describe('Ring 2: net worth assembly matches the hand-computed manifest', () => {
  it('asset components + total', () => {
    expect(snapshot.netWorth.assets.properties).toBeCloseTo(EXPECTED.assets.properties, 2);
    expect(snapshot.netWorth.assets.accounts).toBeCloseTo(EXPECTED.assets.accounts, 2);
    expect(snapshot.netWorth.assets.investments).toBeCloseTo(EXPECTED.assets.investments, 2);
    expect(snapshot.netWorth.assets.superannuation).toBeCloseTo(EXPECTED.assets.superannuation, 2); // SMSF excluded
    expect(snapshot.netWorth.assets.personalAssets).toBeCloseTo(EXPECTED.assets.personalAssets, 2); // SOLD excluded
    expect(snapshot.netWorth.assets.total).toBeCloseTo(EXPECTED.assets.total, 2);
  });

  it('liability classification + total', () => {
    expect(snapshot.netWorth.liabilities.mortgages).toBeCloseTo(EXPECTED.liabilities.mortgages, 2);
    expect(snapshot.netWorth.liabilities.personalLoans).toBeCloseTo(EXPECTED.liabilities.personalLoans, 2);
    expect(snapshot.netWorth.liabilities.creditCards).toBeCloseTo(EXPECTED.liabilities.creditCards, 2);
    expect(snapshot.netWorth.liabilities.total).toBeCloseTo(EXPECTED.liabilities.total, 2);
  });

  it('net worth + property-equity breakdown', () => {
    expect(snapshot.netWorth.netWorth).toBeCloseTo(EXPECTED.netWorth, 2);
    expect(snapshot.netWorth.breakdown.propertyEquity).toBeCloseTo(EXPECTED.propertyEquity, 2);
  });

  it('quickMetrics mirrors agree (the I2 identities on golden data)', () => {
    expect(snapshot.quickMetrics.totalAssets).toBeCloseTo(EXPECTED.assets.total, 2);
    expect(snapshot.quickMetrics.totalLiabilities).toBeCloseTo(EXPECTED.liabilities.total, 2);
    expect(snapshot.quickMetrics.netWorthValue).toBeCloseTo(EXPECTED.netWorth, 2);
    expect(snapshot.quickMetrics.liquidCash).toBeCloseTo(EXPECTED.liquidCash, 2);
  });
});

describe('Ring 2: cashflow + expenses + emergency fund on the declared basis', () => {
  it('declared cashflow block', () => {
    expect(snapshot.cashflow.monthlyNetIncome).toBeCloseTo(EXPECTED.cashflow.monthlyNetIncome, 2);
    expect(snapshot.cashflow.monthlyExpenses).toBeCloseTo(EXPECTED.cashflow.monthlyExpenses, 2);
    expect(snapshot.cashflow.monthlyLoanRepayments).toBeCloseTo(EXPECTED.cashflow.monthlyLoanRepayments, 2);
    expect(snapshot.cashflow.monthlyCashflow).toBeCloseTo(EXPECTED.cashflow.monthlyCashflow, 2);
    expect(snapshot.cashflow.savingsRate).toBeCloseTo(EXPECTED.cashflow.savingsRate, 2);
  });

  it('expense breakdown additivity slices', () => {
    expect(snapshot.expenses.monthly.all.total).toBeCloseTo(EXPECTED.expensesMonthly.total, 2);
    expect(snapshot.expenses.monthly.essential.total).toBeCloseTo(EXPECTED.expensesMonthly.essential, 2);
    expect(snapshot.expenses.monthly.discretionary.total).toBeCloseTo(EXPECTED.expensesMonthly.discretionary, 2);
  });

  it('rental dedup (MON-009) pools the weekly rent into the income total once', () => {
    expect(snapshot.income.monthly.all.netTotal).toBeCloseTo(EXPECTED.cashflow.monthlyNetIncome, 2);
    expect(snapshot.quickMetrics.monthlyIncome).toBeCloseTo(EXPECTED.cashflow.monthlyNetIncome, 2);
  });

  it('emergency fund (declared burn, 6-month target)', () => {
    expect(snapshot.emergencyFund.targetMonths).toBe(EXPECTED.emergencyFund.targetMonths);
    expect(snapshot.emergencyFund.monthlyExpenses).toBeCloseTo(EXPECTED.emergencyFund.monthlyExpenses, 2);
    expect(snapshot.emergencyFund.monthsCovered).toBeCloseTo(EXPECTED.emergencyFund.monthsCovered, 4);
    expect(snapshot.emergencyFund.gap).toBeCloseTo(EXPECTED.emergencyFund.gap, 2);
  });

  it('declared basis: no actual data, Money-Story derivations exact', () => {
    expect(snapshot.quickMetrics.hasActualData).toBe(false);
    expect(snapshot.quickMetrics.keptAfterEssentials).toBeCloseTo(EXPECTED.keptAfterEssentials, 2);
    expect(snapshot.counts).toEqual(EXPECTED.counts);
  });
});

describe('Ring 2: per-property metrics through the real assembly', () => {
  it('P1 equity / LVR / yield / rent / cashflow', () => {
    const p = snapshot.properties[0];
    expect(snapshot.properties).toHaveLength(1);
    expect(p.loanBalance).toBeCloseTo(EXPECTED.property.loanBalance, 2);
    expect(p.equity).toBeCloseTo(EXPECTED.property.equity, 2);
    expect(p.lvr).toBeCloseTo(EXPECTED.property.lvr, 4);
    expect(p.annualRentalIncome).toBeCloseTo(EXPECTED.property.annualRentalIncome, 2);
    expect(p.rentalYield).toBeCloseTo(EXPECTED.property.rentalYield, 4);
    expect(p.monthlyCashflow).toBeCloseTo(EXPECTED.property.monthlyCashflow, 2);
  });

  it('portfolio totals tie to the single property', () => {
    expect(snapshot.propertyPortfolioValue).toBeCloseTo(EXPECTED.portfolio.value, 2);
    expect(snapshot.propertyPortfolioEquity).toBeCloseTo(EXPECTED.portfolio.equity, 2);
  });

  it('INPUT-PARITY (the MON-028 class): the engine run directly on the golden inputs equals the snapshot', () => {
    // If the service's fetch/mapping dropped a field (a loan, a frequency, a
    // linked id), the snapshot would diverge from this direct engine run.
    const direct = computePropertyCashflow({
      income: GOLDEN_DB.income.filter((i) => i.propertyId === 'p-avalon').map((i) => ({ id: i.id, type: i.type, amount: i.amount, frequency: i.frequency })),
      expenses: [],
      loans: GOLDEN_DB.loan.filter((l) => l.propertyId === 'p-avalon').map((l) => ({ id: l.id, principal: l.principal, interestRateAnnual: l.interestRateAnnual, minRepayment: l.minRepayment, repaymentFrequency: l.repaymentFrequency })),
    });
    const p = snapshot.properties[0];
    expect(p.annualRentalIncome).toBeCloseTo(direct.annualRent, 2);
    expect(p.monthlyCashflow).toBeCloseTo(direct.monthlyCashflow, 2);
    expect(p.monthlyExpenses).toBeCloseTo(direct.monthlyExpenses, 2);
  });

  it('NEGATIVE CONTROL: dropping the loan from the engine inputs breaks parity (the check can fail)', () => {
    const withoutLoan = computePropertyCashflow({
      income: GOLDEN_DB.income.filter((i) => i.propertyId === 'p-avalon').map((i) => ({ id: i.id, type: i.type, amount: i.amount, frequency: i.frequency })),
      expenses: [],
      loans: [], // simulate the dropped join / dropped select field
    });
    expect(Math.abs(withoutLoan.monthlyCashflow - snapshot.properties[0].monthlyCashflow)).toBeGreaterThan(1);
  });
});

describe('Ring 2 ↔ Ring 3 tie: the self-audit report passes on the golden snapshot', () => {
  it('ALL PASS, zero advisories', () => {
    const report = computeSelfAuditReport(snapshot, 'golden@household.test');
    expect(report.pass).toBe(true);
    expect(report.failureCount).toBe(0);
    expect(report.advisories).toEqual([]);
    expect(report.info.cashflowBasis).toBe('declared');
    expect(report.info.canonicalMonthlyNet).toBeCloseTo(EXPECTED.cashflow.monthlyCashflow, 0);
  });

  it('accessibility buckets tie out exactly as hand-computed', () => {
    const report = computeSelfAuditReport(snapshot, 'golden@household.test');
    const i3 = report.invariants.find((i) => i.id === 'I3');
    expect(i3?.pass).toBe(true);
    expect(i3?.lhs).toBeCloseTo(EXPECTED.buckets.liquidToday + EXPECTED.buckets.accessible + EXPECTED.buckets.lockedLongTerm, 2);
    expect(i3?.rhs).toBeCloseTo(EXPECTED.netWorth, 2);
  });

  it('NEGATIVE CONTROL: a tampered snapshot (zeroed liabilities) FAILS the report', () => {
    const tampered = structuredClone(snapshot);
    tampered.netWorth.liabilities.total = 0; // the "disappearing liabilities" fear, simulated
    const report = computeSelfAuditReport(tampered, 'tampered@household.test');
    expect(report.pass).toBe(false);
    expect(report.invariants.find((i) => i.id === 'I1')?.pass).toBe(false);
  });
});
