import { describe, it, expect } from 'vitest';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { assembleFactPack, type FactPack } from '@/lib/neobrain/factPack';

/**
 * Neobrain Phase A — the Personal Financial Index (FactPack) contract.
 * Pins the grounding rules: value/zero/absent states, count-gating (no loans →
 * "absent", not "$0"), asOf/staleness propagation, scope minimisation, and the
 * app reference block. Pure function → no DB.
 */

// Minimal snapshot fixture — only the fields the assembler reads.
function makeSnapshot(over: Partial<{
  loans: number;
  monthlyCashflow: number;
  totalLiabilities: number;
  stale: boolean;
  hasActualData: boolean;
}> = {}): MasterFinancialSnapshot {
  const {
    loans = 2,
    monthlyCashflow = 1500,
    totalLiabilities = 450000,
    stale = false,
    hasActualData = true,
  } = over;
  return {
    userId: 'user-1',
    calculatedAt: new Date('2026-06-28T00:00:00.000Z'),
    counts: { expenses: 5, income: 1, accounts: 3, loans, properties: 1, investments: 0 },
    quickMetrics: {
      monthlyIncome: 8000,
      monthlyExpenses: 6500,
      monthlyCashflow,
      monthlyLoanRepayments: 2200,
      totalAssets: 900000,
      totalLiabilities,
      netWorthValue: 450000,
      savingsRate: 18.75,
      liquidCash: 25000,
      actualNetCashflow: 1320,
      hasActualData,
    },
    emergencyFund: { liquidCash: 25000, monthlyExpenses: 6500, monthsCovered: 3.8, targetMonths: 6, gap: 14000 },
    tax: { estimatedTaxableIncome: 96000, estimatedTaxPayable: 21000, effectiveTaxRate: 21.9, marginalTaxRate: 32.5, totalDeductions: 4000, paygWithheld: 20000, estimatedRefundOrOwing: -1000 },
    staleness: { anyStale: stale },
  } as unknown as MasterFinancialSnapshot;
}

const find = (pack: FactPack, key: string) => pack.facts.find((f) => f.key === key);

describe('assembleFactPack — Personal Financial Index contract', () => {
  it('renders a present non-zero number as state "value" with its snapshot-path ref', () => {
    const f = find(assembleFactPack(makeSnapshot()), 'cashflow.monthlyCashflow')!;
    expect(f.state).toBe('value');
    expect(f.value).toBe(1500);
    expect(f.unit).toBe('AUD');
    expect(f.ref).toBe('quickMetrics.monthlyCashflow'); // SSOT: CFO resolveSnapshotPath convention
  });

  it('distinguishes a genuine zero from absent (zero net flow → "zero", value kept)', () => {
    const f = find(assembleFactPack(makeSnapshot({ monthlyCashflow: 0 })), 'cashflow.monthlyCashflow')!;
    expect(f.state).toBe('zero');
    expect(f.value).toBe(0);
  });

  it('count-gates debt — no loans → "absent" (not connected), never "$0"', () => {
    const pack = assembleFactPack(makeSnapshot({ loans: 0, totalLiabilities: 0 }));
    const debt = find(pack, 'debt.totalLiabilities')!;
    expect(debt.state).toBe('absent');
    expect(debt.value).toBeNull();
  });

  it('keeps debt as a real value when loans exist', () => {
    const debt = find(assembleFactPack(makeSnapshot({ loans: 2 })), 'debt.totalLiabilities')!;
    expect(debt.state).toBe('value');
    expect(debt.value).toBe(450000);
  });

  it('marks actual cash flow absent when no transaction data exists (§19.1 — never present declared as actual)', () => {
    const f = find(assembleFactPack(makeSnapshot({ hasActualData: false })), 'cashflow.actualNetCashflow')!;
    expect(f.state).toBe('absent');
    expect(f.value).toBeNull();
  });

  it('propagates asOf + staleness from the snapshot', () => {
    const pack = assembleFactPack(makeSnapshot({ stale: true }));
    expect(pack.snapshotAsOf).toBe('2026-06-28T00:00:00.000Z');
    expect(pack.anyStale).toBe(true);
    expect(find(pack, 'netWorth.netWorth')!.stale).toBe(true);
    expect(find(pack, 'netWorth.netWorth')!.asOf).toBe('2026-06-28T00:00:00.000Z');
  });

  it('scopes the pack — only requested slices are assembled (minimal payload)', () => {
    const pack = assembleFactPack(makeSnapshot(), { scopes: ['cashflow'] });
    expect(find(pack, 'cashflow.monthlyCashflow')).toBeTruthy();
    expect(find(pack, 'tax.taxPayable')).toBeUndefined();
    expect(find(pack, 'debt.totalLiabilities')).toBeUndefined();
  });

  it('includes the app reference block (the second dataset) with no asOf/stale', () => {
    const pack = assembleFactPack(makeSnapshot());
    expect(pack.reference.taxYear).toMatch(/^\d{4}-\d{2}$/);
    expect(pack.reference.validCategories.length).toBeGreaterThan(0);
    const appFact = find(pack, 'app.categoryCount')!;
    expect(appFact.source).toBe('app');
    expect(appFact.asOf).toBeNull();
    expect(appFact.stale).toBe(false);
  });

  it('never emits a number for an absent fact (the anti-hallucination invariant)', () => {
    const pack = assembleFactPack(makeSnapshot({ loans: 0, totalLiabilities: 0, hasActualData: false }));
    for (const f of pack.facts) {
      if (f.state === 'absent') expect(f.value).toBeNull();
      if (f.value !== null && f.unit !== 'flag' && f.unit !== 'count') expect(f.state).not.toBe('absent');
    }
  });
});
