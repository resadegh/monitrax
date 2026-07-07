/**
 * MON-011 — one-off expenses are NOT ongoing monthly costs (§19.1, §19.4).
 *
 * A one-off purchase (a battery, an ATO tax payment) stored with a MONTHLY
 * frequency must NOT be shown/summed as "$X/mo". It contributes $0 to the
 * ongoing RECURRING monthly spend and appears instead as actual spend in the
 * month it happened. Recurring bills still count monthly.
 *
 * Two proofs:
 *   1. Semantic — filtering `isRecurring !== false` before the canonical
 *      aggregator excludes the one-off from the monthly total.
 *   2. §19.4 one-source — every "ongoing monthly spend" surface (the master
 *      snapshot's quickMetrics / health / free-cash-days, and the dashboard
 *      "Where your money goes" / "Spending by category" tiles) reads the
 *      RECURRING total / filters one-offs — not the one-off-inclusive `all`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { aggregateExpenses } from '../../lib/calculations/expenseAggregator';

interface Row { amount: number; frequency: string; isRecurring: boolean }
const recurringOnly = (rows: Row[]) =>
  aggregateExpenses(
    rows.filter((e) => e.isRecurring !== false).map((e) => ({ amount: e.amount, frequency: e.frequency })),
    'monthly',
  );

describe('one-off expenses excluded from ongoing monthly spend', () => {
  it('a one-off battery ($11,385) contributes $0 to the recurring monthly total', () => {
    const rows: Row[] = [
      { amount: 11385, frequency: 'MONTHLY', isRecurring: false }, // one-off battery
      { amount: 15000, frequency: 'MONTHLY', isRecurring: false }, // one-off ATO tax
      { amount: 200, frequency: 'MONTHLY', isRecurring: true }, // a real monthly bill
      { amount: 1300, frequency: 'QUARTERLY', isRecurring: true }, // quarterly rates
    ];
    const recurring = recurringOnly(rows);
    // only the two recurring bills: 200 + 1300/3 = 633.33/mo — NOT 26,585+
    expect(recurring.total).toBeCloseTo(200 + 1300 / 3, 2);
    expect(recurring.total).toBeLessThan(1000);
  });

  it('essential + discretionary (recurring only) == recurring total — never >100% (the 906% bug)', () => {
    const rows: Row[] = [
      { amount: 1028, frequency: 'MONTHLY', isRecurring: true }, // insurance (essential)
      { amount: 88, frequency: 'MONTHLY', isRecurring: true }, // other (discretionary)
      { amount: 10105, frequency: 'MONTHLY', isRecurring: false }, // one-off discretionary (battery-ish)
    ];
    const essentialFlags = [true, false, false];
    const withFlags = rows.map((r, i) => ({ ...r, isEssential: essentialFlags[i] }));
    const agg = (rs: Array<Row & { isEssential: boolean }>) =>
      aggregateExpenses(rs.map((e) => ({ amount: e.amount, frequency: e.frequency })), 'monthly').total;

    const recurringTotal = agg(withFlags.filter((e) => e.isRecurring !== false));
    const essential = agg(withFlags.filter((e) => e.isEssential && e.isRecurring !== false));
    const discretionary = agg(withFlags.filter((e) => !e.isEssential && e.isRecurring !== false));

    expect(essential + discretionary).toBeCloseTo(recurringTotal, 2); // partition holds
    // the one-off $10,105 does NOT inflate discretionary → ratio ≤ 100% (was 906%)
    expect((discretionary / recurringTotal) * 100).toBeLessThanOrEqual(100);
    expect(discretionary).toBeCloseTo(88, 2);
  });

  it('with no one-offs, recurring total equals the full total (no behaviour change)', () => {
    const rows: Row[] = [
      { amount: 200, frequency: 'MONTHLY', isRecurring: true },
      { amount: 90, frequency: 'WEEKLY', isRecurring: true },
    ];
    const all = aggregateExpenses(rows.map((e) => ({ amount: e.amount, frequency: e.frequency })), 'monthly');
    expect(recurringOnly(rows).total).toBeCloseTo(all.total, 2);
  });
});

describe('§19.4 one-source — ongoing monthly surfaces exclude one-offs', () => {
  const ROOT = resolve(__dirname, '../..');

  it('masterFinancialService uses recurring (not all) for quickMetrics / health / free-cash-days', () => {
    const src = readFileSync(resolve(ROOT, 'lib/services/masterFinancialService.ts'), 'utf8');
    // health score + quickMetrics.monthlyExpenses + freeCashDays read recurring
    expect(src).toMatch(/monthlyExpenses\.recurring\.total,\s*\/\/ MON-011/);
    expect(src).toMatch(/monthlyExpenses:\s*monthlyExpenses\.recurring\.total/);
    // cashflow (savings rate) filters one-offs out of its expense input
    expect(src).toMatch(/isRecurring !== false/);
  });

  it('dashboard insights tiles filter one-offs; essential/discretionary/total share one recurring base', () => {
    const src = readFileSync(resolve(ROOT, 'app/api/dashboard/insights/route.ts'), 'utf8');
    // one-offs excluded from the monthly views
    expect(src).toMatch(/isRecurring !== false/);
    // essential + discretionary + total all derived from the same recurring
    // `expenseDetails` set (so a one-off can't push discretionary >100%)
    expect(src).toMatch(/expenseDetails\.filter\(\(e\) => e\.isEssential\)/);
    expect(src).toMatch(/expenseDetails\.filter\(\(e\) => !e\.isEssential\)/);
  });

  it('masterFinancialService essential/discretionary slices exclude one-offs', () => {
    const src = readFileSync(resolve(ROOT, 'lib/services/masterFinancialService.ts'), 'utf8');
    expect(src).toMatch(/isEssential === true && e\.isRecurring !== false/);
    expect(src).toMatch(/isEssential !== true && e\.isRecurring !== false/);
  });
});
