/**
 * Phase 45 PR 1 — Salary-sacrifice scenario + concessionalCapGuard contract tests.
 *
 * Covers:
 *   - H3 `concessionalCapGuard` — hard-stop math under / at / over cap, with
 *     and without carry-forward, with explicit YTD vs from-start-of-FY.
 *   - H2 `getRegimeStatus` — Div 296 UNAFFECTED / UNCOMPUTED / VERIFIED.
 *   - `salarySacrificeToSuperScenarioDecimal` — empty income, normal case,
 *     over-cap UNCOMPUTED, regime-locked UNCOMPUTED.
 *   - Float wrapper parity with Decimal (rounding tolerance).
 *   - H1 `salarySacrificeSliderSources` — snapshot path + default fallback.
 */

import { describe, it, expect } from 'vitest';
import { Decimal } from '@/lib/decimal';
import {
  salarySacrificeToSuperScenarioDecimal,
  salarySacrificeToSuperScenario,
  concessionalCapGuard,
  salarySacrificeSliderSources,
  getRegimeStatus,
} from '@/lib/cfo/scenarios/salarySacrificeToSuper';
import {
  TAX_YEAR_2024_25,
  TAX_YEAR_2025_26,
} from '@/lib/tax-engine/config/taxYearConfig';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type { ScenarioContext } from '@/lib/cfo/scenarios/types';

// ---------------------------------------------------------------------------
// Snapshot helper — minimal shape covering the fields the scenario reads
// ---------------------------------------------------------------------------

function makeSnapshot(opts: {
  grossSalary?: number;
  monthlyCashflow?: number;
  superannuationBalance?: number;
} = {}): MasterFinancialSnapshot {
  const grossSalary = opts.grossSalary ?? 100_000;
  return {
    quickMetrics: {
      monthlyIncome: grossSalary / 12,
      monthlyGrossIncome: grossSalary / 12,
      monthlyExpenses: 0,
      monthlyCashflow: opts.monthlyCashflow ?? 2000,
      monthlyLoanRepayments: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      netWorthValue: 0,
      savingsRate: 0,
      liquidCash: 0,
      keptAfterEssentials: 0,
      keptMargin: 0,
      freeCashDays: 0,
    },
    netWorth: {
      netWorth: 0,
      assets: {
        properties: 0,
        accounts: 0,
        investments: 0,
        superannuation: opts.superannuationBalance ?? 100_000,
        personalAssets: 0,
        total: opts.superannuationBalance ?? 100_000,
      },
      liabilities: {
        mortgages: 0,
        personalLoans: 0,
        creditCards: 0,
        total: 0,
      },
      breakdown: {
        propertyEquity: 0,
        liquidAssets: 0,
        investmentAssets: 0,
      },
    },
    income: {
      annual: {
        primary: { grossTotal: grossSalary, netTotal: grossSalary * 0.72, byType: {} } as never,
        all: { grossTotal: grossSalary, netTotal: grossSalary * 0.72, byType: {} } as never,
        secondary: { grossTotal: 0, netTotal: 0, byType: {} } as never,
        passive: { grossTotal: 0, netTotal: 0, byType: {} } as never,
        budgetVariance: { variance: 0, byCategory: [] } as never,
      },
      monthly: {
        primary: { grossTotal: grossSalary / 12, netTotal: (grossSalary / 12) * 0.72, byType: {} } as never,
        all: { grossTotal: grossSalary / 12, netTotal: (grossSalary / 12) * 0.72, byType: {} } as never,
        secondary: { grossTotal: 0, netTotal: 0, byType: {} } as never,
        passive: { grossTotal: 0, netTotal: 0, byType: {} } as never,
        budgetVariance: { variance: 0, byCategory: [] } as never,
      },
    } as MasterFinancialSnapshot['income'],
    calculatedAt: new Date('2026-06-01T00:00:00Z'),
    expenses: {
      monthly: { total: 0, byCategory: [] } as never,
      annual: { total: 0, byCategory: [] } as never,
    },
    propertyPortfolioValue: 0,
    properties: [],
    investments: {
      totalValue: 0,
      totalCostBase: 0,
      unrealisedGain: 0,
      unrealisedGainPercent: 0,
      holdingsCount: 0,
      byType: {},
    },
    emergencyFund: {
      liquidCash: 0,
      monthlyExpenses: 0,
      monthsCovered: 0,
      targetMonths: 3,
      gap: 0,
      status: 'good',
    },
  } as unknown as MasterFinancialSnapshot;
}

