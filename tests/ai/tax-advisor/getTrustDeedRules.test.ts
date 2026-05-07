/**
 * Phase 41f.4-extension — Tests for the `getTrustDeedRules` tool.
 *
 * Mocks `getConfirmedExtractionForEntity` so we can exercise both the
 * "no deed on file" path (UC-TRUST-DEED-NOT-CONFIRMED) and the
 * "deed present" path with various beneficiary + rule + provision
 * combinations. Verifies the tool's HR-1/HR-2/D-2 contract.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TrustDeedExtraction } from '@/lib/integrations/trust-deed/types';

const mockGetConfirmed = vi.fn();
vi.mock('@/lib/services/trustDeedRulesService', () => ({
  getConfirmedExtractionForEntity: (...args: unknown[]) => mockGetConfirmed(...args),
}));

import { getTrustDeedRulesTool } from '@/lib/ai/tax-advisor/tools/getTrustDeedRules';
import {
  taxAdvisorToolRegistry,
  bootstrapTaxAdvisorRegistry,
} from '@/lib/ai/tax-advisor';

beforeEach(() => {
  mockGetConfirmed.mockReset();
  taxAdvisorToolRegistry.__testOnlyClear();
  bootstrapTaxAdvisorRegistry();
});

const sampleDeed: TrustDeedExtraction = {
  beneficiaries: [
    {
      name: 'Alice Smith',
      type: 'PRIMARY',
      percentageEntitlement: null,
      conditions: null,
      confidence: 0.95,
      sourceClause: null,
    },
    {
      name: 'Bob Smith',
      type: 'PRIMARY',
      percentageEntitlement: null,
      conditions: null,
      confidence: 0.92,
      sourceClause: null,
    },
    {
      name: 'Charlie Excluded',
      type: 'EXCLUDED',
      percentageEntitlement: null,
      conditions: null,
      confidence: 0.88,
      sourceClause: null,
    },
  ],
  distributionRules: [
    {
      type: 'DISCRETIONARY',
      description: 'Trustee discretion',
      allocations: null,
      incomeTypeStreaming: null,
      confidence: 0.9,
      sourceClause: null,
    },
  ],
  vestingDate: '2080-01-01',
  trusteePower: null,
  loanProvisions: [
    {
      type: 'SUB_TRUST_UPE',
      description: 'Sub-trust UPE per s109N',
      termYears: 7,
      interestBenchmark: 'RBA benchmark',
      confidence: 0.9,
      sourceClause: 'cl 12',
    },
  ],
  uncomputedNotes: [],
  overallConfidence: 0.91,
};

describe('getTrustDeedRules (FACT_LOOKUP)', () => {
  it('exposes correct tool kind + description disclaim', () => {
    expect(getTrustDeedRulesTool.kind).toBe('FACT_LOOKUP');
    expect(getTrustDeedRulesTool.description).toContain('FACT_LOOKUP only');
    expect(getTrustDeedRulesTool.description).toContain('never recommends');
  });

  it('returns UC-TRUST-DEED-NOT-CONFIRMED when no CONFIRMED deed exists', async () => {
    mockGetConfirmed.mockResolvedValue(null);
    const r = await getTrustDeedRulesTool.execute({ legalEntityId: 'ent-1' });
    expect(r.uncomputed.some((u) => u.id.startsWith('UC-TRUST-DEED-NOT-CONFIRMED'))).toBe(true);
    expect(r.numericFields.find((f) => f.path === 'trustDeed.beneficiaryCount')?.value).toBe(0);
    expect(r.raw).toMatchObject({ hasConfirmedDeed: false });
  });

  it('counts beneficiaries by type when deed is present', async () => {
    mockGetConfirmed.mockResolvedValue(sampleDeed);
    const r = await getTrustDeedRulesTool.execute({ legalEntityId: 'ent-1' });
    const counts = Object.fromEntries(r.numericFields.map((f) => [f.path, f.value]));
    expect(counts['trustDeed.beneficiaryCount']).toBe(3);
    expect(counts['trustDeed.primaryBeneficiaryCount']).toBe(2);
    expect(counts['trustDeed.excludedBeneficiaryCount']).toBe(1);
    expect(counts['trustDeed.distributionRuleCount']).toBe(1);
    expect(counts['trustDeed.loanProvisionCount']).toBe(1);
  });

  it('every numericField has stable path + numeric value', async () => {
    mockGetConfirmed.mockResolvedValue(sampleDeed);
    const r = await getTrustDeedRulesTool.execute({ legalEntityId: 'ent-1' });
    for (const f of r.numericFields) {
      expect(typeof f.path).toBe('string');
      expect(f.path.length).toBeGreaterThan(0);
      expect(typeof f.value).toBe('number');
      expect(Number.isFinite(f.value)).toBe(true);
    }
  });

  it('every numericField citationId resolves to a real citation', async () => {
    mockGetConfirmed.mockResolvedValue(sampleDeed);
    const r = await getTrustDeedRulesTool.execute({ legalEntityId: 'ent-1' });
    const citationIds = new Set(r.citations.map((c) => c.id));
    for (const f of r.numericFields) {
      for (const cid of f.citationIds) {
        expect(citationIds.has(cid)).toBe(true);
      }
    }
  });

  it('narrativeText mentions sub-trust UPE when present', async () => {
    mockGetConfirmed.mockResolvedValue(sampleDeed);
    const r = await getTrustDeedRulesTool.execute({ legalEntityId: 'ent-1' });
    expect(r.narrativeText).toContain('SUB_TRUST_UPE');
  });

  it('raw payload exposes structured deed shape for AI narration', async () => {
    mockGetConfirmed.mockResolvedValue(sampleDeed);
    const r = await getTrustDeedRulesTool.execute({ legalEntityId: 'ent-1' });
    expect(r.raw).toMatchObject({
      hasConfirmedDeed: true,
      hasSubTrustUpe: true,
      vestingDate: '2080-01-01',
    });
  });

  it('description does NOT contain banned recommendation words', async () => {
    const banned = [/should\s+(?:contribute|sell|distribute|refinance)/i];
    for (const re of banned) {
      expect(getTrustDeedRulesTool.description).not.toMatch(re);
    }
  });

  it('is registered as the 11th canonical tool', () => {
    const all = taxAdvisorToolRegistry.list();
    expect(all.length).toBe(11);
    expect(all.find((t) => t.name === 'getTrustDeedRules')).toBeDefined();
  });
});
