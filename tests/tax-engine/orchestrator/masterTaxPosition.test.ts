/**
 * Phase 41e.17 — MasterTaxPosition orchestrator tests.
 */

import { describe, it, expect } from 'vitest';
import {
  buildMasterTaxPosition,
  type MasterTaxPositionInput,
} from '@/lib/tax-engine/orchestrator/masterTaxPosition';
import type { EntityTaxFacts, FYReference } from '@/lib/tax-engine/types';

const FY: FYReference = { financialYear: '2024-25', label: 'FY24-25' };

const personalEntity = (
  o: Partial<EntityTaxFacts> = {},
): EntityTaxFacts => ({
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

const baseInput = (
  o: Partial<MasterTaxPositionInput> = {},
): MasterTaxPositionInput => ({
  userId: 'user-1',
  fy: FY,
  entities: o.entities ?? [personalEntity()],
  ...o,
});

describe('buildMasterTaxPosition — single PERSONAL_NAME entity', () => {
  it('runs entity router + populates totals', () => {
    const r = buildMasterTaxPosition(baseInput());
    expect(r.userId).toBe('user-1');
    expect(r.entities).toHaveLength(1);
    expect(r.totals.assessableIncome).toBeGreaterThan(0);
    expect(r.totals.netTax).toBeGreaterThan(0);
  });

  it('always includes entityTaxRouter in modulesInvoked', () => {
    const r = buildMasterTaxPosition(baseInput());
    expect(r.modulesInvoked).toContain('entityTaxRouter');
  });

  it('populates boundary footer envelope', () => {
    const r = buildMasterTaxPosition(baseInput());
    expect(r.boundary).toBeDefined();
    expect(r.boundary.boundary).toContain('not personal financial');
    expect(r.boundary.computedPer.length).toBeGreaterThan(0);
  });

  it('returns ISO-8601 computedAt', () => {
    const r = buildMasterTaxPosition(baseInput());
    expect(r.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('buildMasterTaxPosition — multiple entities (household)', () => {
  it('aggregates totals across PERSONAL_NAME + SOLE_TRADER entities', () => {
    const r = buildMasterTaxPosition(
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
    expect(r.totals.assessableIncome).toBeGreaterThan(100_000);
  });

  it('de-dupes citations across entities', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        entities: [personalEntity({ entityId: 'e1' }), personalEntity({ entityId: 'e2' })],
      }),
    );
    // Each PERSONAL_NAME entity cites s4-10; should appear once
    const s4_10Count = r.authoritySources.filter((c) =>
      c.reference.includes('s4-10'),
    ).length;
    expect(s4_10Count).toBeLessThanOrEqual(1);
  });
});

describe('buildMasterTaxPosition — cross-cutting land tax', () => {
  it('runs cross-state aggregator when properties provided', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        landTax: {
          ownershipType: 'INDIVIDUAL',
          isForeignOwner: false,
          properties: [
            {
              propertyId: 'p1',
              state: 'NSW',
              taxableLandValue: 1_500_000,
              isResidential: true,
            },
            {
              propertyId: 'p2',
              state: 'VIC',
              taxableLandValue: 600_000,
              isResidential: true,
            },
          ],
        },
      }),
    );
    expect(r.modulesInvoked).toContain('crossStateLandTax');
    expect(r.crossCutting?.landTax?.statesAssessed).toBe(2);
    expect(r.crossCutting?.landTax?.grandTotalGeneralTax).toBeGreaterThan(0);
  });

  it('skips land tax when no properties', () => {
    const r = buildMasterTaxPosition(baseInput());
    expect(r.modulesInvoked).not.toContain('crossStateLandTax');
    expect(r.crossCutting?.landTax).toBeUndefined();
  });
});

describe('buildMasterTaxPosition — cross-cutting stamp duty', () => {
  it('runs stamp duty per transaction + totals', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        stampDutyTransactions: [
          {
            transactionId: 'tx1',
            state: 'NSW',
            input: {
              dutiableValue: 500_000,
              isForeignPurchaser: false,
              isResidential: true,
            },
          },
          {
            transactionId: 'tx2',
            state: 'VIC',
            input: {
              dutiableValue: 600_000,
              isForeignPurchaser: false,
              isResidential: true,
            },
          },
        ],
      }),
    );
    expect(r.modulesInvoked).toContain('stampDuty');
    expect(r.crossCutting?.stampDuty?.perTransaction).toHaveLength(2);
    expect(r.crossCutting?.stampDuty?.total).toBeGreaterThan(0);
  });

  it('skips stamp duty when no transactions', () => {
    const r = buildMasterTaxPosition(baseInput());
    expect(r.modulesInvoked).not.toContain('stampDuty');
    expect(r.crossCutting?.stampDuty).toBeUndefined();
  });
});

describe('buildMasterTaxPosition — cross-cutting GST', () => {
  it('runs GST calc when input provided', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        gst: {
          transactions: [
            {
              transactionId: 's1',
              supplyType: 'SALE',
              classification: 'TAXABLE',
              amountExcludingGst: 10_000,
            },
            {
              transactionId: 'p1',
              supplyType: 'NON_CAPITAL_PURCHASE',
              classification: 'TAXABLE',
              amountExcludingGst: 3_000,
            },
          ],
          annualTurnover: 500_000,
          isRegistered: true,
        },
      }),
    );
    expect(r.modulesInvoked).toContain('gst');
    expect(r.crossCutting?.gst?.gstCollected).toBe(1_000);
    expect(r.crossCutting?.gst?.gstCreditsClaimable).toBe(300);
    expect(r.crossCutting?.gst?.netGst).toBe(700);
  });

  it('skips GST when no input', () => {
    const r = buildMasterTaxPosition(baseInput());
    expect(r.modulesInvoked).not.toContain('gst');
    expect(r.crossCutting?.gst).toBeUndefined();
  });
});

