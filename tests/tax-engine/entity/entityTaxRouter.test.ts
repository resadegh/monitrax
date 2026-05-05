/**
 * `entityTaxRouter` skeleton tests — Phase 41e.0 slice D.
 *
 * Pins both halves of the contract:
 *   - PERSONAL_NAME / SOLE_TRADER → real Phase 20 result + citations
 *   - COMPANY / TRUST / SMSF / PARTNERSHIP → null result + UNCOMPUTED flag
 *     (per audit §10.3 — never false numbers)
 *
 * As 41e.1+ ship per-rule dispatch, the UNCOMPUTED branches flip one
 * by one; these tests update with each PR. Today they lock the
 * skeleton's structural correctness.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEntityTaxPosition,
  entityHasComputedTax,
} from '@/lib/tax-engine/entity/entityTaxRouter';
import type { EntityTaxFacts } from '@/lib/tax-engine/types';

const baseFacts = (
  overrides: Partial<EntityTaxFacts> = {},
): EntityTaxFacts => ({
  entityId: 'e-test',
  entityType: 'PERSONAL_NAME',
  fy: { financialYear: '2024-25', label: 'FY24-25' },
  incomes: [],
  expenses: [],
  depreciations: [],
  ...overrides,
});

describe('calculateEntityTaxPosition — PERSONAL_NAME / SOLE_TRADER (computed)', () => {
  it('PERSONAL_NAME with no inputs returns zeroed Phase 20 result', () => {
    const result = calculateEntityTaxPosition(baseFacts({ entityType: 'PERSONAL_NAME' }));
    expect(result.entityId).toBe('e-test');
    expect(result.entityType).toBe('PERSONAL_NAME');
    expect(result.result).not.toBeNull();
    expect(result.uncomputed).toEqual([]);
    expect(result.citations.length).toBeGreaterThan(0);
    // Sanity — citations include ITAA 1997 s4-10
    expect(result.citations.some((c) => c.kind === 'ITAA_1997' && c.reference === 's4-10')).toBe(true);
  });

  it('PERSONAL_NAME with $130k salary lands in 30% bracket', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'PERSONAL_NAME',
        incomes: [
          {
            id: 'i1',
            name: 'Salary',
            type: 'SALARY',
            amount: 130000,
            frequency: 'ANNUALLY',
            grossAmount: 130000,
          },
        ],
      }),
    );
    expect(result.uncomputed).toEqual([]);
    // result.result is unknown-typed — narrow for assertion
    const taxResult = result.result as { tax: { marginalRate: number } } | null;
    expect(taxResult?.tax.marginalRate).toBe(30);
  });

  it('SOLE_TRADER routes through Phase 20 with s8-1 citation', () => {
    const result = calculateEntityTaxPosition(baseFacts({ entityType: 'SOLE_TRADER' }));
    expect(result.uncomputed).toEqual([]);
    expect(result.citations.some((c) => c.reference === 's8-1')).toBe(true);
  });
});

describe('calculateEntityTaxPosition — UNCOMPUTED branches', () => {
  const uncomputedTypes = [
    'COMPANY',
    'DISCRETIONARY_TRUST',
    'UNIT_TRUST',
    'SMSF',
    'PARTNERSHIP',
  ] as const;

  uncomputedTypes.forEach((type) => {
    it(`${type} returns null result + UNCOMPUTED flag (no false numbers)`, () => {
      const result = calculateEntityTaxPosition(baseFacts({ entityType: type }));
      expect(result.entityType).toBe(type);
      expect(result.result).toBeNull();
      expect(result.citations).toEqual([]);
      expect(result.uncomputed.length).toBe(1);
      expect(result.uncomputed[0].id).toMatch(/^UC-ENTITY-/);
      expect(result.uncomputed[0].rationale.length).toBeGreaterThan(20);
    });
  });

  it('UNCOMPUTED rationale references the sub-PR that will resolve it', () => {
    const company = calculateEntityTaxPosition(baseFacts({ entityType: 'COMPANY' }));
    expect(company.uncomputed[0].rationale).toMatch(/41e\.\d/);
    const trust = calculateEntityTaxPosition(baseFacts({ entityType: 'DISCRETIONARY_TRUST' }));
    expect(trust.uncomputed[0].rationale).toMatch(/41e\.\d/);
    const smsf = calculateEntityTaxPosition(baseFacts({ entityType: 'SMSF' }));
    expect(smsf.uncomputed[0].rationale).toMatch(/41e\.\d/);
  });
});

describe('entityHasComputedTax', () => {
  it('returns true for PERSONAL_NAME + SOLE_TRADER', () => {
    expect(entityHasComputedTax('PERSONAL_NAME')).toBe(true);
    expect(entityHasComputedTax('SOLE_TRADER')).toBe(true);
  });

  it('returns false for the not-yet-implemented entity types', () => {
    expect(entityHasComputedTax('COMPANY')).toBe(false);
    expect(entityHasComputedTax('DISCRETIONARY_TRUST')).toBe(false);
    expect(entityHasComputedTax('UNIT_TRUST')).toBe(false);
    expect(entityHasComputedTax('SMSF')).toBe(false);
    expect(entityHasComputedTax('PARTNERSHIP')).toBe(false);
  });
});

describe('Phase 41e.1 slice D-1 — TRUST entities flip when trustDistribution provided', () => {
  it('DISCRETIONARY_TRUST WITHOUT trustDistribution → still UNCOMPUTED', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({ entityType: 'DISCRETIONARY_TRUST' }),
    );
    expect(result.result).toBeNull();
    expect(result.uncomputed[0]?.id).toMatch(/^UC-ENTITY-DISCRETIONARY-TRUST/);
  });

  it('DISCRETIONARY_TRUST WITH trustDistribution → computed Div 6 result', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'DISCRETIONARY_TRUST',
        trustDistribution: {
          trustNetIncome: 100000,
          beneficiaries: [
            { id: 'b1', name: 'Sarah', presentlyEntitledShare: 1.0 },
          ],
          hasFamilyTrustElection: true,
        },
      }),
    );
    expect(result.result).not.toBeNull();
    // Result is the trustDistribution payload — narrow to assert
    const distResult = result.result as {
      distributions: Array<{ amount: number }>;
      trusteeRetainedAmount: number;
    };
    expect(distResult.distributions[0].amount).toBe(100000);
    expect(distResult.trusteeRetainedAmount).toBe(0);
    // Citations include ITAA 1936 s95 + s97 from the distribution module
    expect(result.citations.some((c) => c.reference === 's95')).toBe(true);
    expect(result.citations.some((c) => c.reference === 's97')).toBe(true);
    // UNCOMPUTED still includes UC-S100A-RISK + UC-DIV-6E-STREAMING
    expect(result.uncomputed.some((u) => u.id === 'UC-S100A-RISK')).toBe(true);
    expect(result.uncomputed.some((u) => u.id === 'UC-DIV-6E-STREAMING')).toBe(true);
    // No more UC-ENTITY-DISCRETIONARY-TRUST (the placeholder is gone)
    expect(
      result.uncomputed.some((u) => u.id === 'UC-ENTITY-DISCRETIONARY-TRUST'),
    ).toBe(false);
  });

  it('UNIT_TRUST WITH trustDistribution → computed Div 6 result', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'UNIT_TRUST',
        trustDistribution: {
          trustNetIncome: 200000,
          beneficiaries: [
            { id: 'u1', name: 'Unit Holder A', presentlyEntitledShare: 0.6 },
            { id: 'u2', name: 'Unit Holder B', presentlyEntitledShare: 0.4 },
          ],
        },
      }),
    );
    expect(result.result).not.toBeNull();
    const distResult = result.result as {
      distributions: Array<{ amount: number }>;
    };
    expect(distResult.distributions[0].amount).toBe(120000);
    expect(distResult.distributions[1].amount).toBe(80000);
  });

  it('partial entitlement → trustee retains residual at 47% s99A penalty', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'DISCRETIONARY_TRUST',
        trustDistribution: {
          trustNetIncome: 100000,
          beneficiaries: [
            { id: 'b1', name: 'A', presentlyEntitledShare: 0.5 },
          ],
        },
      }),
    );
    const distResult = result.result as {
      trusteeRetainedAmount: number;
      trusteePenaltyTax: number;
    };
    expect(distResult.trusteeRetainedAmount).toBe(50000);
    expect(distResult.trusteePenaltyTax).toBeCloseTo(50000 * 0.47, 6);
    // s99A citation surfaces only when residual > 0
    expect(result.citations.some((c) => c.reference === 's99A')).toBe(true);
  });

  it('COMPANY / SMSF still UNCOMPUTED even without distribution data', () => {
    const company = calculateEntityTaxPosition(
      baseFacts({ entityType: 'COMPANY' }),
    );
    expect(company.result).toBeNull();
    const smsf = calculateEntityTaxPosition(
      baseFacts({ entityType: 'SMSF' }),
    );
    expect(smsf.result).toBeNull();
  });

  it('PERSONAL_NAME ignores trustDistribution (it does not apply)', () => {
    // Pass trustDistribution to a PERSONAL_NAME and verify the router
    // routes through Phase 20 — trust distribution is silently ignored
    // (PERSONAL_NAMEs cannot distribute as trustees).
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'PERSONAL_NAME',
        trustDistribution: {
          trustNetIncome: 100000,
          beneficiaries: [{ id: 'b1', name: 'X', presentlyEntitledShare: 1.0 }],
        },
        incomes: [
          {
            id: 'i1',
            name: 'Salary',
            type: 'SALARY',
            amount: 80000,
            frequency: 'ANNUALLY',
            grossAmount: 80000,
          },
        ],
      }),
    );
    // PERSONAL_NAME used the Phase 20 path — no distribution payload.
    const taxResult = result.result as { tax: { marginalRate: number } } | null;
    expect(taxResult?.tax).toBeDefined();
  });
});
