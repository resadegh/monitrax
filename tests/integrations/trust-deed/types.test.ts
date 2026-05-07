/**
 * Phase 41f.4 — Zod schema + highConfidenceOnly tests.
 */

import { describe, it, expect } from 'vitest';
import {
  TrustDeedExtractionSchema,
  BeneficiarySchema,
  DistributionRuleSchema,
  highConfidenceOnly,
  CONFIDENCE_THRESHOLD,
  type TrustDeedExtraction,
} from '@/lib/integrations/trust-deed';

const validBeneficiary = {
  name: 'John Smith',
  type: 'PRIMARY' as const,
  percentageEntitlement: null,
  conditions: null,
  confidence: 0.9,
  sourceClause: 'Schedule 1, item 1',
};

const validDistributionRule = {
  type: 'DISCRETIONARY' as const,
  description: 'Trustee determines annual distributions',
  allocations: null,
  incomeTypeStreaming: null,
  confidence: 0.95,
  sourceClause: 'Clause 5',
};

const validExtraction: TrustDeedExtraction = {
  beneficiaries: [validBeneficiary],
  distributionRules: [validDistributionRule],
  vestingDate: '2090-01-01',
  trusteePower: null,
  loanProvisions: null,
  uncomputedNotes: [],
  overallConfidence: 0.92,
};

describe('Phase 41f.4 — Zod schema validation', () => {
  describe('BeneficiarySchema', () => {
    it('accepts a valid beneficiary', () => {
      const r = BeneficiarySchema.safeParse(validBeneficiary);
      expect(r.success).toBe(true);
    });

    it('rejects empty name', () => {
      const r = BeneficiarySchema.safeParse({ ...validBeneficiary, name: '' });
      expect(r.success).toBe(false);
    });

    it('rejects name > 200 chars', () => {
      const r = BeneficiarySchema.safeParse({ ...validBeneficiary, name: 'x'.repeat(201) });
      expect(r.success).toBe(false);
    });

    it('rejects unknown type', () => {
      const r = BeneficiarySchema.safeParse({ ...validBeneficiary, type: 'UNKNOWN' });
      expect(r.success).toBe(false);
    });

    it('rejects percentageEntitlement > 1', () => {
      const r = BeneficiarySchema.safeParse({ ...validBeneficiary, percentageEntitlement: 1.5 });
      expect(r.success).toBe(false);
    });

    it('rejects percentageEntitlement < 0', () => {
      const r = BeneficiarySchema.safeParse({ ...validBeneficiary, percentageEntitlement: -0.1 });
      expect(r.success).toBe(false);
    });

    it('accepts percentageEntitlement = null', () => {
      const r = BeneficiarySchema.safeParse({ ...validBeneficiary, percentageEntitlement: null });
      expect(r.success).toBe(true);
    });

    it('rejects confidence > 1', () => {
      const r = BeneficiarySchema.safeParse({ ...validBeneficiary, confidence: 1.1 });
      expect(r.success).toBe(false);
    });

    it('rejects confidence < 0', () => {
      const r = BeneficiarySchema.safeParse({ ...validBeneficiary, confidence: -0.01 });
      expect(r.success).toBe(false);
    });
  });

  describe('DistributionRuleSchema', () => {
    it('accepts a valid discretionary rule', () => {
      const r = DistributionRuleSchema.safeParse(validDistributionRule);
      expect(r.success).toBe(true);
    });

    it('accepts a proportionate rule with allocations', () => {
      const r = DistributionRuleSchema.safeParse({
        ...validDistributionRule,
        type: 'PROPORTIONATE',
        allocations: [
          { beneficiaryName: 'A', share: 0.5 },
          { beneficiaryName: 'B', share: 0.5 },
        ],
      });
      expect(r.success).toBe(true);
    });

    it('accepts a streamed rule with incomeTypeStreaming', () => {
      const r = DistributionRuleSchema.safeParse({
        ...validDistributionRule,
        type: 'STREAMED',
        incomeTypeStreaming: [
          { incomeType: 'FRANKED_DIVIDENDS', beneficiaryName: 'A' },
          { incomeType: 'CAPITAL_GAINS', beneficiaryName: 'B' },
        ],
      });
      expect(r.success).toBe(true);
    });

    it('rejects unknown rule type', () => {
      const r = DistributionRuleSchema.safeParse({ ...validDistributionRule, type: 'INVALID' });
      expect(r.success).toBe(false);
    });

    it('rejects unknown incomeType in streaming', () => {
      const r = DistributionRuleSchema.safeParse({
        ...validDistributionRule,
        type: 'STREAMED',
        incomeTypeStreaming: [{ incomeType: 'UNKNOWN_TYPE', beneficiaryName: 'A' }],
      });
      expect(r.success).toBe(false);
    });
  });

  describe('TrustDeedExtractionSchema', () => {
    it('accepts a complete valid extraction', () => {
      const r = TrustDeedExtractionSchema.safeParse(validExtraction);
      expect(r.success).toBe(true);
    });

    it('accepts an empty beneficiaries + distributionRules array', () => {
      const r = TrustDeedExtractionSchema.safeParse({
        ...validExtraction,
        beneficiaries: [],
        distributionRules: [],
      });
      expect(r.success).toBe(true);
    });

    it('rejects > 50 beneficiaries (sanity bound)', () => {
      const beneficiaries = Array(51).fill(validBeneficiary);
      const r = TrustDeedExtractionSchema.safeParse({ ...validExtraction, beneficiaries });
      expect(r.success).toBe(false);
    });

    it('rejects when overallConfidence missing', () => {
      const { overallConfidence: _, ...rest } = validExtraction;
      void _;
      const r = TrustDeedExtractionSchema.safeParse(rest);
      expect(r.success).toBe(false);
    });

    it('CONFIDENCE_THRESHOLD is exposed at 0.7', () => {
      expect(CONFIDENCE_THRESHOLD).toBe(0.7);
    });
  });
});

