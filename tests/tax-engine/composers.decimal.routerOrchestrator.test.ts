/**
 * Q-DEC PR 3.A — Composer-tier Decimal siblings tests.
 *
 * `calculateEntityTaxPositionDecimal` + `buildMasterTaxPositionDecimal` were
 * deferred from PR 2.D.3d per scope decision (a composer-tier Decimal
 * sibling has no marginal benefit until downstream consumers are also
 * Decimal). This PR ships them as the first step of PR 3 cutover.
 *
 * Tests focus on:
 *   1. The router dispatches to the right Decimal downstream engine per
 *      entity type.
 *   2. Decimal-typed results flow through (Decimal instances, not Float).
 *   3. The orchestrator aggregates totals in Decimal across entities.
 *   4. UNCOMPUTED branches preserve the same flag IDs as Float.
 *
 * Numerical agreement with Float is validated by the existing 11-engine
 * Decimal shadow-comparison suite (PR 2.D sub-PRs) — every downstream
 * engine the router dispatches to is already shadow-tested. This PR's
 * tests focus on the COMPOSITION layer (right dispatch, right Decimal
 * types, right aggregation).
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEntityTaxPositionDecimal,
} from '@/lib/tax-engine/entity/entityTaxRouter';
import {
  buildMasterTaxPositionDecimal,
  type MasterTaxPositionInput,
} from '@/lib/tax-engine/orchestrator/masterTaxPosition';
import { Decimal } from '@/lib/decimal';
import type { EntityTaxFacts, FYReference } from '@/lib/tax-engine/types';

const FY: FYReference = { financialYear: '2024-25', label: 'FY24-25' };

const personalEntity = (o: Partial<EntityTaxFacts> = {}): EntityTaxFacts => ({
  entityId: o.entityId ?? 'e-personal',
  entityType: 'PERSONAL_NAME',
  fy: FY,
  incomes: o.incomes ?? [
    {
      id: 'inc-1',
      name: 'Salary',
      type: 'SALARY',
      amount: 100_000,
      frequency: 'YEARLY',
      paygWithholding: 22_000,
    },
  ],
  expenses: o.expenses ?? [],
  depreciations: o.depreciations ?? [],
  ...o,
});

const baseInput = (o: Partial<MasterTaxPositionInput> = {}): MasterTaxPositionInput => ({
  userId: 'user-1',
  fy: FY,
  entities: o.entities ?? [personalEntity()],
  ...o,
});

describe('calculateEntityTaxPositionDecimal — PERSONAL_NAME dispatch', () => {
  it('returns a Decimal-typed result via calculateTaxPositionDecimal', () => {
    const r = calculateEntityTaxPositionDecimal(personalEntity());
    expect(r.entityType).toBe('PERSONAL_NAME');
    const result = r.result as { tax: { assessableIncome: Decimal; netTax: Decimal }; paygWithheld: Decimal };
    expect(result.tax.assessableIncome instanceof Decimal).toBe(true);
    expect(result.tax.netTax instanceof Decimal).toBe(true);
    expect(result.paygWithheld instanceof Decimal).toBe(true);
    expect(result.tax.assessableIncome.gt(0)).toBe(true);
  });

  it('SOLE_TRADER routes through same Phase 20 dispatch', () => {
    const r = calculateEntityTaxPositionDecimal(
      personalEntity({ entityType: 'SOLE_TRADER', entityId: 'e-sole' }),
    );
    expect(r.entityType).toBe('SOLE_TRADER');
    const result = r.result as { tax: { assessableIncome: Decimal } };
    expect(result.tax.assessableIncome instanceof Decimal).toBe(true);
  });
});

describe('calculateEntityTaxPositionDecimal — UNCOMPUTED branches', () => {
  it('PARTNERSHIP without dispatch data → null result + UC flag', () => {
    const r = calculateEntityTaxPositionDecimal(
      personalEntity({ entityType: 'PARTNERSHIP', entityId: 'e-part' }),
    );
    expect(r.result).toBeNull();
    expect(r.uncomputed.find((u) => u.id === 'UC-ENTITY-PARTNERSHIP')).toBeTruthy();
  });

  it('COMPANY without div7a loans → null result + UC flag', () => {
    const r = calculateEntityTaxPositionDecimal(
      personalEntity({ entityType: 'COMPANY', entityId: 'e-co' }),
    );
    expect(r.result).toBeNull();
    expect(r.uncomputed.find((u) => u.id === 'UC-ENTITY-COMPANY')).toBeTruthy();
  });

  it('DISCRETIONARY_TRUST without trustDistribution → null + UC flag', () => {
    const r = calculateEntityTaxPositionDecimal(
      personalEntity({ entityType: 'DISCRETIONARY_TRUST', entityId: 'e-trust' }),
    );
    expect(r.result).toBeNull();
    expect(r.uncomputed.find((u) => u.id === 'UC-ENTITY-DISCRETIONARY-TRUST')).toBeTruthy();
  });

  it('SMSF without SMSF dispatch data → null + UC flag', () => {
    const r = calculateEntityTaxPositionDecimal(
      personalEntity({ entityType: 'SMSF', entityId: 'e-smsf' }),
    );
    expect(r.result).toBeNull();
    expect(r.uncomputed.find((u) => u.id === 'UC-ENTITY-SMSF')).toBeTruthy();
  });
});

describe('calculateEntityTaxPositionDecimal — CGT side calc', () => {
  it('CGT events surface cgtResult as Decimal even when income tax is UNCOMPUTED', () => {
    const r = calculateEntityTaxPositionDecimal(
      personalEntity({
        entityType: 'COMPANY',
        entityId: 'e-co-cgt',
        cgtEvents: [
          {
            id: 'cgt-1',
            monthsHeld: 24,
            nominalAmount: 50_000,
            label: 'Share sale',
          },
        ],
      }),
    );
    // Income tax still UNCOMPUTED for COMPANY.
    expect(r.result).toBeNull();
    expect(r.uncomputed.find((u) => u.id === 'UC-ENTITY-COMPANY')).toBeTruthy();
    // But CGT side calc surfaces.
    expect(r.cgtResult).toBeDefined();
    expect(r.cgtResult?.assessableNetCapitalGain instanceof Decimal).toBe(true);
  });
});

describe('buildMasterTaxPositionDecimal — single PERSONAL_NAME entity', () => {
  it('runs entity router + populates totals in Decimal', () => {
    const r = buildMasterTaxPositionDecimal(baseInput());
    expect(r.userId).toBe('user-1');
    expect(r.entities).toHaveLength(1);
    expect(r.totals.assessableIncome instanceof Decimal).toBe(true);
    expect(r.totals.netTax instanceof Decimal).toBe(true);
    expect(r.totals.assessableIncome.gt(0)).toBe(true);
    expect(r.totals.netTax.gt(0)).toBe(true);
  });

  it('estimatedRefund = paygWithheld − netTax (Decimal)', () => {
    const r = buildMasterTaxPositionDecimal(baseInput());
    expect(r.totals.estimatedRefund.equals(r.totals.paygWithheld.minus(r.totals.netTax))).toBe(true);
  });

  it('modulesInvoked always contains entityTaxRouter', () => {
    const r = buildMasterTaxPositionDecimal(baseInput());
    expect(r.modulesInvoked).toContain('entityTaxRouter');
  });

  it('boundary footer envelope present', () => {
    const r = buildMasterTaxPositionDecimal(baseInput());
    expect(r.boundary).toBeDefined();
    expect(r.boundary.computedPer.length).toBeGreaterThan(0);
  });
});

describe('buildMasterTaxPositionDecimal — multiple entities (household)', () => {
  it('aggregates Decimal totals across PERSONAL_NAME + SOLE_TRADER', () => {
    const r = buildMasterTaxPositionDecimal(
      baseInput({
        entities: [
          personalEntity({ entityId: 'e1' }),
          personalEntity({
            entityId: 'e2',
            entityType: 'SOLE_TRADER',
            incomes: [
              {
                id: 'i2',
                name: 'Business income',
                type: 'BUSINESS',
                amount: 50_000,
                frequency: 'YEARLY',
              },
            ],
          }),
        ],
      }),
    );
    expect(r.entities).toHaveLength(2);
    expect(r.totals.assessableIncome.gt(100_000)).toBe(true);
  });

  it('de-dupes citations across entities (s4-10 appears once)', () => {
    const r = buildMasterTaxPositionDecimal(
      baseInput({
        entities: [personalEntity({ entityId: 'e1' }), personalEntity({ entityId: 'e2' })],
      }),
    );
    const s410Count = r.authoritySources.filter((c) =>
      c.reference.includes('s4-10'),
    ).length;
    expect(s410Count).toBeLessThanOrEqual(1);
  });
});

describe('buildMasterTaxPositionDecimal — cross-cutting GST', () => {
  it('runs Decimal GST when gst input provided', () => {
    const r = buildMasterTaxPositionDecimal(
      baseInput({
        gst: {
          isRegistered: true,
          annualTurnover: 200_000,
          transactions: [
            {
              direction: 'SALE',
              classification: 'TAXABLE',
              amountExcludingGst: 100_000,
              gstAmount: 10_000,
              description: 'Consulting fees',
            },
            {
              direction: 'PURCHASE',
              classification: 'TAXABLE',
              amountExcludingGst: 20_000,
              gstAmount: 2_000,
              description: 'Software subs',
            },
          ],
        },
      }),
    );
    expect(r.crossCutting?.gst).toBeDefined();
    expect(r.crossCutting?.gst?.netGst instanceof Decimal).toBe(true);
    expect(r.modulesInvoked).toContain('gst');
  });
});

describe('buildMasterTaxPositionDecimal — totals stay 0 for UNCOMPUTED entities', () => {
  it('PARTNERSHIP-only household has 0 totals (no false numbers)', () => {
    const r = buildMasterTaxPositionDecimal(
      baseInput({
        entities: [personalEntity({ entityType: 'PARTNERSHIP', entityId: 'e-part' })],
      }),
    );
    expect(r.totals.assessableIncome.toString()).toBe('0');
    expect(r.totals.netTax.toString()).toBe('0');
    expect(r.uncomputed.find((u) => u.id === 'UC-ENTITY-PARTNERSHIP')).toBeTruthy();
  });
});
