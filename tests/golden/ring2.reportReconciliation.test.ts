/**
 * NEOAUDIT §3 REPORT RECONCILIATION LOCKS — the income/expense report on the
 * Golden Household (CLAUDE.md Part 23 Ring 2; NEOAUDIT.md §8 step-5).
 *
 * §3: "Report reconciliation locks: Σ report lines === canonical total." A report
 * that re-derives its figures from raw rows can drift from the ONE canonical
 * source (§12.2.1 / §19.4). This locks two things on golden data:
 *
 *   INTERNAL  — within each report section, Σ line rows === the section's stated
 *               total (a report whose lines don't add up to its own total is
 *               broken on its face).
 *   CROSS-SOURCE — the report's annual income/expense totals === the canonical
 *               master snapshot's annual figures (monthly × 12). This is the
 *               load-bearing lock: the report and the dashboard must tell the
 *               same story, because both must read the ONE canonical total.
 *
 * The report is generated through the REAL path: `buildReportContext` (its own
 * prisma reads served by the golden DB) → `generateIncomeExpenseReport`.
 *
 * Coverage boundary (§20.6 / §22.2.4): verifies the income/expense report's line
 * totals reconcile internally AND tie to the canonical master annual figures on
 * golden data (declared basis — the golden book has no actuals). Does NOT verify
 * the OTHER report generators (property/loan/investment/tax — each its own future
 * lock), the rendered/exported PDF/XLSX (R2-vis), or real data (R3).
 *
 * Mocked (honest scope): `@/lib/db` serves the golden rows (Proxy throws on any
 * un-served model). No auth mock needed — the report path is a service, not a
 * route.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/lib/db', async () => {
  const { createGoldenDb } = await import('./goldenHousehold');
  const db = createGoldenDb();
  return { default: db, prisma: db };
});

import { buildReportContext } from '@/lib/reports/contextBuilder';
import { generateIncomeExpenseReport } from '@/lib/reports/generators/incomeExpense';
import { generateTaxTimeReport } from '@/lib/reports/generators/taxTime';
import { getMasterFinancialSnapshot, type MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { toAnnual } from '@/lib/utils/frequencies';
import { formatCurrency } from '@/lib/reports/generators';
import type { AnyReportSection, TableSection, MetricSection, ReportContext } from '@/lib/reports/types';
import { EXPECTED, GOLDEN_USER_ID } from './goldenHousehold';

let sections: AnyReportSection[];
let master: MasterFinancialSnapshot;

const table = (id: string) => sections.find((s) => s.id === id) as TableSection;
const sumRows = (t: TableSection, key: string) =>
  t.rows.reduce((acc, r) => acc + (Number((r as Record<string, unknown>)[key]) || 0), 0);

beforeAll(async () => {
  const context = await buildReportContext(GOLDEN_USER_ID, 'income-expense');
  sections = generateIncomeExpenseReport(context, { type: 'income-expense' } as never);
  master = await getMasterFinancialSnapshot(GOLDEN_USER_ID);
});

describe('NeoAudit §3 report reconciliation — INTERNAL (lines add up to the section total)', () => {
  it('expense-breakdown: Σ line annualAmount === the section total', () => {
    const t = table('expense-breakdown');
    expect(sumRows(t, 'annualAmount')).toBeCloseTo(Number(t.totals?.annualAmount), 2);
  });

  it('income-breakdown: Σ line annualAmount === the section total', () => {
    const t = table('income-breakdown');
    expect(sumRows(t, 'annualAmount')).toBeCloseTo(Number(t.totals?.annualAmount), 2);
  });

  it('expense-by-category: Σ category amounts === the breakdown total (same figure, two groupings)', () => {
    expect(sumRows(table('expense-by-category'), 'amount')).toBeCloseTo(Number(table('expense-breakdown').totals?.annualAmount), 2);
  });

  it('income-by-category: Σ category amounts === the breakdown total', () => {
    expect(sumRows(table('income-by-category'), 'amount')).toBeCloseTo(Number(table('income-breakdown').totals?.annualAmount), 2);
  });
});

describe('NeoAudit §3 report reconciliation — CROSS-SOURCE (report total === canonical master annual)', () => {
  it('report annual expenses === master monthly expenses × 12 === manifest 20,400', () => {
    const reportAnnualExpenses = Number(table('expense-breakdown').totals?.annualAmount);
    expect(reportAnnualExpenses).toBeCloseTo(master.cashflow.monthlyExpenses * 12, 2);
    expect(reportAnnualExpenses).toBeCloseTo(EXPECTED.cashflow.monthlyExpenses * 12, 2); // 20,400
  });

  it('report annual income === master monthly income × 12 === manifest 124,800', () => {
    const reportAnnualIncome = Number(table('income-breakdown').totals?.annualAmount);
    expect(reportAnnualIncome).toBeCloseTo(master.cashflow.monthlyNetIncome * 12, 2);
    expect(reportAnnualIncome).toBeCloseTo(EXPECTED.cashflow.monthlyNetIncome * 12, 2); // 124,800
  });
});

describe('MON-034 root-cause lock — an ANNUAL-frequency expense is $amount/yr, not $amount×12', () => {
  it('the shared fetchExpenseData source annualises the golden ANNUAL insurance to 2,400 (was 28,800)', () => {
    // The exact bug: calculateAnnualAmount had no `ANNUAL` case (only ANNUALLY/
    // YEARLY), so the real Prisma enum value fell to `default: ×12`. The report
    // over-stated the insurance 12× (28,800) and inflated total expenses to
    // 46,800. Fixed by using the canonical toAnnual (§12.2.1 — one converter).
    const t = table('expense-breakdown');
    const insurance = t.rows.find((r) => (r as { description?: string }).description === 'Home insurance');
    expect(Number((insurance as { annualAmount?: number }).annualAmount)).toBeCloseTo(2_400, 2); // NOT 28,800
    // No expense's annual figure exceeds its monthly-cap unless it is genuinely
    // sub-monthly (weekly/fortnightly) — a guard against a converter regression.
    for (const r of t.rows) {
      const row = r as { amount: number; frequency: string; annualAmount: number };
      if (['ANNUAL', 'QUARTERLY', 'HALF_YEARLY', 'MONTHLY'].includes(row.frequency)) {
        expect(row.annualAmount).toBeLessThanOrEqual(row.amount * 12 + 0.01);
      }
    }
  });
});

describe('MON-034 downstream (§19.4) — the TAX-TIME report inherits the fix (deductions not inflated)', () => {
  // taxTime.ts computes deductibleExpenses/totalDeductions/netTaxableIncome from
  // the SAME context.expenses[].annualAmount the fix corrects. Golden expenses
  // are all non-deductible, so this drives the tax path with a minimal context
  // whose deductible ANNUAL expense is annualised by the REAL toAnnual (the fix).
  const minimalContext = (deductibleAnnualAmount: number): ReportContext =>
    ({
      userId: 'tax-fixture',
      periodStart: new Date(0),
      periodEnd: new Date(0),
      incomes: [],
      expenses: [
        {
          id: 'x1', description: 'Annual PI insurance', category: 'INSURANCE',
          amount: 2_400, frequency: 'ANNUAL', annualAmount: deductibleAnnualAmount,
          linkedPropertyName: null, isDeductible: true,
        },
      ],
      depreciationSchedules: [],
      properties: [],
    }) as unknown as ReportContext;

  const totalDeductionsMetric = (annualAmount: number) => {
    const sections = generateTaxTimeReport(minimalContext(annualAmount), { type: 'tax-time' } as never);
    const summary = sections.find((s) => s.id === 'tax-summary') as MetricSection;
    return summary.metrics.find((m) => m.label === 'Total Deductions')?.value;
  };

  it('a deductible $2,400/yr ANNUAL expense deducts $2,400 (via the fixed toAnnual), not $28,800', () => {
    const correct = toAnnual(2_400, 'ANNUAL'); // the fix: 2,400
    expect(correct).toBe(2_400);
    expect(totalDeductionsMetric(correct)).toBe(formatCurrency(2_400));
    // Negative control: the OLD bug's value (2,400×12) would have shown 28,800 —
    // proving the metric faithfully reflects the source annualAmount.
    expect(totalDeductionsMetric(2_400 * 12)).toBe(formatCurrency(28_800));
  });
});
