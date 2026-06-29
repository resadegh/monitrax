import { describe, it, expect } from 'vitest';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { assembleFactPack, buildTaxRulesReference, type FactPack } from '@/lib/neobrain/factPack';
import { TAX_YEAR_2025_26 } from '@/lib/tax-engine/config/taxYearConfig';

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

/**
 * Tax-law grounding (Option A) — the AI grounds tax-rule statements on the
 * canonical engine config, never on training memory. Test the pure mapper
 * deterministically against a known config (§19.2).
 */
describe('buildTaxRulesReference — tax law sourced from the canonical engine config', () => {
  it('maps the engine config verbatim (no re-typed law)', () => {
    const t = buildTaxRulesReference(TAX_YEAR_2025_26);
    expect(t.financialYear).toBe('2025-26');
    expect(t.superGuaranteeRate).toBe(TAX_YEAR_2025_26.superGuaranteeRate); // 0.12
    expect(t.taxFreeThreshold).toBe(18200);
    expect(t.cgtDiscount).toBe(0.5);
    expect(t.concessionalCap).toBe(TAX_YEAR_2025_26.concessionalCap);
    expect(t.residentIncomeTaxBrackets.length).toBe(TAX_YEAR_2025_26.brackets.length);
    expect(t.residentIncomeTaxBrackets[0]).toEqual({ min: 0, max: 18200, rate: 0 });
  });

  it('surfaces every Phase 41E reform measure with commencement status (§12.14)', () => {
    const t = buildTaxRulesReference(TAX_YEAR_2025_26);
    expect(t.reformMeasures.length).toBe(8);
    // Every reform flag is false in the shipped config → NONE is current law.
    for (const m of t.reformMeasures) {
      expect(m.commenced).toBe(false);
      expect(m.status).toBe('announced-not-in-effect');
    }
  });

  it('flips a measure to in-effect only when its commencement flag is verified', () => {
    const assented = { ...TAX_YEAR_2025_26, negativeGearingReformCommencementVerified: true };
    const t = buildTaxRulesReference(assented);
    const negGear = t.reformMeasures.find((m) => m.measure.includes('Negative gearing'))!;
    expect(negGear.commenced).toBe(true);
    expect(negGear.status).toBe('in-effect');
  });
});

describe('assembleFactPack — tax-law reference block', () => {
  it('attaches taxRules to the reference (brackets + reform measures)', () => {
    const pack = assembleFactPack(makeSnapshot());
    expect(pack.reference.taxRules.residentIncomeTaxBrackets.length).toBeGreaterThan(0);
    expect(pack.reference.taxRules.reformMeasures.length).toBe(8);
  });

  it('exposes the most-cited tax rules as resolvable app facts when tax scope is requested', () => {
    const pack = assembleFactPack(makeSnapshot(), { scopes: ['tax'] });
    expect(find(pack, 'taxRule.taxFreeThreshold')?.source).toBe('app');
    expect(find(pack, 'taxRule.taxFreeThreshold')?.value).toBe(18200); // stable across all FY configs
    expect(find(pack, 'taxRule.superGuaranteeRate')).toBeTruthy();
  });

  it('omits the tax-rule facts when neither tax nor app scope is requested (minimal payload)', () => {
    const pack = assembleFactPack(makeSnapshot(), { scopes: ['cashflow'] });
    expect(find(pack, 'taxRule.taxFreeThreshold')).toBeUndefined();
  });
});