describe('Phase 41f.4 — highConfidenceOnly()', () => {
  const lowConfBeneficiary = { ...validBeneficiary, name: 'Low Conf', confidence: 0.6 };
  const highConfBeneficiary = { ...validBeneficiary, name: 'High Conf', confidence: 0.9 };
  const lowConfRule = { ...validDistributionRule, description: 'Low conf rule', confidence: 0.5 };
  const highConfRule = { ...validDistributionRule, description: 'High conf rule', confidence: 0.85 };

  it('filters out beneficiaries below the 0.7 threshold', () => {
    const filtered = highConfidenceOnly({
      ...validExtraction,
      beneficiaries: [highConfBeneficiary, lowConfBeneficiary],
    });
    expect(filtered.beneficiaries).toHaveLength(1);
    expect(filtered.beneficiaries[0].name).toBe('High Conf');
  });

  it('filters out distribution rules below the 0.7 threshold', () => {
    const filtered = highConfidenceOnly({
      ...validExtraction,
      distributionRules: [highConfRule, lowConfRule],
    });
    expect(filtered.distributionRules).toHaveLength(1);
    expect(filtered.distributionRules[0].description).toBe('High conf rule');
  });

  it('filters out loan provisions below the 0.7 threshold', () => {
    const lowLoan = { type: 'PERMITTED_LOAN' as const, description: 'low', termYears: 7, interestBenchmark: null, confidence: 0.5, sourceClause: null };
    const highLoan = { type: 'SUB_TRUST_UPE' as const, description: 'high', termYears: 7, interestBenchmark: null, confidence: 0.85, sourceClause: null };
    const filtered = highConfidenceOnly({
      ...validExtraction,
      loanProvisions: [highLoan, lowLoan],
    });
    expect(filtered.loanProvisions).toHaveLength(1);
    expect(filtered.loanProvisions![0].description).toBe('high');
  });

  it('keeps everything when all rules are above threshold', () => {
    const filtered = highConfidenceOnly(validExtraction);
    expect(filtered.beneficiaries).toHaveLength(1);
    expect(filtered.distributionRules).toHaveLength(1);
  });

  it('keeps the boundary case (exactly 0.7) — threshold is inclusive', () => {
    const boundary = { ...validBeneficiary, confidence: 0.7 };
    const filtered = highConfidenceOnly({
      ...validExtraction,
      beneficiaries: [boundary],
    });
    expect(filtered.beneficiaries).toHaveLength(1);
  });

  it('preserves uncomputedNotes regardless of confidence', () => {
    const noted = {
      ...validExtraction,
      uncomputedNotes: [
        { id: 'uc-1', rationale: 'unclear', sourceText: 'foo', sourceClause: null },
      ],
    };
    const filtered = highConfidenceOnly(noted);
    expect(filtered.uncomputedNotes).toHaveLength(1);
  });

  it('handles null loanProvisions input', () => {
    const filtered = highConfidenceOnly({ ...validExtraction, loanProvisions: null });
    expect(filtered.loanProvisions).toBeNull();
  });
});
