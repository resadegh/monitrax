import { describe, it, expect } from 'vitest';
import {
  buildBackedValues,
  verifyNarrativeFigures,
  groundNarrative,
} from '@/lib/neobrain/verifyNarrativeFigures';

/**
 * Neobrain Phase C — free-text figure verifier. Pins the narrative
 * anti-hallucination guarantee: a $ / % figure that doesn't trace to a real,
 * given value (or a safe derivation) is redacted, and legitimate arithmetic is
 * NOT false-flagged. Pure → deterministic.
 */

describe('buildBackedValues', () => {
  it('includes the value, its annualisation (×12), and roundings', () => {
    const b = buildBackedValues([5000]);
    expect(b).toContain(5000);
    expect(b).toContain(60000); // ×12 (annual)
  });
});

describe('verifyNarrativeFigures', () => {
  it('keeps a backed amount and redacts an invented one', () => {
    const backed = buildBackedValues([5000, 3200]);
    const r = verifyNarrativeFigures('You earn $5,000 but somehow spent $9,999.', backed, []);
    expect(r.redactedText).toContain('$5,000');
    expect(r.redactedText).toContain('an unverified amount');
    expect(r.redactedText).not.toContain('$9,999');
    expect(r.unbacked).toEqual(['$9,999']);
  });

  it('accepts an annualised derivation (×12) without flagging it', () => {
    const r = verifyNarrativeFigures('That is $60,000 per year.', buildBackedValues([5000]), []);
    expect(r.unbacked).toHaveLength(0);
    expect(r.redactedText).toContain('$60,000');
  });

  it('separates $ from %: a 50% rate is NOT backed by a $50 amount', () => {
    const r = verifyNarrativeFigures('Save 50% of it.', buildBackedValues([50]), [20]);
    expect(r.redactedText).toContain('an unverified rate');
    expect(r.unbacked).toEqual(['50%']);
  });

  it('keeps a backed percent within tolerance', () => {
    const r = verifyNarrativeFigures('Your savings rate is 20%.', [], [20]);
    expect(r.redactedText).toContain('20%');
    expect(r.unbacked).toHaveLength(0);
  });
});

describe('groundNarrative', () => {
  it('leaves a fully-backed summary unchanged (no note)', () => {
    const out = groundNarrative('You earn $5,000 a month.', [5000], []);
    expect(out.redactedCount).toBe(0);
    expect(out.text).not.toContain('could not be verified');
  });

  it('redacts the unbacked figure and appends the caveat note', () => {
    const out = groundNarrative('You earn $5,000 and also $9,999.', [5000], []);
    expect(out.redactedCount).toBe(1);
    expect(out.text).toContain('an unverified amount');
    expect(out.text).toContain('could not be verified');
  });
});
