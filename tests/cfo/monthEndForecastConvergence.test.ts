/**
 * MON-021 — the two cashflow-forecast summary tiles must project off the ONE
 * canonical monthly net via the ONE shared formula, and the "Money In" figures on
 * /cashflow must agree (§12.2.1 / §19.1 / §19.4).
 *
 * WHAT WAS WRONG:
 *   (a) The /cashflow hero showed actual "Money In $0" while the money-flow
 *       waterfall showed DECLARED "In +$43,736" — because the waterfall's income
 *       used a TRUTHINESS fallback (`actualMonthlyInflow ? … : declared`), so a
 *       legitimate $0 actual inflow fell through to declared income.
 *   (b) My Guide's "Month-End Balance" used a crude `totalLiquid − dailyBurn ×
 *       daysRemaining` (expenses-only, declared, income-blind) that disagreed with
 *       the /cashflow forecast (which projects off the canonical monthly net) by
 *       tens of thousands of dollars.
 *
 * THE FIX: one `projectBalanceForward(balance, monthlyNet, days)` used by BOTH the
 * /cashflow forecast AND My Guide, both fed the SAME `getCanonicalMonthlyCashflow`
 * net; and the waterfall income now reads the same `canonical.inflow` the hero uses.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectBalanceForward } from '../../lib/calculations/canonicalCashflow';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-021: projectBalanceForward — the ONE forward-projection formula', () => {
  it('projects a full month: $100,000 + $3,000 net over 30 days = $103,000', () => {
    expect(projectBalanceForward(100_000, 3_000, 30)).toBe(103_000);
  });
  it('projects a partial horizon: $100,000 + $3,000/mo over 15 days = $101,500', () => {
    // 3000/30 × 15 = 1500
    expect(projectBalanceForward(100_000, 3_000, 15)).toBe(101_500);
  });
  it('a negative net draws the balance down: $50,000 − $6,000/mo over 30 days = $44,000', () => {
    expect(projectBalanceForward(50_000, -6_000, 30)).toBe(44_000);
  });
  it('same net + same base + same formula → the only difference is the horizon', () => {
    const base = 80_000, net = 2_400;
    // 30-day (/cashflow) vs 20-day-to-month-end (My Guide) — consistent, not contradictory.
    expect(projectBalanceForward(base, net, 30)).toBe(82_400);
    expect(projectBalanceForward(base, net, 20)).toBe(81_600);
  });
});

describe('MON-021 (b): both forecast tiles read the canonical net + shared projection (§19.4 lock)', () => {
  it('My Guide month-end uses getCanonicalMonthlyCashflow + projectBalanceForward, not the crude burn', () => {
    const src = read('lib/cfo/intelligenceEngine.ts');
    expect(src).toContain('getCanonicalMonthlyCashflow(snapshot).net');
    expect(src).toContain('projectBalanceForward(');
    // the old crude expenses-only linear burn is gone
    expect(src).not.toMatch(/totalLiquid\s*-\s*\(dailyBurn/);
  });
  it('the /cashflow forecast hero uses the same shared projection', () => {
    const src = read('app/api/cashflow/intelligence/route.ts');
    expect(src).toContain('projectBalanceForward(totalBalance, monthlyNet, 30)');
    expect(src).toContain('projectBalanceForward(totalBalance, monthlyNet, 90)');
  });
});

describe('MON-021 (a): the /cashflow "Money In" figures agree (no declared leak)', () => {
  it('the waterfall income reads canonical.inflow (same as the hero), not a truthiness fallback', () => {
    const src = read('app/api/cashflow/intelligence/route.ts');
    expect(src).toContain('const actualIncome = canonical.inflow');
    // the buggy `actualMonthlyInflow ? … : monthlyIncome` truthiness fallback is gone
    expect(src).not.toMatch(/actualMonthlyInflow\s*\n?\s*\?\s*masterSnapshot/);
  });
});
