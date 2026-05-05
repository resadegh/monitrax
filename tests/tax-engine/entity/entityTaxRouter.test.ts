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
