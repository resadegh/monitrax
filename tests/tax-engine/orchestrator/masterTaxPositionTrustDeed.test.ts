/**
 * Phase 41f.4-extension — Tests for trust-deed validation wiring
 * inside the MasterTaxPosition orchestrator.
 *
 * Verifies:
 *   - Passing `confirmedDeedRulesByEntity` runs the validation overlay.
 *   - The overlay's citations + UNCOMPUTED flags are de-duped into
 *     the orchestrator's aggregate `authoritySources` + `uncomputed`.
 *   - `modulesInvoked` includes `trustDeedValidation` when at least
 *     one trust entity ran the overlay.
 *   - Without `confirmedDeedRulesByEntity`, the orchestrator skips the
 *     overlay entirely (modulesInvoked unchanged from baseline).
 */

import { describe, it, expect } from 'vitest';
import {
  buildMasterTaxPosition,
  type MasterTaxPositionInput,
} from '@/lib/tax-engine/orchestrator/masterTaxPosition';
import type { EntityTaxFacts, FYReference } from '@/lib/tax-engine/types';
import type { TrustDeedExtraction } from '@/lib/integrations/trust-deed/types';

const FY: FYReference = { financialYear: '2024-25', label: 'FY24-25' };

const trust: EntityTaxFacts = {
  entityId: 'ent-trust-1',
  entityType: 'DISCRETIONARY_TRUST',
  fy: FY,
  incomes: [],
  expenses: [],
  depreciations: [],
  trustDistribution: {
    trustNetIncome: 100_000,
    beneficiaries: [
      { id: 'b1', name: 'Alice', presentlyEntitledShare: 0.5 },
      { id: 'b2', name: 'Eve Stranger', presentlyEntitledShare: 0.5 },
    ],
  },
};

const personal: EntityTaxFacts = {
  entityId: 'ent-personal-1',
  entityType: 'PERSONAL_NAME',
  fy: FY,
  incomes: [
    {
      id: 'i1',
      name: 'Salary',
      type: 'SALARY',
      amount: 100_000,
      frequency: 'YEARLY',
      paygWithholding: 22_000,
    },
  ],
  expenses: [],
  depreciations: [],
};

const deedAliceOnly: TrustDeedExtraction = {
  beneficiaries: [
    {
      name: 'Alice',
      type: 'PRIMARY',
      percentageEntitlement: null,
      conditions: null,
      confidence: 0.9,
      sourceClause: null,
    },
  ],
  distributionRules: [],
  vestingDate: null,
  trusteePower: null,
  loanProvisions: null,
  uncomputedNotes: [],
  overallConfidence: 0.9,
};

describe('Phase 41f.4-extension — orchestrator trust-deed wiring', () => {
  it('does NOT run the overlay when confirmedDeedRulesByEntity is absent', () => {
    const input: MasterTaxPositionInput = {
      userId: 'u1',
      fy: FY,
      entities: [trust, personal],
    };
    const out = buildMasterTaxPosition(input);
    expect(out.modulesInvoked).not.toContain('trustDeedValidation');
    expect(out.crossCutting?.trustDeedValidationByEntity).toBeUndefined();
  });

  it('runs the overlay and surfaces UC-DEED-BENEFICIARY-NOT-IN-DEED on mismatch', () => {
    const input: MasterTaxPositionInput = {
      userId: 'u1',
      fy: FY,
      entities: [trust, personal],
      confirmedDeedRulesByEntity: { 'ent-trust-1': deedAliceOnly },
    };
    const out = buildMasterTaxPosition(input);
    expect(out.modulesInvoked).toContain('trustDeedValidation');
    const flag = out.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-BENEFICIARY-NOT-IN-DEED'),
    );
    expect(flag).toBeDefined();
  });

  it('surfaces deed citations into aggregate authoritySources', () => {
    const input: MasterTaxPositionInput = {
      userId: 'u1',
      fy: FY,
      entities: [trust],
      confirmedDeedRulesByEntity: { 'ent-trust-1': deedAliceOnly },
    };
    const out = buildMasterTaxPosition(input);
    const div6Citation = out.authoritySources.find(
      (c) => c.kind === 'ITAA_1936' && c.reference.startsWith('Div 6'),
    );
    expect(div6Citation).toBeDefined();
  });

  it('skips the overlay for non-trust entity types', () => {
    const input: MasterTaxPositionInput = {
      userId: 'u1',
      fy: FY,
      entities: [personal],
      confirmedDeedRulesByEntity: { 'ent-personal-1': deedAliceOnly },
    };
    const out = buildMasterTaxPosition(input);
    // Overlay was iterated but produced no findings for the non-trust entity →
    // modulesInvoked still pushed (caller asked for it) but no validation rows.
    expect(out.crossCutting?.trustDeedValidationByEntity).toEqual({});
  });

  it('de-dupes deed citations across multiple trust entities', () => {
    const trust2: EntityTaxFacts = { ...trust, entityId: 'ent-trust-2' };
    const input: MasterTaxPositionInput = {
      userId: 'u1',
      fy: FY,
      entities: [trust, trust2],
      confirmedDeedRulesByEntity: {
        'ent-trust-1': deedAliceOnly,
        'ent-trust-2': deedAliceOnly,
      },
    };
    const out = buildMasterTaxPosition(input);
    // Div 6 citation appears once even though both entities raised it.
    const div6Count = out.authoritySources.filter(
      (c) => c.kind === 'ITAA_1936' && c.reference === 'Div 6 (trust distributions)',
    ).length;
    expect(div6Count).toBe(1);
  });

  it('surfaces UC-DEED-PRESENT-NO-RESOLUTION when trust has deed but no trustDistribution', () => {
    const trustNoDist: EntityTaxFacts = {
      ...trust,
      trustDistribution: undefined,
    };
    const input: MasterTaxPositionInput = {
      userId: 'u1',
      fy: FY,
      entities: [trustNoDist],
      confirmedDeedRulesByEntity: { 'ent-trust-1': deedAliceOnly },
    };
    const out = buildMasterTaxPosition(input);
    const flag = out.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-PRESENT-NO-RESOLUTION'),
    );
    expect(flag).toBeDefined();
  });
});
