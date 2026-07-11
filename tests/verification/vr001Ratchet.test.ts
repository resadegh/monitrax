/**
 * VR-001 RATCHET TESTS (CLAUDE.md §23.2.2) — every real-data escape from the
 * 2026-07-11 verification run gets a permanent test at the ring that should
 * have caught it. These lock the culprit-removal fixes for MON-017 (residual),
 * MON-029, MON-032 and MON-033 so the bug classes cannot ship again.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeSafetyScore } from '@/lib/calculations/safetyScore';
import { getCanonicalSavingsRate } from '@/lib/calculations/canonicalCashflow';
import { computePropertyCashflow } from '@/lib/calculations/propertyCashflow';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ─── MON-017 residual — safety score fed DECLARED cashflow ──────────────────
describe('MON-017 residual: the safety-net route feeds the ACTUALS-first net to the score', () => {
  const route = read('app/api/safety-net/route.ts');

  it('monthlySurplus reads getCanonicalMonthlyCashflow(snapshot).net, not qm.monthlyCashflow', () => {
    expect(route).toContain('getCanonicalMonthlyCashflow(snapshot).net');
    expect(route).not.toContain('const monthlySurplus = qm.monthlyCashflow');
  });

  it('Ring 0: a real deficit scores 0/15 on the cashflow dimension (VR-001 scenario)', () => {
    // VR-001: portfolio cashflow −$6,073/mo yet "Positive Cashflow 15/15".
    const deficit = computeSafetyScore({
      monthsCovered: 11.7,
      targetMonths: 6,
      billsOnTime: 5,
      totalBills: 5,
      monthlyCashflow: -6073,
    });
    expect(deficit.positiveCashflow.score).toBe(0);

    const surplus = computeSafetyScore({
      monthsCovered: 11.7,
      targetMonths: 6,
      billsOnTime: 5,
      totalBills: 5,
      monthlyCashflow: 500,
    });
    expect(surplus.positiveCashflow.score).toBe(15);
    // Worked example: EF capped 40 + bills 30 + noNewDebt 15 + cashflow 15 = 100.
    expect(surplus.total).toBe(100);
    expect(deficit.total).toBe(85);
  });
});

// ─── MON-029 — savings rate had THREE producers ──────────────────────────────
describe('MON-029: ONE canonical savings-rate accessor across all three surfaces', () => {
  it('Ring 0: trailing actuals win; declared plan is the fallback (worked examples)', () => {
    const snapshot = {
      cashflow: {},
      quickMetrics: { monthlyIncome: 10000, monthlyExpenses: 6000, monthlyLoanRepayments: 2000 },
    } as never;

    // Trailing branch: 12 months of data, trailing rate −30.5 → the accessor returns it.
    const trailing = getCanonicalSavingsRate(snapshot, {
      trailingMonthsWithData: 12,
      annualIncome: 120000,
      annualOutgoings: 156600,
      savingsRateTrailing: -30.5,
    });
    expect(trailing.rate).toBe(-30.5);
    expect(trailing.basis).toBe('actual-ttm');

    // Declared fallback: (10000 − 8000) / 10000 = 20%.
    const declared = getCanonicalSavingsRate(snapshot, null);
    expect(declared.rate).toBeCloseTo(20, 6);
    expect(declared.basis).toBe('declared');
  });

  it('the CFO monthly-progress card no longer reads the declared quickMetrics.savingsRate', () => {
    const cfo = read('lib/cfo/intelligenceEngine.ts');
    expect(cfo).not.toContain('const savingsRate = snapshot.quickMetrics.savingsRate');
    expect(cfo).toContain('getCanonicalSavingsRate');
  });

  it('the Home KPI tile AND the Home insight read the same accessor', () => {
    const insights = read('app/api/dashboard/insights/route.ts');
    const hits = insights.match(/getCanonicalSavingsRate\(snapshot, moneyStoryTrend\)/g) ?? [];
    // insight + tile trailing branch + tile declared branch = 3 call sites
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── MON-032 — "-$0" loan repayment row ──────────────────────────────────────
describe('MON-032: per-loan resolved cost is exposed and never silently $0', () => {
  it('Ring 0: no repayment + no actuals → line floors to interest (VR-001 Broadbeach)', () => {
    // $228,000 @ 6.69% p.a. → monthly interest 228000×0.0669/12 = $1,271.10.
    const cf = computePropertyCashflow({
      loans: [{ id: 'l1', principal: 228000, interestRateAnnual: 0.0669, minRepayment: null }],
    });
    expect(cf.loanLines).toHaveLength(1);
    const line = cf.loanLines[0];
    expect(line.flooredToInterest).toBe(true);
    expect(line.monthly).toBeCloseTo(1271.1, 1);
    // Reconciliation lock: Σ loanLines.monthly === monthlyLoanRepayment.
    expect(line.monthly).toBeCloseTo(cf.monthlyLoanRepayment, 6);
  });

  it('Ring 0: a declared minRepayment resolves at its cadence, not the floor', () => {
    const cf = computePropertyCashflow({
      loans: [{ id: 'l1', principal: 228000, interestRateAnnual: 0.0669, minRepayment: 700, repaymentFrequency: 'FORTNIGHTLY' }],
    });
    const line = cf.loanLines[0];
    expect(line.flooredToInterest).toBe(false);
    // 700/fortnight → 700 × 26 / 12 = $1,516.67/mo.
    expect(line.monthly).toBeCloseTo((700 * 26) / 12, 1);
  });

  it('the detail-page activity row renders the engine line, not raw minRepayment', () => {
    const page = read('app/dashboard/properties/[id]/page.tsx');
    // The row is driven by the engine's per-loan lines; the floored case is
    // labelled honestly instead of printing "-$0". (A raw-minRepayment render
    // remains ONLY inside the guarded declared branch, where minRepayment > 0.)
    expect(page).toContain('loanLines');
    expect(page).toContain('flooredToInterest');
    expect(page).toContain('interest (no repayment set)');
  });
});

// ─── MON-033 — yield leaked onto an owner-occupied HOME ─────────────────────
describe('MON-033: rental yield is gated on INVESTMENT everywhere it renders', () => {
  it('the Home dashboard property tile gates the yield block on isInvestment', () => {
    const tile = read('components/dashboard/tiles/DashboardPropertyTile.tsx');
    expect(tile).toMatch(/isInvestment && \(\s*<div>\s*<p[^>]*>\s*Rental Yield/);
  });

  it('the CFO low_yield alert is gated on property.type === INVESTMENT', () => {
    const ds = read('lib/cfo/decisionSupport/propertyDecisionSupport.ts');
    expect(ds).toContain("property.type === 'INVESTMENT' && property.rentalYield > 0");
  });

  it('PropertyMetrics carries the type the gates need', () => {
    const master = read('lib/services/masterFinancialService.ts');
    expect(master).toContain('type: property.type,');
  });
});