describe('buildMasterTaxPosition — per-entity loss-rule overlays', () => {
  it('runs trust loss rules when supplied', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        trustLossByEntity: {
          'trust-1': {
            trustType: 'FAMILY_TRUST_FTE',
            lossAmount: 50_000,
            testOutcomes: { incomeInjectionTest: 'PASS' },
          },
        },
      }),
    );
    expect(r.modulesInvoked).toContain('trustLossRules');
    expect(r.crossCutting?.trustLossByEntity?.['trust-1']?.outcome).toBe('LOSSES_DEDUCTIBLE');
  });

  it('runs company loss rules when supplied', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        companyLossByEntity: {
          'co-1': {
            priorYearLossAmount: 200_000,
            cotOutcome: 'PASS',
          },
        },
      }),
    );
    expect(r.modulesInvoked).toContain('companyLossRules');
    expect(r.crossCutting?.companyLossByEntity?.['co-1']?.outcome).toBe('LOSSES_DEDUCTIBLE_VIA_COT');
  });

  it('runs both trust + company loss rules when both supplied', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        trustLossByEntity: {
          't1': { trustType: 'EXCEPTED_TRUST', lossAmount: 100_000, testOutcomes: {} },
        },
        companyLossByEntity: {
          'c1': { priorYearLossAmount: 50_000, cotOutcome: 'FAIL', bctOutcome: 'PASS', bctTestType: 'SBT' },
        },
      }),
    );
    expect(r.modulesInvoked).toContain('trustLossRules');
    expect(r.modulesInvoked).toContain('companyLossRules');
  });
});

describe('buildMasterTaxPosition — full household integration', () => {
  it('all modules at once → modulesInvoked contains every one', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        landTax: {
          ownershipType: 'INDIVIDUAL',
          isForeignOwner: false,
          properties: [
            { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
          ],
        },
        stampDutyTransactions: [
          {
            transactionId: 'tx1',
            state: 'NSW',
            input: { dutiableValue: 500_000, isForeignPurchaser: false, isResidential: true },
          },
        ],
        gst: {
          transactions: [
            { transactionId: 's1', supplyType: 'SALE', classification: 'TAXABLE', amountExcludingGst: 10_000 },
          ],
          annualTurnover: 100_000,
          isRegistered: true,
        },
        trustLossByEntity: {
          't1': { trustType: 'FAMILY_TRUST_FTE', lossAmount: 30_000, testOutcomes: { incomeInjectionTest: 'PASS' } },
        },
        companyLossByEntity: {
          'c1': { priorYearLossAmount: 100_000, cotOutcome: 'PASS' },
        },
      }),
    );
    expect(r.modulesInvoked).toContain('entityTaxRouter');
    expect(r.modulesInvoked).toContain('crossStateLandTax');
    expect(r.modulesInvoked).toContain('stampDuty');
    expect(r.modulesInvoked).toContain('gst');
    expect(r.modulesInvoked).toContain('trustLossRules');
    expect(r.modulesInvoked).toContain('companyLossRules');
  });

  it('aggregates citations from every module that ran', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        landTax: {
          ownershipType: 'INDIVIDUAL',
          isForeignOwner: false,
          properties: [
            { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
          ],
        },
        gst: {
          transactions: [],
          annualTurnover: 100_000,
          isRegistered: true,
        },
      }),
    );
    // Should have land tax citations + GST citations + entity citations
    expect(r.authoritySources.some((c) => c.reference.includes('NSW Land Tax'))).toBe(true);
    expect(r.authoritySources.some((c) => c.reference.includes('GST'))).toBe(true);
  });

  it('aggregates UNCOMPUTED flags from every module that ran', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        landTax: {
          ownershipType: 'INDIVIDUAL',
          isForeignOwner: false,
          properties: [
            { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
          ],
        },
        gst: {
          transactions: [],
          annualTurnover: 100_000,
          isRegistered: true,
        },
      }),
    );
    expect(r.uncomputed.some((u) => u.id === 'UC-MULTI-STATE-LAND-TAX')).toBe(true);
    expect(r.uncomputed.some((u) => u.id === 'UC-GST-ADVANCED-DIVISIONS')).toBe(true);
  });

  it('boundary footer reflects all modules invoked', () => {
    const r = buildMasterTaxPosition(
      baseInput({
        landTax: {
          ownershipType: 'INDIVIDUAL',
          isForeignOwner: false,
          properties: [
            { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
          ],
        },
      }),
    );
    expect(r.boundary.uncomputedNotes.length).toBeGreaterThan(0);
    expect(r.boundary.computedPer).toMatch(/Land Tax|ITAA/);
  });
});

describe('buildMasterTaxPosition — edge cases', () => {
  it('zero entities → zero totals + still produces boundary', () => {
    const r = buildMasterTaxPosition(
      baseInput({ entities: [] }),
    );
    expect(r.entities).toHaveLength(0);
    expect(r.totals.assessableIncome).toBe(0);
    expect(r.totals.netTax).toBe(0);
    expect(r.boundary).toBeDefined();
  });

  it('crossCutting is undefined when no cross-cutting modules ran', () => {
    const r = buildMasterTaxPosition(baseInput());
    expect(r.crossCutting).toBeUndefined();
  });
});
