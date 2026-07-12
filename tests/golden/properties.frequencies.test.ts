/**
 * NeoAudit Ring 0-gen (NEOAUDIT.md §1.2) — property-based tests over the
 * frequency conversion primitives. fast-check generates thousands of inputs;
 * a violation shrinks to a minimal counter-example.
 *
 * These target the documented bug classes directly: unit confusion and the
 * ×12 / ×26 / ×52 conversions that produced the historical 100× errors.
 * Core `fast-check` with plain vitest (the @fast-check/vitest wrapper needs
 * vitest 4; we run 1.6).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { toMonthly, toAnnual } from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

const FREQS: Frequency[] = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'HALF_YEARLY'];
const amount = () => fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true });
const freq = () => fc.constantFrom(...FREQS);

describe('Ring 0-gen: frequency conversions hold their laws for any input', () => {
  it('annual = monthly × 12 for every amount and frequency', () => {
    fc.assert(
      fc.property(amount(), freq(), (a, f) => {
        expect(toAnnual(a, f)).toBeCloseTo(toMonthly(a, f) * 12, 6);
      }),
    );
  });

  it('is linear in amount: toMonthly(k·a) = k·toMonthly(a)', () => {
    fc.assert(
      fc.property(amount(), fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), freq(), (a, k, f) => {
        expect(toMonthly(a * k, f)).toBeCloseTo(toMonthly(a, f) * k, 6);
      }),
    );
  });

  it('identity anchors: MONTHLY→monthly and ANNUAL→annual are pass-through', () => {
    fc.assert(
      fc.property(amount(), (a) => {
        expect(toMonthly(a, 'MONTHLY')).toBeCloseTo(a, 6);
        expect(toAnnual(a, 'ANNUAL')).toBeCloseTo(a, 6);
      }),
    );
  });

  it('exact annual factors: weekly×52, fortnightly×26, quarterly×4, half-yearly×2', () => {
    fc.assert(
      fc.property(amount(), (a) => {
        expect(toAnnual(a, 'WEEKLY')).toBeCloseTo(a * 52, 6);
        expect(toAnnual(a, 'FORTNIGHTLY')).toBeCloseTo(a * 26, 6);
        expect(toAnnual(a, 'QUARTERLY')).toBeCloseTo(a * 4, 6);
        expect(toAnnual(a, 'HALF_YEARLY')).toBeCloseTo(a * 2, 6);
      }),
    );
  });

  it('never returns a negative for a non-negative amount', () => {
    fc.assert(
      fc.property(amount(), freq(), (a, f) => {
        expect(toMonthly(a, f)).toBeGreaterThanOrEqual(0);
        expect(toAnnual(a, f)).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});
