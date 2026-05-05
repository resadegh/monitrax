/**
 * Trust distribution (Div 6 basic) tests — Phase 41e.1 slice C.
 *
 * Pins the s95 / s97 / s99A contract:
 *   - Net income allocated proportionally to presently-entitled
 *     beneficiaries
 *   - Undistributed residual → trustee at s99A 47% penalty rate
 *   - s100A risk always flagged as UNCOMPUTED (zone classifier 41e.5)
 *   - Div 6E character streaming always flagged (lands 41e.4)
 *   - s98 trustee assessment flagged when any beneficiary is
 *     non-resident or under legal disability
 */

import { describe, it, expect } from 'vitest';
import {
  allocateTrustDistribution,
  getDistributableAmount,
  S99A_TRUSTEE_PENALTY_RATE,
} from '@/lib/tax-engine/divisions/trustDistribution';

describe('allocateTrustDistribution — basic distribution', () => {
  it('100% to single beneficiary → full net income flows', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'Sarah', presentlyEntitledShare: 1.0 },
      ],
    });
    expect(r.distributions.length).toBe(1);
    expect(r.distributions[0].amount).toBe(100000);
    expect(r.distributions[0].share).toBe(1.0);
    expect(r.trusteeRetainedAmount).toBe(0);
    expect(r.trusteePenaltyTax).toBe(0);
    expect(r.totalAccountedFor).toBe(100000);
  });

  it('split 50/50 between two beneficiaries', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 200000,
      beneficiaries: [
        { id: 'b1', name: 'David', presentlyEntitledShare: 0.5 },
        { id: 'b2', name: 'Emma', presentlyEntitledShare: 0.5 },
      ],
    });
    expect(r.distributions[0].amount).toBe(100000);
    expect(r.distributions[1].amount).toBe(100000);
    expect(r.trusteeRetainedAmount).toBe(0);
  });

  it('split 60/30/10 across three beneficiaries', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'A', presentlyEntitledShare: 0.6 },
        { id: 'b2', name: 'B', presentlyEntitledShare: 0.3 },
        { id: 'b3', name: 'C', presentlyEntitledShare: 0.1 },
      ],
    });
    expect(r.distributions[0].amount).toBeCloseTo(60000, 6);
    expect(r.distributions[1].amount).toBeCloseTo(30000, 6);
    expect(r.distributions[2].amount).toBeCloseTo(10000, 6);
    expect(r.totalAccountedFor).toBeCloseTo(100000, 6);
  });
});

describe('allocateTrustDistribution — s99A penalty (no/partial entitlement)', () => {
  it('NO beneficiary presently entitled → ENTIRE amount taxed at 47% trustee rate', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [],
    });
    expect(r.distributions).toEqual([]);
    expect(r.trusteeRetainedAmount).toBe(100000);
    expect(r.trusteePenaltyTax).toBeCloseTo(47000, 6);
    // s99A citation should be present
    expect(r.citations.some((c) => c.reference === 's99A')).toBe(true);
  });

  it('PARTIAL entitlement (60%) → 40% retained at trustee rate', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'A', presentlyEntitledShare: 0.6 },
      ],
    });
    expect(r.distributions[0].amount).toBe(60000);
    expect(r.trusteeRetainedAmount).toBe(40000);
    expect(r.trusteePenaltyTax).toBeCloseTo(40000 * 0.47, 6);
    expect(r.totalAccountedFor).toBe(100000);
  });

  it('penalty tax constant exposed', () => {
    expect(S99A_TRUSTEE_PENALTY_RATE).toBe(0.47);
  });
});

describe('allocateTrustDistribution — validation errors', () => {
  it('negative share throws', () => {
    expect(() =>
      allocateTrustDistribution({
        trustNetIncome: 100000,
        beneficiaries: [
          { id: 'b1', name: 'X', presentlyEntitledShare: -0.5 },
        ],
      }),
    ).toThrow(/negative share/);
  });

  it('shares summing > 1.0 throws (deed over-distribution)', () => {
    expect(() =>
      allocateTrustDistribution({
        trustNetIncome: 100000,
        beneficiaries: [
          { id: 'b1', name: 'A', presentlyEntitledShare: 0.6 },
          { id: 'b2', name: 'B', presentlyEntitledShare: 0.6 },
        ],
      }),
    ).toThrow(/over-distribution/);
  });

  it('shares summing exactly 1.0 with floating-point noise → ok', () => {
    // 1/3 + 1/3 + 1/3 = 0.999... which exceeds 1.0 by ~1e-16. The
    // tolerance in the validation (1e-9) prevents this from throwing.
    expect(() =>
      allocateTrustDistribution({
        trustNetIncome: 100000,
        beneficiaries: [
          { id: 'b1', name: 'A', presentlyEntitledShare: 1 / 3 },
          { id: 'b2', name: 'B', presentlyEntitledShare: 1 / 3 },
          { id: 'b3', name: 'C', presentlyEntitledShare: 1 / 3 },
        ],
      }),
    ).not.toThrow();
  });
});

