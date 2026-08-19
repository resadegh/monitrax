/**
 * MON-164 / MON-165 / MON-129(kept) — the accountant pack's rows come from
 * canonical producers, never raw-row re-derivation
 * (M2 §B; MONITRAX_V1_MASTER_PLAN.md §5).
 *
 * Ring-0 worked examples lock the row rule (`annualContribution`) and the
 * depreciation convergence; Ring-1 source-scans lock the deleted inline
 * formulas out of the two files that carried them.
 *
 * Coverage boundary: verifies the row rule, the canonical depreciation
 * value and the source topology. Does NOT run buildReportContext against
 * a database, and does NOT verify the rendered pack on live data — that
 * is the Matrix's Ring-3 (M2.2), driven by the expected movements in the
 * PR. "changesNumbers: YES" is verified there, not here.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { annualContribution } from '@/lib/reports/contextBuilder';
import { calculateDepreciationAnnual } from '@/lib/depreciation';
import { buildEntityBreakdown } from '@/lib/calculations/entityBreakdown';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';

describe('MON-164 — annualContribution (the pack row rule, §19.1)', () => {
  it('a one-off counts ONCE at its amount — never × frequency (the MON-037 battery class)', () => {
    // $11,385 one-off stored MONTHLY: old code fed the pack $136,620/yr.
    expect(
      annualContribution({ amount: 11385, frequency: 'MONTHLY', isRecurring: false }, undefined, false),
    ).toBe(11385);
    // Even with linked transactions, once means once.
    expect(
      annualContribution(
        { amount: 11385, frequency: 'MONTHLY', isRecurring: false },
        [{ date: new Date('2026-01-05'), amount: 11385 }],
        false,
      ),
    ).toBe(11385);
  });

  it('a recurring row with reconciled transactions is actuals-first (MON-001 R1 — the −54% pack row)', () => {
    // Rent $2,947 mis-stored MONTHLY, actually paid fortnightly. The old
    // pack row read declared 2947 × 12 = $35,364/yr. Actuals win now.
    const start = new Date('2025-07-01');
    const txs = Array.from({ length: 26 }, (_, i) => ({
      date: new Date(start.getTime() + i * 14 * 24 * 3600 * 1000),
      amount: 2947,
    }));
    const annual = annualContribution(
      { amount: 2947, frequency: 'MONTHLY', isRecurring: true },
      txs,
      true, // rent — paid in advance
    );
    // Day-span monthly ≈ 2947/14 × 30.4375 = 6,406.72 → ≈ $76,880/yr.
    expect(annual).toBeGreaterThan(70_000);
    expect(annual).toBeLessThan(80_000);
    expect(annual).not.toBe(2947 * 12); // the defect value can never return
  });

  it('a recurring row with no transactions falls back to the declared plan', () => {
    expect(
      annualContribution({ amount: 500, frequency: 'WEEKLY', isRecurring: true }, undefined, false),
    ).toBeCloseTo(500 * 52, 5);
    expect(
      annualContribution({ amount: 500, frequency: 'WEEKLY', isRecurring: null }, [], false),
    ).toBeCloseTo(500 * 52, 5);
  });
});

describe('MON-165 — ONE depreciation producer (the 1.95× divergence is dead)', () => {
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  it('canonical: $10k DIV40 @10% diminishing value, 3 years in → ~$1,024/yr (WDV), never $2,000 (first-year)', () => {
    const dep = calculateDepreciationAnnual({
      id: 's1',
      assetName: 'Split system',
      category: 'DIV40',
      method: 'DIMINISHING_VALUE',
      cost: 10_000,
      rate: 10, // stored AS a percentage
      startDate: threeYearsAgo,
    } as never);
    // WDV = 10,000 × (1 − 0.2)³ = 5,120 → annual = 5,120 × 0.2 = 1,024.
    expect(dep.annualDepreciation).toBeCloseTo(1024, 0);
    expect(dep.annualDepreciation).not.toBeCloseTo(2000, 0);
  });

  it('the first-year-only formula is gone from both carriers (source lock)', () => {
    const builder = fs.readFileSync(path.resolve(process.cwd(), 'lib/reports/contextBuilder.ts'), 'utf8');
    const depPage = fs.readFileSync(
      path.resolve(process.cwd(), 'app/dashboard/properties/[id]/depreciation/page.tsx'),
      'utf8',
    );
    for (const [name, src] of [['contextBuilder', builder], ['depreciation page', depPage]] as const) {
      expect(src, name).not.toMatch(/cost\s*\*\s*rate\s*\*\s*2/);
      expect(src, name).not.toContain('assumes first year');
      expect(src, name).toContain('calculateDepreciationAnnual');
    }
    // The pack's raw declared-row annualisation is gone too (MON-164):
    expect(builder).not.toMatch(/annualAmount:\s*toAnnual\(/);
    expect(builder).toContain('annualContribution(');
    // …and equity/LVR read the canonical producers, not inline math.
    expect(builder).toContain('calculateEquity(');
    expect(builder).toContain('calculateLVR(');
  });
});

describe('MON-129 (kept) — one-off gates on the two remaining kept producers', () => {
  it('entityBreakdown: a one-off expense never enters the monthly run-rate', () => {
    const base = {
      entities: [],
      properties: [],
      accounts: [],
      investmentHoldings: [],
      loans: [],
      superannuation: [],
      assets: [],
      income: [],
    };
    const positions = buildEntityBreakdown({
      ...base,
      expenses: [
        { ownerEntityId: null, amount: 1200, frequency: 'MONTHLY', isRecurring: true },
        { ownerEntityId: null, amount: 11385, frequency: 'MONTHLY', isRecurring: false }, // one-off
      ],
    } as never);
    const unattributed = positions.find((p) => p.monthlyExpenses > 0);
    expect(unattributed?.monthlyExpenses).toBe(1200); // NOT 12,585
  });

  it('propertyCashflow: a one-off rent row never enters the declared fallback', () => {
    const cf = computePropertyCashflow({
      income: [
        { id: 'r1', type: 'RENTAL', amount: 680, frequency: 'WEEKLY', isRecurring: true },
        { id: 'r2', type: 'RENTAL', amount: 5000, frequency: 'MONTHLY', isRecurring: false }, // one-off (e.g. insurance payout misfiled as rent)
      ],
      expenses: [],
      loans: [],
      transactions: [], // no actuals → declared fallback path
    });
    // Only the recurring row: 680 × 52 / 12 = 2,946.67 — the one-off adds nothing.
    expect(cf.monthlyRent).toBeCloseTo((680 * 52) / 12, 1);
  });
});
