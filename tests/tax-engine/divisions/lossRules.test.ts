/**
 * Phase 41e.15 — Trust + company loss rules tests.
 */

import { describe, it, expect } from 'vitest';
import {
  applyTrustLossRules,
  type TrustLossInput,
} from '@/lib/tax-engine/divisions/trustLossRules';
import {
  applyCompanyLossRules,
  type CompanyLossInput,
} from '@/lib/tax-engine/divisions/companyLossRules';

describe('applyTrustLossRules — FAMILY_TRUST_FTE (only IIT applies)', () => {
  it('IIT pass → LOSSES_DEDUCTIBLE', () => {
    const r = applyTrustLossRules({
      trustType: 'FAMILY_TRUST_FTE',
      lossAmount: 50_000,
      testOutcomes: { incomeInjectionTest: 'PASS' },
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE');
    expect(r.deductibleLossAmount).toBe(50_000);
  });

  it('IIT fail → LOSSES_DENIED', () => {
    const r = applyTrustLossRules({
      trustType: 'FAMILY_TRUST_FTE',
      lossAmount: 50_000,
      testOutcomes: { incomeInjectionTest: 'FAIL' },
    });
    expect(r.outcome).toBe('LOSSES_DENIED');
    expect(r.deductibleLossAmount).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-TRUST-LOSS-DENIED')).toBe(true);
  });

  it('IIT not asserted → INCONCLUSIVE', () => {
    const r = applyTrustLossRules({
      trustType: 'FAMILY_TRUST_FTE',
      lossAmount: 50_000,
      testOutcomes: {},
    });
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect(r.uncomputed.some((u) => u.id === 'UC-TRUST-LOSS-INCONCLUSIVE')).toBe(true);
  });
});

describe('applyTrustLossRules — FIXED_TRUST (Div 266: 50% Stake + SBT + IIT)', () => {
  it('all three pass → LOSSES_DEDUCTIBLE', () => {
    const r = applyTrustLossRules({
      trustType: 'FIXED_TRUST',
      lossAmount: 100_000,
      testOutcomes: {
        fiftyPercentStakeTest: 'PASS',
        sameBusinessTest: 'PASS',
        incomeInjectionTest: 'PASS',
      },
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE');
  });

  it('SBT fail → LOSSES_DENIED', () => {
    const r = applyTrustLossRules({
      trustType: 'FIXED_TRUST',
      lossAmount: 100_000,
      testOutcomes: {
        fiftyPercentStakeTest: 'PASS',
        sameBusinessTest: 'FAIL',
        incomeInjectionTest: 'PASS',
      },
    });
    expect(r.outcome).toBe('LOSSES_DENIED');
  });
});

describe('applyTrustLossRules — NON_FIXED_TRUST (Div 267: all 4 tests)', () => {
  it('all 4 pass → LOSSES_DEDUCTIBLE', () => {
    const r = applyTrustLossRules({
      trustType: 'NON_FIXED_TRUST',
      lossAmount: 100_000,
      testOutcomes: {
        fiftyPercentStakeTest: 'PASS',
        patternOfDistributionsTest: 'PASS',
        controlTest: 'PASS',
        incomeInjectionTest: 'PASS',
      },
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE');
    expect(r.testReport).toHaveLength(4);
  });

  it('Pattern of Distributions fail → LOSSES_DENIED', () => {
    const r = applyTrustLossRules({
      trustType: 'NON_FIXED_TRUST',
      lossAmount: 100_000,
      testOutcomes: {
        fiftyPercentStakeTest: 'PASS',
        patternOfDistributionsTest: 'FAIL',
        controlTest: 'PASS',
        incomeInjectionTest: 'PASS',
      },
    });
    expect(r.outcome).toBe('LOSSES_DENIED');
  });
});

describe('applyTrustLossRules — EXCEPTED_TRUST (Div 268: no tests)', () => {
  it('excepted trust → LOSSES_DEDUCTIBLE without any tests', () => {
    const r = applyTrustLossRules({
      trustType: 'EXCEPTED_TRUST',
      lossAmount: 100_000,
      testOutcomes: {},
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE');
    expect(r.testReport).toHaveLength(0);
    expect(r.citations.some((c) => c.reference.includes('Div 268'))).toBe(true);
  });
});

describe('applyTrustLossRules — citations', () => {
  it('always cites Sch 2F', () => {
    const r = applyTrustLossRules({
      trustType: 'FAMILY_TRUST_FTE',
      lossAmount: 50_000,
      testOutcomes: { incomeInjectionTest: 'PASS' },
    });
    expect(r.citations.some((c) => c.reference.includes('Sch 2F'))).toBe(true);
  });
});

// =====================================================================
// COMPANY LOSS RULES — Div 165
// =====================================================================

describe('applyCompanyLossRules — COT pass', () => {
  it('COT pass → LOSSES_DEDUCTIBLE_VIA_COT', () => {
    const r = applyCompanyLossRules({
      priorYearLossAmount: 200_000,
      cotOutcome: 'PASS',
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE_VIA_COT');
    expect(r.deductibleLossAmount).toBe(200_000);
  });
});

describe('applyCompanyLossRules — COT fail → BCT fallback', () => {
  it('COT fail + SBT pass → LOSSES_DEDUCTIBLE_VIA_BCT', () => {
    const r = applyCompanyLossRules({
      priorYearLossAmount: 200_000,
      cotOutcome: 'FAIL',
      bctOutcome: 'PASS',
      bctTestType: 'SBT',
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE_VIA_BCT');
    expect(r.deductibleLossAmount).toBe(200_000);
    expect(r.uncomputed.some((u) => u.id === 'UC-COMPANY-LOSS-BCT-FACTUAL')).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s165-210'))).toBe(true);
  });

  it('COT fail + Similar Business pass → LOSSES_DEDUCTIBLE_VIA_BCT (s165-211)', () => {
    const r = applyCompanyLossRules({
      priorYearLossAmount: 200_000,
      cotOutcome: 'FAIL',
      bctOutcome: 'PASS',
      bctTestType: 'SIMILAR',
    });
    expect(r.outcome).toBe('LOSSES_DEDUCTIBLE_VIA_BCT');
    expect(r.citations.some((c) => c.reference.includes('s165-211'))).toBe(true);
  });

  it('COT fail + BCT fail → LOSSES_DENIED', () => {
    const r = applyCompanyLossRules({
      priorYearLossAmount: 200_000,
      cotOutcome: 'FAIL',
      bctOutcome: 'FAIL',
      bctTestType: 'SBT',
    });
    expect(r.outcome).toBe('LOSSES_DENIED');
    expect(r.deductibleLossAmount).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-COMPANY-LOSS-DENIED')).toBe(true);
  });

  it('COT fail + BCT not asserted → INCONCLUSIVE', () => {
    const r = applyCompanyLossRules({
      priorYearLossAmount: 200_000,
      cotOutcome: 'FAIL',
      bctOutcome: 'NOT_ASSERTED',
    });
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect(r.uncomputed.some((u) => u.id === 'UC-COMPANY-LOSS-BCT-NOT-ASSERTED')).toBe(true);
  });

  it('COT fail + no BCT supplied at all → LOSSES_DENIED', () => {
    const r = applyCompanyLossRules({
      priorYearLossAmount: 200_000,
      cotOutcome: 'FAIL',
    });
    expect(r.outcome).toBe('LOSSES_DENIED');
  });
});

describe('applyCompanyLossRules — COT not asserted', () => {
  it('COT NOT_ASSERTED → INCONCLUSIVE', () => {
    const r = applyCompanyLossRules({
      priorYearLossAmount: 200_000,
      cotOutcome: 'NOT_ASSERTED',
    });
    expect(r.outcome).toBe('INCONCLUSIVE');
    expect(r.uncomputed.some((u) => u.id === 'UC-COMPANY-LOSS-COT-NOT-ASSERTED')).toBe(true);
  });
});

describe('applyCompanyLossRules — citations', () => {
  it('always cites Div 165 + s165-10 + s165-12', () => {
    const r = applyCompanyLossRules({
      priorYearLossAmount: 100_000,
      cotOutcome: 'PASS',
    });
    expect(r.citations.some((c) => c.reference.includes('Div 165'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s165-10'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s165-12'))).toBe(true);
  });
});
