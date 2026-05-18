/**
 * Phase 42 PR 6.5d — Anomaly narrator tests.
 *
 * The deterministic fallback path is pure + DB-independent, so it's
 * the natural unit-test target. The Anthropic-narrated path is
 * integration-tested via Vercel preview (cost-controlled, real LLM
 * calls in unit tests would be slow + non-deterministic).
 */

import { describe, it, expect } from 'vitest';
import { renderDeterministicNarrative } from '@/lib/bookkeeping/engagement/anomalyNarrator';

const sampleAnomaly = (overrides: Partial<Parameters<typeof renderDeterministicNarrative>[0]> = {}) => ({
  merchant: 'Netflix',
  flag: 'PRICE_INCREASE' as const,
  amount: 17.99,
  dateLabel: 'Tuesday',
  ...overrides,
});

describe('Phase 42 PR 6.5d — renderDeterministicNarrative', () => {
  it('PRICE_INCREASE returns the "went up" copy with merchant name', () => {
    const out = renderDeterministicNarrative(sampleAnomaly({ merchant: 'Netflix', flag: 'PRICE_INCREASE' }));
    expect(out).toBe('Netflix went up — review the latest charge.');
  });

  it('UNUSUAL_AMOUNT returns the "unusual amount" copy', () => {
    const out = renderDeterministicNarrative(sampleAnomaly({ merchant: 'Coles', flag: 'UNUSUAL_AMOUNT' }));
    expect(out).toBe('Unusual amount on Coles — worth a glance.');
  });

  it('NEW_MERCHANT returns the "first time" copy', () => {
    const out = renderDeterministicNarrative(sampleAnomaly({ merchant: 'Bunnings', flag: 'NEW_MERCHANT' }));
    expect(out).toBe(`First time we've seen Bunnings.`);
  });

  it('DUPLICATE returns the "possible duplicate" copy', () => {
    const out = renderDeterministicNarrative(sampleAnomaly({ merchant: 'Telstra', flag: 'DUPLICATE' }));
    expect(out).toBe('Possible duplicate near Telstra.');
  });

  it('TIMING_ANOMALY returns the "unusual time" copy', () => {
    const out = renderDeterministicNarrative(sampleAnomaly({ merchant: 'AGL', flag: 'TIMING_ANOMALY' }));
    expect(out).toBe('AGL hit at an unusual time.');
  });

  it('UNEXPECTED_CATEGORY returns the "doesn\'t match" copy', () => {
    const out = renderDeterministicNarrative(sampleAnomaly({ merchant: 'Apple', flag: 'UNEXPECTED_CATEGORY' }));
    expect(out).toBe(`Apple doesn't match its usual category.`);
  });

  it('returns null for an unknown flag (defensive — no manufactured copy)', () => {
    const out = renderDeterministicNarrative(sampleAnomaly({ flag: 'SOMETHING_NEW' }));
    expect(out).toBeNull();
  });
});

describe('Phase 42 PR 6.5d — narrative copy never uses advice verbs (D-2 wall)', () => {
  // The deterministic path must NEVER use recommendation verbs.
  // The LLM is also instructed not to, but the deterministic
  // fallback is the wall when the LLM fails.
  const flags = [
    'PRICE_INCREASE',
    'UNUSUAL_AMOUNT',
    'NEW_MERCHANT',
    'DUPLICATE',
    'TIMING_ANOMALY',
    'UNEXPECTED_CATEGORY',
  ];

  it.each(flags)('%s narrative contains no advice verbs', (flag) => {
    const out = renderDeterministicNarrative(sampleAnomaly({ flag }));
    if (out === null) return;
    const lower = out.toLowerCase();
    expect(lower).not.toMatch(/\byou should\b/);
    expect(lower).not.toMatch(/\bconsider \w/);
    expect(lower).not.toMatch(/\bi recommend\b/);
    expect(lower).not.toMatch(/\bact now\b/);
    expect(lower).not.toMatch(/\burgent\b/);
  });
});
