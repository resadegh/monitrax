/**
 * Phase 41f.4-extension — trust-deed validation overlay tests.
 *
 * Pure module — no DB, no IO. Tests cover every branch of
 * `validateTrustDistributionAgainstDeed`.
 */

import { describe, it, expect } from 'vitest';
import { validateTrustDistributionAgainstDeed } from '@/lib/tax-engine/divisions/trustDeedValidation';
import type { EntityTaxFacts } from '@/lib/tax-engine/types';
import type { TrustDeedExtraction } from '@/lib/integrations/trust-deed/types';

const fy = { financialYear: '2024-25', label: 'FY24-25' };

const baseTrust: EntityTaxFacts = {
  entityId: 'ent-trust-1',
  entityType: 'DISCRETIONARY_TRUST',
  fy,
  incomes: [],
  expenses: [],
  depreciations: [],
  trustDistribution: {
    trustNetIncome: 100_000,
    beneficiaries: [
      { id: 'b1', name: 'Alice Smith', presentlyEntitledShare: 0.5 },
      { id: 'b2', name: 'Bob Smith', presentlyEntitledShare: 0.5 },
    ],
  },
};

const baseDeed: TrustDeedExtraction = {
  beneficiaries: [
    {
      name: 'Alice Smith',
      type: 'PRIMARY',
      percentageEntitlement: null,
      conditions: null,
      confidence: 0.9,
      sourceClause: null,
    },
    {
      name: 'Bob Smith',
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

describe('Phase 41f.4-extension — validateTrustDistributionAgainstDeed', () => {
  it('returns empty for non-trust entity types', () => {
    const facts: EntityTaxFacts = { ...baseTrust, entityType: 'COMPANY' };
    const result = validateTrustDistributionAgainstDeed(facts, baseDeed);
    expect(result.citations).toEqual([]);
    expect(result.uncomputed).toEqual([]);
  });

  it('matched beneficiaries + no distribution rules → no findings', () => {
    const result = validateTrustDistributionAgainstDeed(baseTrust, baseDeed);
    expect(result.uncomputed).toEqual([]);
    expect(result.citations).toEqual([]);
  });

  it('runtime beneficiary not in deed → UC-DEED-BENEFICIARY-NOT-IN-DEED', () => {
    const facts: EntityTaxFacts = {
      ...baseTrust,
      trustDistribution: {
        trustNetIncome: 100_000,
        beneficiaries: [
          { id: 'b1', name: 'Alice Smith', presentlyEntitledShare: 0.5 },
          { id: 'b3', name: 'Eve Stranger', presentlyEntitledShare: 0.5 },
        ],
      },
    };
    const result = validateTrustDistributionAgainstDeed(facts, baseDeed);
    const flag = result.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-BENEFICIARY-NOT-IN-DEED'),
    );
    expect(flag).toBeDefined();
    expect(flag?.rationale).toContain('Eve Stranger');
  });

  it('case- and whitespace-insensitive name matching', () => {
    const facts: EntityTaxFacts = {
      ...baseTrust,
      trustDistribution: {
        trustNetIncome: 100_000,
        beneficiaries: [
          { id: 'b1', name: '  ALICE  smith ', presentlyEntitledShare: 0.5 },
          { id: 'b2', name: 'Bob Smith', presentlyEntitledShare: 0.5 },
        ],
      },
    };
    const result = validateTrustDistributionAgainstDeed(facts, baseDeed);
    expect(result.uncomputed).toEqual([]);
  });

  it('runtime beneficiary marked EXCLUDED in deed → UC-DEED-BENEFICIARY-EXCLUDED', () => {
    const deed: TrustDeedExtraction = {
      ...baseDeed,
      beneficiaries: [
        ...baseDeed.beneficiaries,
        {
          name: 'Charlie Excluded',
          type: 'EXCLUDED',
          percentageEntitlement: null,
          conditions: null,
          confidence: 0.95,
          sourceClause: null,
        },
      ],
    };
    const facts: EntityTaxFacts = {
      ...baseTrust,
      trustDistribution: {
        trustNetIncome: 100_000,
        beneficiaries: [
          { id: 'b1', name: 'Alice Smith', presentlyEntitledShare: 0.5 },
          { id: 'b3', name: 'Charlie Excluded', presentlyEntitledShare: 0.5 },
        ],
      },
    };
    const result = validateTrustDistributionAgainstDeed(facts, deed);
    const flag = result.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-BENEFICIARY-EXCLUDED'),
    );
    expect(flag).toBeDefined();
    expect(flag?.citation?.reference).toContain('s100A');
  });

  it('no trustDistribution + deed present → UC-DEED-PRESENT-NO-RESOLUTION', () => {
    const facts: EntityTaxFacts = {
      ...baseTrust,
      trustDistribution: undefined,
    };
    const result = validateTrustDistributionAgainstDeed(facts, baseDeed);
    const flag = result.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-PRESENT-NO-RESOLUTION'),
    );
    expect(flag).toBeDefined();
  });

  it('PROPORTIONATE rule mismatch beyond tolerance → UC-DEED-FIXED-DISTRIBUTION-MISMATCH', () => {
    const deed: TrustDeedExtraction = {
      ...baseDeed,
      distributionRules: [
        {
          type: 'PROPORTIONATE',
          description: '50/50 to Alice and Bob',
          allocations: [
            { beneficiaryName: 'Alice Smith', share: 0.5 },
            { beneficiaryName: 'Bob Smith', share: 0.5 },
          ],
          incomeTypeStreaming: null,
          confidence: 0.95,
          sourceClause: null,
        },
      ],
    };
    const facts: EntityTaxFacts = {
      ...baseTrust,
      trustDistribution: {
        trustNetIncome: 100_000,
        beneficiaries: [
          { id: 'b1', name: 'Alice Smith', presentlyEntitledShare: 0.7 },
          { id: 'b2', name: 'Bob Smith', presentlyEntitledShare: 0.3 },
        ],
      },
    };
    const result = validateTrustDistributionAgainstDeed(facts, deed);
    const aliceMismatch = result.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-FIXED-DISTRIBUTION-MISMATCH'),
    );
    expect(aliceMismatch).toBeDefined();
    expect(aliceMismatch?.rationale).toContain('Alice');
  });

  it('PROPORTIONATE rule within tolerance → no mismatch flag', () => {
    const deed: TrustDeedExtraction = {
      ...baseDeed,
      distributionRules: [
        {
          type: 'PROPORTIONATE',
          description: 'Equal split',
          allocations: [
            { beneficiaryName: 'Alice Smith', share: 0.5 },
            { beneficiaryName: 'Bob Smith', share: 0.5 },
          ],
          incomeTypeStreaming: null,
          confidence: 0.95,
          sourceClause: null,
        },
      ],
    };
    const result = validateTrustDistributionAgainstDeed(baseTrust, deed);
    const mismatch = result.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-FIXED-DISTRIBUTION-MISMATCH'),
    );
    expect(mismatch).toBeUndefined();
  });

  it('FIXED rule beneficiary missing in runtime → UC-DEED-FIXED-BENEFICIARY-MISSING', () => {
    const deed: TrustDeedExtraction = {
      ...baseDeed,
      distributionRules: [
        {
          type: 'FIXED',
          description: 'Carol gets $5,000',
          allocations: [{ beneficiaryName: 'Carol Smith', share: 5000 }],
          incomeTypeStreaming: null,
          confidence: 0.95,
          sourceClause: null,
        },
      ],
      beneficiaries: [
        ...baseDeed.beneficiaries,
        {
          name: 'Carol Smith',
          type: 'PRIMARY',
          percentageEntitlement: null,
          conditions: null,
          confidence: 0.9,
          sourceClause: null,
        },
      ],
    };
    const result = validateTrustDistributionAgainstDeed(baseTrust, deed);
    const flag = result.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-FIXED-BENEFICIARY-MISSING'),
    );
    expect(flag).toBeDefined();
    expect(flag?.rationale).toContain('Carol');
  });

  it('SUB_TRUST_UPE loan provision → UC-DEED-SUB-TRUST-UPE-PRESENT', () => {
    const deed: TrustDeedExtraction = {
      ...baseDeed,
      loanProvisions: [
        {
          type: 'SUB_TRUST_UPE',
          description: 'Sub-trust UPE per s109N safe harbour',
          termYears: 7,
          interestBenchmark: 'RBA benchmark rate',
          confidence: 0.9,
          sourceClause: 'cl 12.3',
        },
      ],
    };
    const result = validateTrustDistributionAgainstDeed(baseTrust, deed);
    const flag = result.uncomputed.find((u) =>
      u.id.startsWith('UC-DEED-SUB-TRUST-UPE-PRESENT'),
    );
    expect(flag).toBeDefined();
    expect(flag?.citation?.reference).toContain('Div 7A');
  });

  it('emits citations only when an UNCOMPUTED is raised', () => {
    // baseline has all matched beneficiaries + no rules → no citations + no flags
    const result = validateTrustDistributionAgainstDeed(baseTrust, baseDeed);
    expect(result.citations).toEqual([]);
  });
});
