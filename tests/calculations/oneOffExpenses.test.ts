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

  it('dashboard insights tiles filter one-offs and total from recurring', () => {
    const src = readFileSync(resolve(ROOT, 'app/api/dashboard/insights/route.ts'), 'utf8');
    expect(src).toMatch(/isRecurring !== false/);
    expect(src).toMatch(/snapshot\.expenses\.monthly\.recurring\.total/);
  });
});
