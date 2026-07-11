/**
 * MON-017 — the Safety Net score must reflect reality, not fiction
 * (§19.2 worked examples + §19.4 canonical-source guard).
 *
 * WHAT WAS WRONG (on real data): the score awarded "Positive Cashflow 15/15"
 * while the real cashflow was −$6,073/mo (mixed source: declared income − actual
 * outflow), "Bills on time 30/30" for ZERO tracked bills, and measured the
 * emergency fund against a hardcoded 3-month target while the master snapshot
 * uses 6 — so a fragile position scored ~100/100.
 *
 * THE FIX: one pure engine (`computeSafetyScore`) on CANONICAL inputs — the
 * emergency-fund coverage/target from `snapshot.emergencyFund` and the
 * actuals-aware `quickMetrics.monthlyCashflow`.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { computeSafetyScore } from '../../lib/calculations/safetyScore';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-017: computeSafetyScore reflects reality', () => {
  it("Reza's fiction case: 11.7mo fund, 0 bills, −$6,073 cashflow → NOT 100", () => {
    const s = computeSafetyScore({
      monthsCovered: 11.7,
      targetMonths: 6,
      billsOnTime: 0,
      totalBills: 0,
      monthlyCashflow: -6073,
    });
    // Emergency fund capped at 40 (11.7 ≥ 6); bills 0 (no tracked bills);
    // noNewDebt 15 (optimistic placeholder); cashflow 0 (real deficit).
    expect(s.emergencyFund.score).toBe(40);
    expect(s.billsOnTime.score).toBe(0);
    expect(s.positiveCashflow.score).toBe(0);
    expect(s.total).toBe(55); // 40 + 0 + 15 + 0 — was falsely ~100
    expect(s.grade).toBe('FRAGILE');
  });

  it('a real deficit (≤ −$200) scores the cashflow dimension 0 (was 15/15)', () => {
    expect(computeSafetyScore({ monthsCovered: 6, targetMonths: 6, billsOnTime: 0, totalBills: 0, monthlyCashflow: -6073 }).positiveCashflow.score).toBe(0);
  });

  it('marginal deficit (−$200 < cashflow ≤ 0) scores 8; positive scores 15', () => {
    expect(computeSafetyScore({ monthsCovered: 0, targetMonths: 6, billsOnTime: 0, totalBills: 0, monthlyCashflow: -100 }).positiveCashflow.score).toBe(8);
    expect(computeSafetyScore({ monthsCovered: 0, targetMonths: 6, billsOnTime: 0, totalBills: 0, monthlyCashflow: 500 }).positiveCashflow.score).toBe(15);
  });

  it('zero tracked bills scores 0 (was a fabricated 30/30)', () => {
    expect(computeSafetyScore({ monthsCovered: 0, targetMonths: 6, billsOnTime: 0, totalBills: 0, monthlyCashflow: 0 }).billsOnTime.score).toBe(0);
  });

  it('tracked bills score proportionally (5/5 active → 30)', () => {
    expect(computeSafetyScore({ monthsCovered: 0, targetMonths: 6, billsOnTime: 5, totalBills: 5, monthlyCashflow: 0 }).billsOnTime.score).toBe(30);
  });

  it('emergency-fund dimension uses the canonical 6-month target', () => {
    // 3 months covered against a 6-month target = half of 40 = 20.
    expect(computeSafetyScore({ monthsCovered: 3, targetMonths: 6, billsOnTime: 0, totalBills: 0, monthlyCashflow: 0 }).emergencyFund.score).toBe(20);
  });

  it('a genuinely strong position still scores high', () => {
    const s = computeSafetyScore({ monthsCovered: 6, targetMonths: 6, billsOnTime: 4, totalBills: 4, monthlyCashflow: 2000 });
    expect(s.total).toBe(100); // 40 + 30 + 15 + 15
    expect(s.grade).toBe('STRONG');
  });
});

describe('MON-017: the /api/safety-net route reads canonical sources (§19.4 drift guard)', () => {
  const src = read('app/api/safety-net/route.ts');

  it('scores via the one engine, not inline fiction', () => {
    expect(src).toContain('computeSafetyScore({');
    // The old inline fabrications must be gone.
    expect(src).not.toContain('const targetMonths = 3');
    expect(src).not.toContain('billsOnTime / totalBills');
  });

  it('emergency fund + cashflow come from the canonical snapshot', () => {
    expect(src).toContain('snapshot.emergencyFund');
    expect(src).toContain('ef.targetMonths');
    expect(src).toContain('ef.monthsCovered');
    // Cashflow dimension reads the ACTUALS-FIRST canonical net (MON-017 residual,
    // VR-001: qm.monthlyCashflow is the DECLARED figure and read positive while
    // actual cashflow was −$6,073/mo → "Positive Cashflow 15/15" on a deficit).
    expect(src).toContain('const monthlySurplus = getCanonicalMonthlyCashflow(snapshot).net');
    expect(src).not.toContain('const monthlySurplus = qm.monthlyCashflow');
  });
});