describe('allocateTrustDistribution — UNCOMPUTED flags', () => {
  it('always flags UC-S100A-RISK (zone classifier 41e.5)', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 1.0 }],
    });
    expect(r.uncomputed.some((u) => u.id === 'UC-S100A-RISK')).toBe(true);
  });

  it('UC-S100A-RISK rationale differs for FTE vs non-FTE trusts', () => {
    const fte = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 1.0 }],
      hasFamilyTrustElection: true,
    });
    const nonFte = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 1.0 }],
      hasFamilyTrustElection: false,
    });
    const fteFlag = fte.uncomputed.find((u) => u.id === 'UC-S100A-RISK')!;
    const nonFteFlag = nonFte.uncomputed.find((u) => u.id === 'UC-S100A-RISK')!;
    expect(fteFlag.rationale).toMatch(/Family Trust Election/);
    expect(nonFteFlag.rationale).toMatch(/non-FTE/);
  });

  it('always flags UC-DIV-6E-STREAMING (character allocation 41e.4)', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 1.0 }],
    });
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV-6E-STREAMING')).toBe(true);
  });

  it('flags UC-S98-TRUSTEE-ASSESSMENT when a beneficiary is non-resident/disabled', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'Resident', presentlyEntitledShare: 0.5 },
        {
          id: 'b2',
          name: 'NonResident',
          presentlyEntitledShare: 0.5,
          isNonResidentOrDisabled: true,
        },
      ],
    });
    expect(r.uncomputed.some((u) => u.id === 'UC-S98-TRUSTEE-ASSESSMENT')).toBe(true);
    expect(r.distributions[1].trusteeAssessedUnderS98).toBe(true);
    expect(r.distributions[0].trusteeAssessedUnderS98).toBe(false);
  });

  it('does NOT flag UC-S98 when all beneficiaries are residents', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 1.0 }],
    });
    expect(r.uncomputed.find((u) => u.id === 'UC-S98-TRUSTEE-ASSESSMENT')).toBeUndefined();
  });
});

describe('allocateTrustDistribution — citations', () => {
  it('always includes ITAA 1936 s95 + s97', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 1.0 }],
    });
    expect(r.citations.some((c) => c.reference === 's95')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's97')).toBe(true);
  });

  it('adds s99A only when there is trustee-retained income', () => {
    const fullDistribution = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 1.0 }],
    });
    expect(fullDistribution.citations.some((c) => c.reference === 's99A')).toBe(false);

    const partialDistribution = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 0.5 }],
    });
    expect(partialDistribution.citations.some((c) => c.reference === 's99A')).toBe(true);
  });
});

describe('getDistributableAmount helper', () => {
  it('returns total minus trustee-retained', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'A', presentlyEntitledShare: 0.6 },
      ],
    });
    expect(getDistributableAmount(r)).toBe(60000);
  });

  it('zero when nothing distributed', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [],
    });
    expect(getDistributableAmount(r)).toBe(0);
  });
});

describe('allocateTrustDistribution — edge cases', () => {
  it('zero trust net income → no distributions, no penalty', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 0,
      beneficiaries: [],
    });
    expect(r.trusteeRetainedAmount).toBe(0);
    expect(r.trusteePenaltyTax).toBe(0);
    expect(r.totalAccountedFor).toBe(0);
  });

  it('zero net income with beneficiaries → zero amounts', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 0,
      beneficiaries: [
        { id: 'b1', name: 'A', presentlyEntitledShare: 1.0 },
      ],
    });
    expect(r.distributions[0].amount).toBe(0);
  });
});