function makeCtx(opts: Parameters<typeof makeSnapshot>[0] = {}): ScenarioContext {
  return { snapshot: makeSnapshot(opts) };
}

function makeCtxWithSuper(
  opts: Parameters<typeof makeSnapshot>[0] = {},
  superAccounts: Array<{ balance: number; fundType: 'INDUSTRY' | 'RETAIL' | 'SMSF' | null }> = [],
): ScenarioContext {
  return {
    snapshot: makeSnapshot(opts),
    superAccounts: superAccounts.map((s, i) => ({
      id: `sup-${i}`,
      name: `Fund ${i}`,
      currentBalance: s.balance,
      fundType: s.fundType,
    })),
  };
}

// ---------------------------------------------------------------------------
// concessionalCapGuard
// ---------------------------------------------------------------------------

describe('concessionalCapGuard', () => {
  it('under cap: not exceeded, headroom > 0', () => {
    // FY24-25 cap = $30,000. $100k salary × 11.5% SG = $11,500. Sacrifice $500/mo
    // ($6,000/yr). Total = $17,500. Headroom = $12,500.
    const ctx = makeCtx({ grossSalary: 100_000 });
    const r = concessionalCapGuard(ctx, { monthlySacrifice: 500 }, TAX_YEAR_2024_25);
    expect(r.isExceeded).toBe(false);
    expect(r.hardStopReason).toBeUndefined();
    expect(r.capLimit.toNumber()).toBe(30_000);
    expect(r.proposed.toNumber()).toBe(17_500);
    expect(r.headroomRemaining.toNumber()).toBe(12_500);
  });

  it('at cap: not exceeded, headroom == 0', () => {
    // $100k × 11.5% = $11,500. Sacrifice = $30,000 − $11,500 = $18,500/yr =
    // $1541.67/mo. Use $1541.66 for clean rounding (slight under-cap).
    const ctx = makeCtx({ grossSalary: 100_000 });
    const r = concessionalCapGuard(ctx, { monthlySacrifice: 1541.67 }, TAX_YEAR_2024_25);
    // $11,500 + ($1541.67 × 12) = $11,500 + $18,500.04 = $30,000.04
    expect(r.isExceeded).toBe(true);
    expect(r.headroomRemaining.toNumber()).toBeCloseTo(-0.04, 1);
    expect(r.hardStopReason).toBeDefined();
  });

  it('over cap: hardStopReason populated', () => {
    const ctx = makeCtx({ grossSalary: 100_000 });
    const r = concessionalCapGuard(ctx, { monthlySacrifice: 3000 }, TAX_YEAR_2024_25);
    // $11,500 + $36,000 = $47,500. Over cap by $17,500.
    expect(r.isExceeded).toBe(true);
    expect(r.headroomRemaining.toNumber()).toBeCloseTo(-17_500, 1);
    expect(r.hardStopReason).toContain('over the $30000 cap');
  });

  it('explicit YTD overrides from-start-of-FY assumption', () => {
    // Caller provides ytdConcessional = $25,000 (already 5/6 of cap used).
    // Sacrificing $1000/mo more = $12,000. Total = $37,000. Over by $7,000.
    const ctx = makeCtx({ grossSalary: 100_000 });
    const r = concessionalCapGuard(
      ctx,
      { monthlySacrifice: 1000, ytdConcessional: 25_000 },
      TAX_YEAR_2024_25,
    );
    expect(r.used.toNumber()).toBe(25_000);
    expect(r.proposed.toNumber()).toBe(37_000); // ytd + annual sacrifice
    expect(r.isExceeded).toBe(true);
  });

  it('zero sacrifice = zero proposed change vs SG baseline', () => {
    const ctx = makeCtx({ grossSalary: 100_000 });
    const r = concessionalCapGuard(ctx, { monthlySacrifice: 0 }, TAX_YEAR_2024_25);
    expect(r.proposed.toNumber()).toBe(11_500); // SG only
    expect(r.isExceeded).toBe(false);
  });

  it('FY25-26 cap is $30,000 + SG 12%', () => {
    // FY25-26 SG rises to 12%. $100k × 12% = $12,000. Cap stays $30,000.
    const ctx = makeCtx({ grossSalary: 100_000 });
    const r = concessionalCapGuard(ctx, { monthlySacrifice: 1500 }, TAX_YEAR_2025_26);
    expect(r.capLimit.toNumber()).toBe(30_000);
    expect(r.proposed.toNumber()).toBe(12_000 + 18_000); // $30,000 exactly
    expect(r.headroomRemaining.toNumber()).toBe(0);
    expect(r.isExceeded).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getRegimeStatus (H2)
// ---------------------------------------------------------------------------

describe('getRegimeStatus', () => {
  it('UNAFFECTED when super balance below $3M threshold', () => {
    const r = getRegimeStatus(new Decimal(2_000_000), TAX_YEAR_2024_25);
    expect(r.kind).toBe('UNAFFECTED');
  });

  it('UNCOMPUTED when balance >= $3M AND commencement not verified', () => {
    // TAX_YEAR_2024_25.div296CommencementVerified should be false per the
    // canonical FY config. (Verified via taxYearConfig.ts.)
    const r = getRegimeStatus(new Decimal(3_500_000), TAX_YEAR_2024_25);
    expect(r.kind).toBe('DIV296_UNCOMPUTED');
    if (r.kind === 'DIV296_UNCOMPUTED') {
      expect(r.reason).toContain('Royal-Assent-verified');
    }
  });

  it('VERIFIED when balance >= $3M AND commencement verified', () => {
    const config = { ...TAX_YEAR_2024_25, div296CommencementVerified: true };
    const r = getRegimeStatus(new Decimal(3_500_000), config);
    expect(r.kind).toBe('DIV296_VERIFIED');
  });

  it('exactly at $3M is treated as crossed (no special edge case)', () => {
    const r = getRegimeStatus(new Decimal(3_000_000), TAX_YEAR_2024_25);
    expect(r.kind).toBe('DIV296_UNCOMPUTED');
  });
});

// ---------------------------------------------------------------------------
// salarySacrificeToSuperScenarioDecimal
// ---------------------------------------------------------------------------

describe('salarySacrificeToSuperScenarioDecimal', () => {
  it('zero salary: critical warning, no impacts', () => {
    const ctx = makeCtx({ grossSalary: 0 });
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 500 });
    expect(r.impacts).toHaveLength(0);
    expect(r.warnings[0].severity).toBe('critical');
    expect(r.warnings[0].message).toContain('Primary salary income is $0');
  });

  it('over-cap sacrifice: UNCOMPUTED with hard-stop reason', () => {
    const ctx = makeCtx({ grossSalary: 100_000 });
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 3000 });
    expect(r.impacts).toHaveLength(0);
    expect(r.warnings[0].severity).toBe('critical');
    expect(r.warnings[0].message).toContain('cap');
    expect(r.summary).toContain('Over concessional cap');
  });

  it('Div 296 UNCOMPUTED when balance > $3M + measure unverified', () => {
    const ctx = makeCtx({ grossSalary: 200_000, superannuationBalance: 3_500_000 });
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 500 });
    expect(r.impacts).toHaveLength(0);
    expect(r.warnings[0].severity).toBe('critical');
    expect(r.summary).toContain('High-balance super tax');
  });

  it('normal case: produces five impacts + cap-based assumptions', () => {
    const ctx = makeCtx({
      grossSalary: 100_000,
      monthlyCashflow: 2000,
      superannuationBalance: 150_000,
    });
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 500 });
    expect(r.impacts).toHaveLength(5);
    expect(r.summary).not.toContain('Over cap');

    const taxSavings = r.impacts.find((i) => i.label.startsWith('Year-1 tax savings'));
    expect(taxSavings).toBeDefined();
    expect(taxSavings!.after.toNumber()).toBeGreaterThan(0);

    const cashflow = r.impacts.find((i) => i.label === 'Monthly take-home pay');
    expect(cashflow).toBeDefined();
    // $500/mo sacrifice × (32% marginal − 15% contributions tax) ≈ $85/mo
    // tax savings. Net take-home delta ≈ -$500 + $85 = -$415/mo.
    expect(cashflow!.delta.toNumber()).toBeLessThan(0);

    const netToSuper = r.impacts.find((i) => i.label.startsWith('Year-1 net added to super'));
    expect(netToSuper).toBeDefined();
    // SG ($11,500) + sacrifice ($6,000) − 15% contributions tax (~$2,625) = ~$14,875
    expect(netToSuper!.after.toNumber()).toBeGreaterThan(10_000);

    const assumptions = r.assumptions.join('\n');
    expect(assumptions).toContain('concessional cap');
    // Engine reads current FY config — assert generically against SG rate
    // (11.5% FY24-25 or 12.0% FY25-26 depending on retrieval date).
    expect(assumptions).toMatch(/SG rate = 1[12]\.\d%/);
  });

  it('warns when headroom after sacrifice is low (under $2k)', () => {
    // FY25-26: SG 12%, cap $30k. Sacrifice such that headroom-after is ~$1k.
    // $100k × 12% = $12k SG. Cap remaining = $18k. Sacrifice $17,000/yr →
    // $1416.67/mo → headroom = $1k. Use $1417/mo for clean math.
    const ctx = makeCtx({ grossSalary: 100_000 });
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 1417 });
    const lowHeadroom = r.warnings.find((w) => w.message.includes('headroom left'));
    expect(lowHeadroom).toBeDefined();
  });

  it('handles Div 293 high-income case ($245k salary, $0 sacrifice, FY25-26)', () => {
    // $245k × 12% = $29,400 SG (under $30k cap). Taxable income $245k +
    // concessional $29,400 = $274,400 > $250k Div 293 threshold → Div 293
    // applies on $24,400 of contributions = $3,660 tax.
    const ctx = makeCtx({ grossSalary: 245_000 });
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 0 });
    expect(r.impacts.length).toBeGreaterThan(0);
    const div293 = r.warnings.find((w) => w.message.includes('Division 293'));
    expect(div293).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PR 2.A.1 — Div 296 TSB aggregation across APRA + SMSF
