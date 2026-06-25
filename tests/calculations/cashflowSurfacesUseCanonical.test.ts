/**
 * SSOT enforcement gate — cashflow surfaces must route through the canonical
 * accessor (2026-06-23 cashflow-SSOT-convergence).
 *
 * WHY: SSOT was documented (CLAUDE.md §6.1/§12.2/§12.3) but never *enforced*,
 * so the `/cashflow` hero drifted to DECLARED records while the same page's
 * money-flow waterfall showed ACTUAL transactions — two different numbers on
 * one page. This structural guard fails the build if a converged cashflow
 * surface stops going through `getCanonicalMonthlyCashflow` /
 * `resolveCanonicalCashflow` (i.e. someone silently re-introduces a declared
 * headline). It is a cheap tripwire, not a full dataflow proof.
 *
 * If you intentionally retire one of these surfaces, update this test in the
 * same PR — do not just delete the assertion.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

describe('cashflow surfaces use the canonical accessor (SSOT drift guard)', () => {
  it('the /cashflow intelligence route resolves the hero + health via canonical', () => {
    const src = read('app/api/cashflow/intelligence/route.ts');
    expect(src).toContain('getCanonicalMonthlyCashflow');
    // The forecast hero must be fed the canonical figures, not declared
    // monthlyExpenses/monthlyLoanRepayments.
    expect(src).toMatch(/buildForecastSummary\(\s*totalBalance,\s*canonical\./);
    // The health-score input must read canonical inflow/outflow.
    expect(src).toContain('canonical.inflow');
    expect(src).toContain('canonical.outflow');
  });

  it('the emergency-fund tile displays the engine denominator, not declared expenses', () => {
    const src = read('app/api/dashboard/insights/route.ts');
    // The displayed "/month" figure must be the same denominator behind
    // monthsCovered (snapshot.emergencyFund.monthlyExpenses), not the declared
    // totalMonthlyExpenses.
    expect(src).toContain('monthlyExpenses: snapshot.emergencyFund.monthlyExpenses');
    expect(src).not.toMatch(/monthlyExpenses:\s*totalMonthlyExpenses/);
  });

  it('the /activity "this month" tiles read the canonical accessor (current month), not the rolling-30-day analytics window', () => {
    const src = read('app/dashboard/activity/page.tsx');
    // The summary tiles must resolve through the canonical monthly cashflow
    // (same engine as the /cashflow hero), so In/Out/Net match it exactly.
    expect(src).toContain('getCanonicalMonthlyCashflow');
    // The old rolling window must be gone from the summary fetch.
    expect(src).not.toContain("analytics?months=1");
  });

  it('the canonical accessor exposes the single actuals-vs-declared rule', () => {
    const src = read('lib/calculations/canonicalCashflow.ts');
    expect(src).toContain('export function getCanonicalMonthlyCashflow');
    expect(src).toContain('export function resolveCanonicalCashflow');
    // The rule must gate on hasActualData (actuals win when present).
    expect(src).toContain('hasActualData');
  });
});
