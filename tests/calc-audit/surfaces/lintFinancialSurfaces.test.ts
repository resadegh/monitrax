/**
 * Phase 41i.6b — Lint script unit tests.
 *
 * Tests `scanFile()` directly with synthetic content (no filesystem
 * walk) so we can assert pattern detection + annotation honouring +
 * baseline matching cleanly.
 *
 * Per spec doc §7 + §11 lint fixture matrix:
 *   - 10 positive cases — must FAIL the lint
 *   - 5 negative cases — must PASS (no false positives)
 *   - 5 annotated-exception cases — must PASS + record annotation
 */

import { describe, it, expect } from 'vitest';
import { scanFile } from '@/scripts/lint-financial-surfaces';

const FAKE_PATH = 'app/dashboard/test.tsx';

function detect(code: string): ReturnType<typeof scanFile> {
  return scanFile(FAKE_PATH, code);
}

describe('Phase 41i.6b — financial-math lint detector', () => {
  describe('Pattern 1 — inline frequency conversion (positive cases)', () => {
    it('flags `income.amount * 12` (weekly → monthly conversion)', () => {
      const v = detect('const annualIncome = income.amount * 12;');
      expect(v).toHaveLength(1);
      expect(v[0].pattern).toBe('FREQUENCY_CONVERSION');
      expect(v[0].annotated).toBe(false);
    });

    it('flags `expense.weekly * 52` (weekly → annual)', () => {
      const v = detect('const annualExpense = expense.weekly * 52;');
      expect(v.some((x) => x.pattern === 'FREQUENCY_CONVERSION')).toBe(true);
    });

    it('flags `salary * 26` (fortnightly → annual)', () => {
      const v = detect('const annualSalary = salary * 26;');
      expect(v.some((x) => x.pattern === 'FREQUENCY_CONVERSION')).toBe(true);
    });

    it('flags `revenue / 12` (annual → monthly division)', () => {
      const v = detect('const monthlyRevenue = revenue / 12;');
      expect(v.some((x) => x.pattern === 'FREQUENCY_CONVERSION')).toBe(true);
    });

    it('flags `cashflow.monthly * 365` (monthly → daily)', () => {
      const v = detect('const dailyCashflow = cashflow.monthly * 365;');
      expect(v.some((x) => x.pattern === 'FREQUENCY_CONVERSION')).toBe(true);
    });
  });

  describe('Pattern 2 — inline arithmetic on financial fields (positive cases)', () => {
    it('flags `total.income - total.expenses`', () => {
      const v = detect('const cashflow = total.income - total.expenses;');
      expect(v.some((x) => x.pattern === 'INLINE_ARITHMETIC')).toBe(true);
    });

    it('flags `revenue.gross + revenue.other`', () => {
      const v = detect('const revenueTotal = revenue.gross + revenue.other;');
      expect(v.some((x) => x.pattern === 'INLINE_ARITHMETIC')).toBe(true);
    });

    it('flags `assets.total - liabilities.total` (net worth math)', () => {
      const v = detect('const netWorth = assets.total - liabilities.total;');
      expect(v.some((x) => x.pattern === 'INLINE_ARITHMETIC')).toBe(true);
    });
  });

  describe('Pattern 3 — hardcoded financial constants (positive cases)', () => {
    it('flags hardcoded GST rate (0.10) when adjacent to a financial field', () => {
      const v = detect('const gst = revenue * 0.10;');
      expect(v.some((x) => x.pattern === 'HARDCODED_FINANCIAL_CONSTANT')).toBe(true);
    });

    it('flags hardcoded super cap (30000) when adjacent to a financial field', () => {
      const v = detect('if (income.contribution > 30000) { ... }');
      expect(v.some((x) => x.pattern === 'HARDCODED_FINANCIAL_CONSTANT')).toBe(true);
    });
  });

  describe('Negative cases — must NOT fire (no false positives)', () => {
    it('non-financial multiplication is fine (`page * 12` is not money)', () => {
      const v = detect('const startIndex = page * 12;');
      expect(v).toHaveLength(0);
    });

    it('non-financial subtraction is fine (`node.left - node.right`)', () => {
      const v = detect('const width = node.right - node.left;');
      expect(v).toHaveLength(0);
    });

    it('hardcoded literal NOT next to a financial field is fine', () => {
      const v = detect('const PAGE_SIZE = 0.10;');
      expect(v).toHaveLength(0);
    });

    it('UI sizing percentages are fine (no "income"/"revenue" on the line)', () => {
      const v = detect('const opacity = active ? 1.0 : 0.15;');
      expect(v).toHaveLength(0);
    });

    it('canonical helper invocation is fine', () => {
      const v = detect('const monthly = toMonthly(income.amount, "WEEKLY");');
      expect(v).toHaveLength(0);
    });
  });

  describe('Annotation honouring — must record but not fail', () => {
    it('honours `// @financial-math-allowed: <reason>` annotation', () => {
      const v = detect(
        'const monthly = income.amount / 12; // @financial-math-allowed: UI-only display formatting',
      );
      expect(v).toHaveLength(1);
      expect(v[0].annotated).toBe(true);
      expect(v[0].annotationReason).toBe('UI-only display formatting');
    });

    it('honours `/* @financial-math-allowed: <reason> */` block annotation', () => {
      const v = detect(
        'const x = revenue * 12; /* @financial-math-allowed: legacy migration */',
      );
      expect(v).toHaveLength(1);
      expect(v[0].annotated).toBe(true);
      expect(v[0].annotationReason).toBe('legacy migration');
    });

    it('annotation is case-insensitive on the marker', () => {
      const v = detect(
        'const x = income.amount * 12; // @FINANCIAL-MATH-ALLOWED: see PR #123',
      );
      expect(v).toHaveLength(1);
      expect(v[0].annotated).toBe(true);
    });

    it('annotation reason captures multi-word free text', () => {
      const v = detect(
        'const m = total.income - total.expenses; // @financial-math-allowed: net of GST credits per s9-30',
      );
      expect(v).toHaveLength(1);
      expect(v[0].annotated).toBe(true);
      expect(v[0].annotationReason).toContain('net of GST');
    });

    it('non-matching annotation comment does NOT mark as annotated', () => {
      const v = detect(
        'const m = revenue * 12; // some other comment',
      );
      expect(v).toHaveLength(1);
      expect(v[0].annotated).toBe(false);
    });
  });

  describe('Source-line context capture', () => {
    it('captures the full source line on every violation', () => {
      const code = '    const annualIncome = income.amount * 12;';
      const v = detect(code);
      expect(v[0].sourceLine).toBe(code);
    });

    it('reports correct line number for multi-line files', () => {
      const code = ['// header', 'function foo() {', '  const m = revenue * 12;', '}'].join('\n');
      const v = detect(code);
      expect(v).toHaveLength(1);
      expect(v[0].line).toBe(3);
    });

    it('reports column number 1-indexed', () => {
      const v = detect('const x = revenue * 12;');
      expect(v[0].column).toBeGreaterThan(1);
      // Column should point to "revenue", which starts at char 11 (1-indexed)
      expect(v[0].column).toBe(11);
    });
  });
});
