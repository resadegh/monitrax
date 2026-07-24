/**
 * MON-077 — the "Potential Missed Deductions" advisory must reconcile with
 * the canonical tax position, never contradict it (§12.2.1; VR-009 finding).
 *
 * Since MON-045 (#1425), property loan interest is AUTO-CLAIMED into
 * `taxPosition.deductions.property` straight from the loans — no logged
 * INTEREST expense row exists or is needed. The pre-fix heuristic read raw
 * expense rows and told the user "Loan interest for X" was missed for every
 * loan-bearing investment property (Thornland Lot 1/Lot 2, Broadbeach),
 * directly under a deductions figure that already included it.
 */
import { describe, it, expect } from 'vitest';
import { identifyMissedDeductions } from '../../lib/cfo/decisionSupport/taxIntegration';

const prop = (id: string, name: string, loans: unknown[] = []) => ({
  id, name, type: 'INVESTMENT', loans,
});

describe('MON-077 · missed-deductions advisory reconciles with MON-045 auto-claimed interest', () => {
  it('an investment property WITH a loan and NO logged INTEREST expense row does NOT produce "Loan interest for X" (RED on pre-fix code)', () => {
    const missed = identifyMissedDeductions(
      [], // no expense rows at all — post-MON-045 the interest is auto-derived
      [prop('p1', 'Thornland Lot 1', [{ id: 'l1' }]), prop('p2', 'Broadbeach', [{ id: 'l2' }])],
      [{ propertyId: 'p1' }, { propertyId: 'p2' }], // schedules exist → no depreciation nudge
    );
    expect(missed.some((m) => m.includes('Loan interest'))).toBe(false);
  });

  it('the GENUINE gaps still surface: depreciation without a schedule + work-related without rows', () => {
    const missed = identifyMissedDeductions(
      [],
      [prop('p1', 'Thornland Lot 1', [{ id: 'l1' }])],
      [], // no schedule
    );
    expect(missed).toContain('Depreciation for Thornland Lot 1');
    expect(missed.some((m) => m.includes('Work-related'))).toBe(true);
  });

  it('work-related nudge clears when deductible work rows exist; depreciation clears with a schedule', () => {
    const missed = identifyMissedDeductions(
      [{ isTaxDeductible: true, category: 'WORK' }],
      [prop('p1', 'Thornland Lot 1', [{ id: 'l1' }])],
      [{ propertyId: 'p1' }],
    );
    expect(missed).toHaveLength(0);
  });
});