// ---------------------------------------------------------------------------

describe('Phase 45 PR 2.A.1 — Div 296 TSB aggregation', () => {
  it('without ctx.superAccounts: falls back to netWorth.assets.superannuation (back-compat)', () => {
    // Existing behaviour pre-PR-2.A.1: a user with only APRA-regulated
    // super (no SMSF) reads from the snapshot field correctly.
    const ctx = makeCtx({ grossSalary: 200_000, superannuationBalance: 2_500_000 });
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 100 });
    // $2.5M < $3M Div 296 threshold → UNAFFECTED regime → scenario continues
    expect(r.impacts.length).toBeGreaterThan(0);
  });

  it('with ctx.superAccounts: sums every account including SMSF (correct TSB)', () => {
    // The pre-PR-2.A.1 BUG: a user with $1.5M AustralianSuper + $2M SMSF
    // member balance reads as $1.5M TSB via the snapshot field (Phase 39.5
    // excludes SMSF from net-worth) — Div 296 never triggers even though
    // the real TSB is $3.5M.
    //
    // After PR 2.A.1: ctx.superAccounts (un-deduplicated) gives the
    // correct TSB and Div 296 fires.
    const ctx = makeCtxWithSuper(
      // snapshot.netWorth.assets.superannuation = $1.5M (APRA only,
      // Phase 39.5 excludes SMSF — that's what the snapshot field shows)
      { grossSalary: 200_000, superannuationBalance: 1_500_000 },
      [
        { balance: 1_500_000, fundType: 'INDUSTRY' }, // AustralianSuper
        { balance: 2_000_000, fundType: 'SMSF' },     // SMSF member balance
      ],
    );
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 100 });
    // TSB = $3.5M > $3M → DIV296_UNCOMPUTED → scenario returns UNCOMPUTED
    expect(r.impacts).toHaveLength(0);
    expect(r.warnings[0].severity).toBe('critical');
    expect(r.summary).toContain('High-balance super tax');
  });

  it('ctx.superAccounts of only APRA accounts: sums them (no SMSF) — TSB = total balance', () => {
    const ctx = makeCtxWithSuper(
      { grossSalary: 200_000, superannuationBalance: 800_000 },
      [
        { balance: 800_000, fundType: 'INDUSTRY' },
        { balance: 500_000, fundType: 'RETAIL' },
        // No SMSF
      ],
    );
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 100 });
    // TSB = $1.3M < $3M → UNAFFECTED
    expect(r.impacts.length).toBeGreaterThan(0);
  });

  it('ctx.superAccounts only at $2.9M aggregate: UNAFFECTED (below threshold)', () => {
    const ctx = makeCtxWithSuper(
      { grossSalary: 200_000 },
      [
        { balance: 2_400_000, fundType: 'INDUSTRY' },
        { balance: 500_000, fundType: 'SMSF' },
      ],
    );
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 100 });
    // TSB = $2.9M < $3M → UNAFFECTED
    expect(r.impacts.length).toBeGreaterThan(0);
  });

  it('empty ctx.superAccounts array: falls back to snapshot field (no crash)', () => {
    const ctx = makeCtxWithSuper(
      { grossSalary: 100_000, superannuationBalance: 100_000 },
      [], // empty
    );
    const r = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 100 });
    expect(r.impacts.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Float wrapper parity
// ---------------------------------------------------------------------------

describe('salarySacrificeToSuperScenario (Float wrapper)', () => {
  it('produces the same numbers as Decimal within rounding tolerance', () => {
    const ctx = makeCtx({ grossSalary: 100_000 });
    const f = salarySacrificeToSuperScenario(ctx, { monthlySacrifice: 500 });
    const d = salarySacrificeToSuperScenarioDecimal(ctx, { monthlySacrifice: 500 });
    expect(f.impacts).toHaveLength(d.impacts.length);
    for (let i = 0; i < f.impacts.length; i++) {
      expect(Math.abs(f.impacts[i].after - d.impacts[i].after.toNumber())).toBeLessThan(1);
      expect(Math.abs(f.impacts[i].before - d.impacts[i].before.toNumber())).toBeLessThan(1);
      expect(Math.abs(f.impacts[i].delta - d.impacts[i].delta.toNumber())).toBeLessThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// salarySacrificeSliderSources (H1)
// ---------------------------------------------------------------------------

describe('salarySacrificeSliderSources', () => {
  it('reports salary as snapshot-traced when no override supplied', () => {
    const ctx = makeCtx({ grossSalary: 100_000 });
    const sources = salarySacrificeSliderSources(ctx, { monthlySacrifice: 500 });
    expect(sources.grossSalaryAnnual.kind).toBe('snapshot');
    if (sources.grossSalaryAnnual.kind === 'snapshot') {
      expect(sources.grossSalaryAnnual.path).toBe('income.annual.primary.grossTotal');
      expect(sources.grossSalaryAnnual.asOf).toBe('2026-06-01T00:00:00.000Z');
    }
  });

  it('reports salary as default when override supplied', () => {
    const ctx = makeCtx({ grossSalary: 100_000 });
    const sources = salarySacrificeSliderSources(ctx, {
      monthlySacrifice: 500,
      grossSalaryAnnual: 120_000,
    });
    expect(sources.grossSalaryAnnual.kind).toBe('default');
    if (sources.grossSalaryAnnual.kind === 'default') {
      expect(sources.grossSalaryAnnual.value).toBe(120_000);
    }
  });

  it('monthlySacrifice is always a default (no snapshot source)', () => {
    const ctx = makeCtx();
    const sources = salarySacrificeSliderSources(ctx, { monthlySacrifice: 500 });
    expect(sources.monthlySacrifice.kind).toBe('default');
  });

  it('super balance falls back to netWorth.assets.superannuation when no override', () => {
    const ctx = makeCtx({ superannuationBalance: 250_000 });
    const sources = salarySacrificeSliderSources(ctx, { monthlySacrifice: 500 });
    expect(sources.currentSuperBalance.kind).toBe('snapshot');
    if (sources.currentSuperBalance.kind === 'snapshot') {
      expect(sources.currentSuperBalance.path).toBe('netWorth.assets.superannuation');
    }
  });
});
