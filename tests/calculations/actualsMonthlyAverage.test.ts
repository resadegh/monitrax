/**
 * MON-089 Ratchet — the day-span monthly average has ONE producer:
 * `calculateMonthlyAverage` (lib/services/propertyActuals.ts).
 *
 * The bug class this locks out: FIVE inline copies of the same formula
 * existed (income route ARREARS branch, income route ADVANCE branch,
 * expenses route, loans route, link-route pattern banner). The income
 * ARREARS copy and the link-route copy divided N payments by the N−1
 * intervals of their date span — omitting the period the first payment
 * paid for — inflating the average ×N/(N−1). Reza's live case: two
 * $11,074 salaries 29 days apart (14 May + 12 Jun 2026) displayed as
 * $23,247/mo (+110%) instead of ≈$11,624.
 *
 * Ring 0: worked examples on the canonical producer (§19.2).
 * Ring 1: a topology lock asserting the migrated files no longer carry
 * their own `* 30.44` day-span math (re-inlining fails this suite).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { calculateMonthlyAverage, DAYS_PER_MONTH } from '../../lib/calculations/actualsMonthlyAverage';
import type { ActualTx } from '../../lib/calculations/actualsMonthlyAverage';

const tx = (date: string, amount: number): ActualTx => ({ date: new Date(date), amount });

describe('calculateMonthlyAverage — §19.2 worked examples (MON-089)', () => {
  it("Reza's Transport case: 2 × $11,074, 29 days apart → ≈$11,624/mo, NEVER $23,247", () => {
    const result = calculateMonthlyAverage([tx('2026-05-14', 11_074), tx('2026-06-12', 11_074)]);
    // span 29d + one 29d interval = 58 days covered → 22,148 / 58 × 30.44
    expect(result).toBeCloseTo((22_148 / 58) * DAYS_PER_MONTH, 2); // 11,622.93 — one canonical constant (365.25/12)
    // The pre-fix formula (sum / span × 30.44) produced 23,247.06 — locked out.
    expect(result!).toBeLessThan(12_000);
  });

  it('identity: N exactly-monthly payments of P average to P', () => {
    const MONTH_MS = DAYS_PER_MONTH * 24 * 60 * 60 * 1000;
    const base = new Date('2026-01-01').getTime();
    const payments = Array.from({ length: 6 }, (_, i) => ({
      date: new Date(base + i * MONTH_MS),
      amount: 5_000,
    }));
    expect(calculateMonthlyAverage(payments)!).toBeCloseTo(5_000, 6);
  });

  it('the Ingeus-class fortnightly cadence: 5 × ~$1,875 every 14 days → ≈$4,077/mo, not ×5/4', () => {
    const payments = [
      tx('2026-04-22', 1_875), tx('2026-05-06', 1_875), tx('2026-05-20', 1_875),
      tx('2026-06-03', 1_875), tx('2026-06-17', 1_875),
    ];
    // span 56d + 14d interval = 70 days → 9,375 / 70 × 30.44 = 4,076.79
    expect(calculateMonthlyAverage(payments)!).toBeCloseTo((9_375 / 70) * DAYS_PER_MONTH, 2);
  });

  it('ADVANCE (rent): trailing part-period payment excluded; monthly cadence still averages to P', () => {
    const MONTH_MS = DAYS_PER_MONTH * 24 * 60 * 60 * 1000;
    const base = new Date('2026-01-01').getTime();
    const payments = Array.from({ length: 3 }, (_, i) => ({
      date: new Date(base + i * MONTH_MS),
      amount: 2_600,
    }));
    expect(calculateMonthlyAverage(payments, true)!).toBeCloseTo(2_600, 6);
  });

  it('N=1 reads as one month; N=0 is null (unified across income/expenses/loans)', () => {
    expect(calculateMonthlyAverage([tx('2026-06-12', 11_074)])).toBe(11_074);
    expect(calculateMonthlyAverage([])).toBeNull();
  });

  it("MON-092 (Reza's gift case): SAME-DAY payments carry no cadence — total counted as one month, NEVER extrapolated", () => {
    // Two gifts on 18 May ($800 + $700). Pre-fix: span clamped to 1 day →
    // 1,500/2 × 30.44 = $22,830/mo phantom. Correct: no observable interval →
    // the total, one month's worth.
    const r = calculateMonthlyAverage([tx('2026-05-18', 800), tx('2026-05-18', 700)]);
    expect(r).toBe(1_500);
  });
});

describe('MON-092 topology lock — the ONE one-off label rule on every income/expense frequency render', () => {
  // The recurrence pattern this kills: the one-off label rule (MON-048) was
  // applied to ONE view while sibling renderings of the SAME row kept
  // printing the raw stored placeholder ("Monthly") — list view fixed in
  // MON-053, grouped view + detail panel + expenses column missed until a
  // one-off gift row showed "Monthly" for the third time (2026-07-20).
  it.each(['app/dashboard/income/page.tsx', 'app/dashboard/expenses/page.tsx'])(
    '%s renders no raw frequency label outside the activityFrequencyLabel gate',
    (file) => {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      // Every JSX-rendered `item.frequency.toLowerCase()` must sit on a line
      // that applies the gate; title/tooltip templates are exempt (prose).
      const offenders = src
        .split('\n')
        .filter((l) => l.includes('{item.frequency.toLowerCase()}'))
        .filter((l) => !l.includes('activityFrequencyLabel'))
        .filter((l) => !l.includes('title=')); // tooltip prose, not a label render
      expect(offenders).toEqual([]);
    },
  );
});

describe('MON-089 topology lock — no re-inlined day-span math in the migrated producers', () => {
  const migrated = [
    'app/api/income/route.ts',
    'app/api/expenses/route.ts',
    'app/api/loans/route.ts',
  ];

  it.each(migrated)('%s imports the canonical producer and carries no own × 30.44 math', (file) => {
    const src = readFileSync(join(process.cwd(), file), 'utf8');
    expect(src).toContain("import { calculateMonthlyAverage } from '@/lib/calculations/actualsMonthlyAverage'");
    expect(src).not.toMatch(/30\.44/);
  });

  it('the link route banner uses the canonical producer (monthsCovered display span may remain)', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/transactions/[id]/link/route.ts'), 'utf8');
    expect(src).toContain("import { calculateMonthlyAverage } from '@/lib/calculations/actualsMonthlyAverage'");
    expect(src).toMatch(/trueMonthlyAverage\s*=\s*\n?\s*calculateMonthlyAverage\(/);
  });
});
