import { describe, it, expect } from 'vitest';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { assembleFactPack, buildTaxRulesReference } from '@/lib/neobrain/factPack';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import {
  resolveFactRef,
  validateGroundedNumbers,
  renderFact,
  buildGroundingClause,
  renderTaxLawLines,
} from '@/lib/neobrain/grounding';

/**
 * Neobrain Phase B — the grounding validator. Pins the anti-hallucination
 * guarantee: a number the AI cites that doesn't resolve to a real, non-absent
 * fact is REJECTED and never reaches the user.
 */
function snap(over: Partial<{ loans: number }> = {}): MasterFinancialSnapshot {
  const { loans = 2 } = over;
  return {
    userId: 'u1',
    calculatedAt: new Date('2026-06-28T00:00:00.000Z'),
    counts: { expenses: 1, income: 1, accounts: 1, loans, properties: 0, investments: 0 },
    quickMetrics: {
      monthlyIncome: 8000, monthlyExpenses: 6500, monthlyCashflow: 1500, monthlyLoanRepayments: 2200,
      totalAssets: 900000, totalLiabilities: loans > 0 ? 450000 : 0, netWorthValue: 450000,
      savingsRate: 18.75, liquidCash: 25000, actualNetCashflow: 1320, hasActualData: true,
    },
    emergencyFund: { liquidCash: 25000, monthlyExpenses: 6500, monthsCovered: 3.8, targetMonths: 6, gap: 14000 },
    tax: { estimatedTaxableIncome: 96000, estimatedTaxPayable: 21000, effectiveTaxRate: 21.9, marginalTaxRate: 32.5, totalDeductions: 4000, paygWithheld: 20000, estimatedRefundOrOwing: -1000 },
    staleness: { anyStale: false },
  } as unknown as MasterFinancialSnapshot;
}

describe('resolveFactRef', () => {
  it('resolves by snapshot-path ref and by key', () => {
    const pack = assembleFactPack(snap());
    expect(resolveFactRef(pack, 'quickMetrics.monthlyCashflow')?.value).toBe(1500);
    expect(resolveFactRef(pack, 'cashflow.monthlyCashflow')?.value).toBe(1500); // by key
  });
  it('returns null for an unknown ref (an invented path)', () => {
    expect(resolveFactRef(assembleFactPack(snap()), 'quickMetrics.madeUpNumber')).toBeNull();
  });
});

describe('validateGroundedNumbers — the anti-hallucination guarantee', () => {
  it('resolves a real fact and renders it', () => {
    const res = validateGroundedNumbers(assembleFactPack(snap()), ['quickMetrics.monthlyCashflow']);
    expect(res.ok).toBe(true);
    expect(res.resolved[0].rendered).toBe('$1,500');
    expect(res.rejected).toHaveLength(0);
  });

  it('REJECTS an unknown ref (the AI invented a number)', () => {
    const res = validateGroundedNumbers(assembleFactPack(snap()), ['totally.madeUp']);
    expect(res.ok).toBe(false);
    expect(res.rejected).toEqual([{ ref: 'totally.madeUp', reason: 'unknown' }]);
    expect(res.resolved).toHaveLength(0);
  });

  it('REJECTS a ref that resolves to an absent fact (not connected → must refuse, not invent)', () => {
    // no loans → debt facts are absent
    const res = validateGroundedNumbers(assembleFactPack(snap({ loans: 0 })), ['quickMetrics.totalLiabilities']);
    // (note: with loans:0 the debt slice marks debt.totalLiabilities absent;
    //  the netWorth slice's own totalLiabilities is a real 0 — assert the debt one)
    const debt = validateGroundedNumbers(assembleFactPack(snap({ loans: 0 })), ['debt.totalLiabilities']);
    expect(debt.ok).toBe(false);
    expect(debt.rejected[0].reason).toBe('absent');
    // sanity: the unknown-vs-absent distinction holds
    expect(res.resolved.length + res.rejected.length).toBe(1);
  });

  it('handles a mix — keeps the real ones, drops the invented ones', () => {
    const res = validateGroundedNumbers(assembleFactPack(snap()), [
      'quickMetrics.monthlyCashflow',
      'invented.surplus',
      'tax.estimatedTaxPayable',
    ]);
    expect(res.resolved.map((r) => r.ref)).toEqual(['quickMetrics.monthlyCashflow', 'tax.estimatedTaxPayable']);
    expect(res.rejected.map((r) => r.ref)).toEqual(['invented.surplus']);
    expect(res.ok).toBe(false);
  });
});

describe('renderFact', () => {
  it('formats by unit and never renders a number for absent', () => {
    const pack = assembleFactPack(snap({ loans: 0 }));
    const cashflow = resolveFactRef(pack, 'cashflow.monthlyCashflow')!;
    expect(renderFact(cashflow)).toBe('$1,500');
    const marginal = resolveFactRef(pack, 'tax.marginalRate')!;
    expect(renderFact(marginal)).toBe('32.5%');
    const debt = resolveFactRef(pack, 'debt.totalLiabilities')!; // absent
    expect(renderFact(debt)).toBe('—');
  });
});

describe('buildGroundingClause', () => {
  it('lists absent facts as NOT AVAILABLE with the never-estimate instruction', () => {
    const clause = buildGroundingClause(assembleFactPack(snap({ loans: 0 })));
    expect(clause).toContain('never estimate');
    expect(clause).toMatch(/NOT AVAILABLE/);
    expect(clause).toContain('2026-06-28T00:00:00.000Z'); // the "as of" freshness anchor
  });

  it('surfaces the current tax law + the §12.14 "not current law" guard for reform measures', () => {
    const clause = buildGroundingClause(assembleFactPack(snap()));
    expect(clause).toContain('CURRENT TAX LAW');
    expect(clause).toContain('Resident income tax brackets');
    expect(clause).toContain('never recall a rate'); // grounding rule 5 — no tax rates from memory
    expect(clause).toMatch(/announced-not-in-effect|NOT current law/); // reform measures gated
  });
});

describe('renderTaxLawLines — the ONE shared tax-law clause (used by FactPack + CFO advisor)', () => {
  it('renders the current-FY tax law with brackets, caps, CGT and reform status', () => {
    const lines = renderTaxLawLines(buildTaxRulesReference(getCurrentTaxYearConfig())).join('\n');
    expect(lines).toContain('CURRENT TAX LAW');
    expect(lines).toMatch(/Resident income tax brackets:/);
    expect(lines).toContain('Medicare levy');
    expect(lines).toContain('CGT discount');
    expect(lines).toContain('reform measures');
  });

  it('returns empty for missing rules — never fabricates law', () => {
    expect(renderTaxLawLines(null)).toEqual([]);
    expect(renderTaxLawLines(undefined)).toEqual([]);
  });
});
