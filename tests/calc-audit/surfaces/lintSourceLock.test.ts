/**
 * Calc-SSOT Wall A1 — source-lock lint unit + live-repo gate tests.
 *
 * Unit: `scanSourceLock()` over synthetic content (detection + annotation).
 * Ratchet: `applyRatchet()` fails on BOTH overage (new bypass) and stale
 *   (paid-down debt whose count wasn't decremented) — the count can only fall.
 * Live: the real repo must be exactly at its tracked debt counts, so this
 *   suite goes red whenever `npm run lint:source-lock` would fail the build.
 */
import { describe, it, expect } from 'vitest';
import {
  scanSourceLock,
  applyRatchet,
  runSourceLock,
  type SourceLockException,
} from '@/scripts/lint-source-lock';

const F = 'app/dashboard/test/page.tsx';

describe('Wall A1 — source-lock detectors', () => {
  it('flags inline toMonthly(row.amount, row.frequency) over a raw row (bypasses the one-off gate)', () => {
    const v = scanSourceLock(F, 'const m = expenses.reduce((s, e) => s + toMonthly(e.amount, e.frequency as Frequency), 0);');
    expect(v.some((x) => x.pattern === 'RAW_FREQ_RUN_RATE')).toBe(true);
  });

  it('flags toAnnual with a cast between amount and frequency', () => {
    const v = scanSourceLock(F, 'const a = toAnnual(inc.amount as number, inc.frequency);');
    expect(v.some((x) => x.pattern === 'RAW_FREQ_RUN_RATE')).toBe(true);
  });

  it('does NOT flag the canonical run-rate helpers', () => {
    const v = scanSourceLock(F, 'const m = monthlyRunRate(e); const a = annualRunRate(e);');
    expect(v).toHaveLength(0);
  });

  it('does NOT flag toMonthly over DIFFERENT rows (not a raw-row run-rate)', () => {
    const v = scanSourceLock(F, 'const m = toMonthly(base.amount, other.frequency);');
    expect(v.some((x) => x.pattern === 'RAW_FREQ_RUN_RATE')).toBe(false);
  });

  it('flags raw minRepayment cost reads (interest-only loans read as $0)', () => {
    const v = scanSourceLock(F, 'const cost = loan.minRepayment || 0;');
    expect(v.some((x) => x.pattern === 'RAW_MIN_REPAYMENT_COST')).toBe(true);
  });

  it('flags .reduce-sums over raw income/expense/loan arrays', () => {
    for (const line of [
      'const t = loans.reduce((s, l) => s + l.principal, 0);',
      'const t = allExpenses.reduce((s, e) => s + e.amount, 0);',
      'const t = data.incomes.reduce((s, i) => s + i.amount, 0);',
    ]) {
      const v = scanSourceLock(F, line);
      expect(v.some((x) => x.pattern === 'RAW_ARRAY_REDUCE_SUM')).toBe(true);
    }
  });

  it('does NOT flag reduces over canonical-producer OUTPUTS (loanLines, expenseLines)', () => {
    const v = scanSourceLock(F, 'const t = cf.loanLines.reduce((s, l) => s + l.monthly, 0);');
    expect(v.some((x) => x.pattern === 'RAW_ARRAY_REDUCE_SUM')).toBe(false);
  });

  it('honours the @source-lock-allowed annotation (recorded, not failed)', () => {
    const v = scanSourceLock(
      F,
      'const cost = loan.minRepayment; // @source-lock-allowed: edit-form initial value, not a cost read',
    );
    expect(v).toHaveLength(1);
    expect(v[0].annotated).toBe(true);
    expect(v[0].annotationReason).toContain('edit-form');
  });
});

describe('Wall A1 — ratchet-down-only exception model', () => {
  const exceptions: SourceLockException[] = [
    { file: F, pattern: 'RAW_MIN_REPAYMENT_COST', count: 2 },
  ];
  const mk = (n: number) =>
    scanSourceLock(F, Array.from({ length: n }, () => 'const c = loan.minRepayment;').join('\n'));

  it('exact count → clean (no overage, no stale)', () => {
    const r = applyRatchet(mk(2), exceptions);
    expect(r.overages).toHaveLength(0);
    expect(r.stale).toHaveLength(0);
  });

  it('one MORE match than allowed → overage (new bypass fails the build)', () => {
    const r = applyRatchet(mk(3), exceptions);
    expect(r.overages).toHaveLength(1);
    expect(r.overages[0]).toMatchObject({ allowed: 2, actual: 3 });
  });

  it('one FEWER match than allowed → stale (paid-down debt must be ratcheted down)', () => {
    const r = applyRatchet(mk(1), exceptions);
    expect(r.stale).toHaveLength(1);
    expect(r.stale[0]).toMatchObject({ allowed: 2, actual: 1 });
  });

  it('matches with NO entry at all → overage against an allowance of 0', () => {
    const r = applyRatchet(mk(1), []);
    expect(r.overages).toHaveLength(1);
    expect(r.overages[0].allowed).toBe(0);
  });

  it('annotated matches never count against the debt', () => {
    const v = scanSourceLock(
      F,
      'const c = loan.minRepayment; // @source-lock-allowed: form field\nconst d = loan.minRepayment;\nconst e = loan.minRepayment;',
    );
    const r = applyRatchet(v, exceptions);
    expect(r.overages).toHaveLength(0);
    expect(r.stale).toHaveLength(0);
  });
});

describe('Wall A1 — live repo is exactly at its tracked debt (the CI gate)', () => {
  it('no new bypasses and no un-ratcheted paid-down debt', () => {
    const { ratchet } = runSourceLock();
    const fmt = (rows: Array<{ file: string; pattern: string; allowed: number; actual: number }>) =>
      rows.map((r) => `${r.file} [${r.pattern}] allowed ${r.allowed} found ${r.actual}`).join('\n');
    expect(ratchet.overages, `NEW source-lock bypass(es):\n${fmt(ratchet.overages)}`).toHaveLength(0);
    expect(ratchet.stale, `Ratchet down paid debt in .audit/source-lock-exceptions.json:\n${fmt(ratchet.stale)}`).toHaveLength(0);
  });
});