describe('Phase 41e.4 — Div 6E character streaming', () => {
  it('without streaming inputs → character flows pro-rata; UC-DIV-6E-STREAMING surfaces', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'A', presentlyEntitledShare: 0.5 },
        { id: 'b2', name: 'B', presentlyEntitledShare: 0.5 },
      ],
      characterPools: { frankedDividends: 30000, capitalGains: 20000 },
    });
    // Pro-rata: each beneficiary gets 50% of each pool
    expect(r.distributions[0].character.frankedDividends).toBe(15000);
    expect(r.distributions[0].character.capitalGains).toBe(10000);
    expect(r.distributions[0].character.ordinaryIncome).toBe(25000);
    // UC-DIV-6E-STREAMING still flagged (no streaming requested)
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV-6E-STREAMING')).toBe(true);
  });

  it('valid streaming → explicit allocation; UC-DIV-6E-STREAMING flag DISAPPEARS', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        {
          id: 'high-income',
          name: 'David',
          presentlyEntitledShare: 0.5,
          // Stream all franked dividends to David (high marginal rate
          // → maximum benefit from franking credits)
          streaming: { frankedDividends: 30000 },
        },
        {
          id: 'low-income',
          name: 'Emma',
          presentlyEntitledShare: 0.5,
          // Stream the capital gains to Emma (50% discount → benefit
          // amplified vs ordinary income at her marginal rate)
          streaming: { capitalGains: 20000 },
        },
      ],
      characterPools: { frankedDividends: 30000, capitalGains: 20000 },
      streamingResolutionAt: '2025-06-29', // before 30 June FY24-25
      financialYear: '2024-25',
    });
    // David: $50k amount, with $30k franked, $0 cgt, $20k ordinary
    expect(r.distributions[0].character.frankedDividends).toBe(30000);
    expect(r.distributions[0].character.capitalGains).toBe(0);
    // Emma: $50k amount, $0 franked, $20k cgt, $30k ordinary
    expect(r.distributions[1].character.frankedDividends).toBe(0);
    expect(r.distributions[1].character.capitalGains).toBe(20000);
    // UC-DIV-6E-STREAMING flag is GONE (replaced by valid streaming)
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV-6E-STREAMING')).toBe(false);
    // Citations now include Div 6E + s207-58 + s115-228
    expect(r.citations.some((c) => c.reference === 'Div 6E')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's207-58')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's115-228')).toBe(true);
  });

  it('streaming with invalid resolution date (post-30-June) → falls back to pro-rata + UC-DIV-6E-STREAMING-INVALID-RESOLUTION', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        {
          id: 'b1',
          name: 'A',
          presentlyEntitledShare: 1.0,
          streaming: { frankedDividends: 30000 },
        },
      ],
      characterPools: { frankedDividends: 30000 },
      streamingResolutionAt: '2025-08-15', // AFTER FY24-25 (post 30 June 2025)
      financialYear: '2024-25',
    });
    // Streaming ignored — pro-rata applies
    expect(r.distributions[0].character.frankedDividends).toBe(30000); // happens to match because 100% beneficiary
    expect(
      r.uncomputed.some((u) => u.id === 'UC-DIV-6E-STREAMING-INVALID-RESOLUTION'),
    ).toBe(true);
    // Streaming citations NOT added
    expect(r.citations.some((c) => c.reference === 's207-58')).toBe(false);
  });

  it('streaming with missing characterPools → falls back to pro-rata flag', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        {
          id: 'b1',
          name: 'A',
          presentlyEntitledShare: 1.0,
          streaming: { frankedDividends: 5000 },
        },
      ],
      // characterPools missing → streaming silently ignored
      streamingResolutionAt: '2025-06-29',
      financialYear: '2024-25',
    });
    // No character to stream → all ordinary
    expect(r.distributions[0].character.frankedDividends).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV-6E-STREAMING')).toBe(true);
  });

  it('character composition sums to amount', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'A', presentlyEntitledShare: 0.6 },
        { id: 'b2', name: 'B', presentlyEntitledShare: 0.4 },
      ],
      characterPools: { frankedDividends: 30000, capitalGains: 20000 },
    });
    for (const d of r.distributions) {
      const sum =
        d.character.frankedDividends +
        d.character.capitalGains +
        d.character.ordinaryIncome;
      expect(sum).toBeCloseTo(d.amount, 2);
    }
  });

  it('without characterPools at all → all character is 0; full amount is ordinary', () => {
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [{ id: 'b1', name: 'A', presentlyEntitledShare: 1.0 }],
    });
    expect(r.distributions[0].character.frankedDividends).toBe(0);
    expect(r.distributions[0].character.capitalGains).toBe(0);
    expect(r.distributions[0].character.ordinaryIncome).toBe(100000);
  });
});
