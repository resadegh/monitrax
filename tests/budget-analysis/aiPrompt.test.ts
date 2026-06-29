import { describe, it, expect } from 'vitest';
import {
  groundVariableExpenseTotal,
  validateVariableExpenseResponse,
  calculateBenchmarkExpenses,
} from '@/lib/budget-analysis/aiPrompt';
import type { VariableExpenseResponse } from '@/lib/budget-analysis/types';

/**
 * Neobrain Phase C.2 — budget-analysis variable-estimation grounding.
 * Pins the rule that the headline variable total ALWAYS equals the sum of the
 * visible category estimates (never the AI's separately-stated, ±$50-tolerant
 * figure). Estimation stays the AI's job; the aggregate is deterministic.
 */

function baseResponse(overrides: Partial<VariableExpenseResponse> = {}): VariableExpenseResponse {
  return {
    categories: {
      GROCERIES: { estimate: 1200, confidence: 'high', reasoning: '2 adults' },
      FUEL: { estimate: 600, confidence: 'medium', reasoning: '2 cars' },
    },
    total: 1800,
    scenarios: {
      minimum: { total: 1400, description: 'min' },
      recommended: { total: 1800, description: 'rec' },
      comfortable: { total: 2300, description: 'comf' },
    },
    assumptions: [],
    explanation: 'x',
    ...overrides,
  };
}

describe('groundVariableExpenseTotal', () => {
  it('recomputes the total as the exact sum of the category estimates (drift case)', () => {
    // AI states 1820 but its categories sum to 1800 — within the $50 validator
    // tolerance, so it would otherwise be shown verbatim over a 1800 breakdown.
    const drifted = baseResponse({ total: 1820 });
    const grounded = groundVariableExpenseTotal(drifted);
    expect(grounded.total).toBe(1800); // 1200 + 600
  });

  it('leaves an already-consistent total unchanged', () => {
    const grounded = groundVariableExpenseTotal(baseResponse({ total: 1800 }));
    expect(grounded.total).toBe(1800);
  });

  it('is pure — does not mutate the input', () => {
    const input = baseResponse({ total: 9999 });
    groundVariableExpenseTotal(input);
    expect(input.total).toBe(9999);
  });

  it('handles empty categories → total 0', () => {
    const grounded = groundVariableExpenseTotal(baseResponse({ categories: {}, total: 500 }));
    expect(grounded.total).toBe(0);
  });

  it('leaves the scenario totals untouched (separate estimation axis)', () => {
    const grounded = groundVariableExpenseTotal(baseResponse({ total: 1900 }));
    expect(grounded.scenarios.recommended.total).toBe(1800);
    expect(grounded.scenarios.minimum.total).toBe(1400);
    expect(grounded.scenarios.comfortable.total).toBe(2300);
  });

  it('the grounded total equals the sum the user sees in the breakdown', () => {
    const r = baseResponse({
      categories: {
        GROCERIES: { estimate: 950, confidence: 'high', reasoning: '' },
        FUEL: { estimate: 320, confidence: 'medium', reasoning: '' },
        PET_COSTS: { estimate: 140, confidence: 'low', reasoning: '' },
      },
      total: 1500, // AI over-states by 90
    });
    const grounded = groundVariableExpenseTotal(r);
    const visibleSum = Object.values(grounded.categories).reduce((s, c) => s + c.estimate, 0);
    expect(grounded.total).toBe(visibleSum);
    expect(grounded.total).toBe(1410);
  });
});

describe('benchmark fallback is already self-grounded (total == its own category sum)', () => {
  it('calculateBenchmarkExpenses total equals the sum of its categories', () => {
    const r = calculateBenchmarkExpenses(
      {
        adultsCount: 2,
        childrenCount: 1,
        childrenAges: [8],
        petsCount: 1,
        petTypes: ['dog'],
        carsCount: 2,
        lifestylePreference: 'MODERATE',
      },
      new Set<string>()
    );
    const sum = Object.values(r.categories).reduce((s, c) => s + c.estimate, 0);
    // Benchmark rounds each category then sums into total separately, so allow
    // a tiny rounding band — the point is they are not allowed to diverge.
    expect(Math.abs(r.total - sum)).toBeLessThanOrEqual(Object.keys(r.categories).length);
  });
});

describe('validateVariableExpenseResponse (existing guard, unchanged)', () => {
  it('flags mis-ordered scenarios as invalid', () => {
    const bad = baseResponse({
      scenarios: {
        minimum: { total: 2000, description: 'min' },
        recommended: { total: 1800, description: 'rec' },
        comfortable: { total: 2300, description: 'comf' },
      },
    });
    const v = validateVariableExpenseResponse(bad, []);
    expect(v.valid).toBe(false);
  });

  it('accepts a well-formed response', () => {
    const v = validateVariableExpenseResponse(baseResponse(), []);
    expect(v.valid).toBe(true);
  });
});
