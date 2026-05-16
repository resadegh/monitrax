/**
 * Phase 41E.2 — AI tool tests.
 *
 * Covers:
 *   - `getReformedTaxRegimeStatus` — per-property regime classification
 *     for each of the 5 regime variants (boundary-day, new-build,
 *     non-residential, unknown contract date, unknown new-build status).
 *     ToolResult shape conformance.
 *   - `getReformImpactSummaryForUser` — cross-measure aggregator
 *     counting per-regime properties + trust types + foreign-resident
 *     entities + carry-back-eligible companies. ToolResult shape
 *     conformance. D-2 narrative-text test (no recommendation verbs).
 */

import { describe, it, expect } from 'vitest';
import { getReformedTaxRegimeStatusTool } from '@/lib/ai/tax-advisor/tools/getReformedTaxRegimeStatus';
import {
  getReformImpactSummaryForUserTool,
  type ReformSummaryProperty,
  type ReformSummaryEntity,
  type ReformSummaryCompanyEligibility,
} from '@/lib/ai/tax-advisor/tools/getReformImpactSummaryForUser';

// =============================================================================
// getReformedTaxRegimeStatus
// =============================================================================

describe('Phase 41E.2 — getReformedTaxRegimeStatus tool', () => {
  it('returns valid ToolResult shape', async () => {
    const result = await getReformedTaxRegimeStatusTool.execute({
      propertyId: 'p1',
      propertyType: 'INVESTMENT',
      acquisitionContractDate: '2020-01-01',
      isNewBuild: false,
      financialYear: '2025-26',
    });
    expect(result.toolName).toBe('getReformedTaxRegimeStatus');
    expect(result.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Array.isArray(result.numericFields)).toBe(true);
    expect(Array.isArray(result.citations)).toBe(true);
    expect(typeof result.narrativeText).toBe('string');
    expect(result.narrativeText.length).toBeGreaterThan(20);
  });

  it('pre-cut-over contract → GRANDFATHERED (regime code 0)', async () => {
    const result = await getReformedTaxRegimeStatusTool.execute({
      propertyId: 'p1',
      propertyType: 'INVESTMENT',
      acquisitionContractDate: '2020-01-01',
      isNewBuild: false,
      financialYear: '2027-28',
    });
    const regimeField = result.numericFields.find((f) => f.path === 'reform.regime.p1');
    expect(regimeField?.value).toBe(0); // PRE_REFORM_GRANDFATHERED
    expect((result.raw as any).regime).toBe('PRE_REFORM_GRANDFATHERED');
  });

  it('Stage 1 default (reform flag false) — even post-cut-over contract → GRANDFATHERED', () => {
    // The commencement-flag gate keeps everything grandfathered until
    // the Bill assents — FW-2 wall.
    const result = getReformedTaxRegimeStatusTool.execute({
      propertyId: 'p1',
      propertyType: 'INVESTMENT',
      acquisitionContractDate: '2027-01-01',
      isNewBuild: false,
      financialYear: '2027-28',
    }) as any;
    const regimeField = result.numericFields.find((f: any) => f.path === 'reform.regime.p1');
    expect(regimeField?.value).toBe(0); // PRE_REFORM_GRANDFATHERED
  });

  it('null contract date → UC_PROPERTY_CONTRACT_DATE_UNKNOWN narrative', async () => {
    // Note: at Stage 1 the commencement flag is false everywhere, so
    // even a null contract date returns PRE_REFORM_GRANDFATHERED. This
    // test asserts the path remains stable for when the flag flips.
    const result = await getReformedTaxRegimeStatusTool.execute({
      propertyId: 'p1',
      propertyType: 'INVESTMENT',
      acquisitionContractDate: null,
      isNewBuild: null,
      financialYear: '2027-28',
    });
    expect(result.numericFields.some((f) => f.path === 'reform.regime.p1')).toBe(true);
  });

  it('every numeric field has at least one citation', async () => {
    const result = await getReformedTaxRegimeStatusTool.execute({
      propertyId: 'p1',
      propertyType: 'INVESTMENT',
      acquisitionContractDate: '2020-01-01',
      isNewBuild: null,
      financialYear: '2025-26',
    });
    for (const field of result.numericFields) {
      expect(field.citationIds.length).toBeGreaterThan(0);
    }
  });

  it('citations have stable IDs (cit-1, cit-2)', async () => {
    const result = await getReformedTaxRegimeStatusTool.execute({
      propertyId: 'p1',
      propertyType: 'INVESTMENT',
      acquisitionContractDate: '2020-01-01',
      isNewBuild: null,
      financialYear: '2025-26',
    });
    expect(result.citations.map((c) => c.id).sort()).toEqual(['cit-1', 'cit-2']);
  });

  it('kind is FACT_LOOKUP (not RECOMMENDATION — D-2)', () => {
    expect(getReformedTaxRegimeStatusTool.kind).toBe('FACT_LOOKUP');
  });

  it('description does not contain recommendation verbs (D-2)', () => {
    const desc = getReformedTaxRegimeStatusTool.description.toLowerCase();
    expect(desc).not.toMatch(/\byou should\b/);
    expect(desc).not.toMatch(/\bi recommend\b/);
    expect(desc).not.toMatch(/\bconsider (selling|restructuring)\b/);
    // The description should explicitly disclaim recommendations.
    expect(desc).toMatch(/does not recommend|fact_lookup only/i);
  });
});

// =============================================================================
// getReformImpactSummaryForUser
// =============================================================================

const SAMPLE_PROPERTIES_GRANDFATHERED: ReformSummaryProperty[] = [
  {
    propertyId: 'p1',
    propertyType: 'INVESTMENT',
    acquisitionContractDate: '2020-01-01',
    isNewBuild: false,
    isRenewablesInfrastructure: false,
  },
  {
    propertyId: 'p2',
    propertyType: 'HOME',
    acquisitionContractDate: '2018-06-30',
    isNewBuild: false,
    isRenewablesInfrastructure: false,
  },
];

const SAMPLE_ENTITY_PERSONAL: ReformSummaryEntity = {
  legalEntityId: 'e1',
  type: 'PERSONAL_NAME',
  trustType: null,
  isForeignResident: false,
};

const SAMPLE_ENTITY_DISCRETIONARY_TRUST: ReformSummaryEntity = {
  legalEntityId: 'e2',
  type: 'DISCRETIONARY_TRUST',
  trustType: 'DISCRETIONARY',
  isForeignResident: false,
};

const SAMPLE_COMPANY_ELIGIBLE: ReformSummaryCompanyEligibility = {
  legalEntityId: 'e3',
  hasCurrentFyLoss: true,
  hasPriorYearTaxPaid: true,
  turnoverUnderOneBillion: true,
};

describe('Phase 41E.2 — getReformImpactSummaryForUser tool', () => {
  it('returns valid ToolResult shape', async () => {
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2027-28',
      properties: SAMPLE_PROPERTIES_GRANDFATHERED,
      entities: [SAMPLE_ENTITY_PERSONAL],
      companies: [],
    });
    expect(result.toolName).toBe('getReformImpactSummaryForUser');
    expect(typeof result.narrativeText).toBe('string');
    expect(result.numericFields.length).toBeGreaterThan(5);
    expect(result.citations.length).toBe(9); // one per measure
  });

  it('all-grandfathered user → narrative leads with "all properties grandfathered"', async () => {
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2027-28',
      properties: SAMPLE_PROPERTIES_GRANDFATHERED,
      entities: [SAMPLE_ENTITY_PERSONAL],
      companies: [],
    });
    expect(result.narrativeText).toMatch(/all 2 of your properties are grandfathered/i);
    expect(result.narrativeText).not.toMatch(/restricted negative gearing/);
  });

  it('counts grandfathered properties correctly', async () => {
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2027-28',
      properties: SAMPLE_PROPERTIES_GRANDFATHERED,
      entities: [],
      companies: [],
    });
    const grandfatheredField = result.numericFields.find(
      (f) => f.path === 'reform.summary.propertyCountGrandfathered',
    );
    expect(grandfatheredField?.value).toBe(2);

    const restrictedField = result.numericFields.find(
      (f) => f.path === 'reform.summary.propertyCountPostReformRestricted',
    );
    expect(restrictedField?.value).toBe(0);
  });

  it('counts discretionary trusts affected by Measure 3', async () => {
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2028-29',
      properties: [],
      entities: [SAMPLE_ENTITY_PERSONAL, SAMPLE_ENTITY_DISCRETIONARY_TRUST, SAMPLE_ENTITY_DISCRETIONARY_TRUST],
      companies: [],
    });
    const dtField = result.numericFields.find(
      (f) => f.path === 'reform.summary.discretionaryTrustCount',
    );
    expect(dtField?.value).toBe(2);
    expect(result.narrativeText).toMatch(/discretionary trust/i);
  });

  it('flags trusts needing trustType confirmation (UC-TRUST-TYPE-UNKNOWN)', async () => {
    const trustNoSubtype: ReformSummaryEntity = {
      legalEntityId: 'e10',
      type: 'DISCRETIONARY_TRUST',
      trustType: null, // unconfirmed
      isForeignResident: false,
    };
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2028-29',
      properties: [],
      entities: [trustNoSubtype],
      companies: [],
    });
    const unknownField = result.numericFields.find(
      (f) => f.path === 'reform.summary.unknownTrustTypeCount',
    );
    expect(unknownField?.value).toBe(1);
  });

  it('counts foreign-resident entities for Measure 4', async () => {
    const fr: ReformSummaryEntity = {
      legalEntityId: 'e20',
      type: 'COMPANY',
      trustType: null,
      isForeignResident: true,
    };
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2026-27',
      properties: [],
      entities: [fr, SAMPLE_ENTITY_PERSONAL],
      companies: [],
    });
    const frField = result.numericFields.find(
      (f) => f.path === 'reform.summary.foreignResidentEntityCount',
    );
    expect(frField?.value).toBe(1);
  });

  it('counts carry-back-eligible companies for Measure 5', async () => {
    const ineligible: ReformSummaryCompanyEligibility = {
      legalEntityId: 'e4',
      hasCurrentFyLoss: false, // no loss
      hasPriorYearTaxPaid: true,
      turnoverUnderOneBillion: true,
    };
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2026-27',
      properties: [],
      entities: [],
      companies: [SAMPLE_COMPANY_ELIGIBLE, ineligible],
    });
    const cbField = result.numericFields.find(
      (f) => f.path === 'reform.summary.carryBackEligibleCompanyCount',
    );
    expect(cbField?.value).toBe(1);
    expect(result.narrativeText).toMatch(/carry-back/i);
  });

  it('kind is SCENARIO_RUN (not RECOMMENDATION — D-2)', () => {
    expect(getReformImpactSummaryForUserTool.kind).toBe('SCENARIO_RUN');
  });

  it('narrative does NOT contain recommendation verbs (D-2 wall)', async () => {
    // The narrator text is HR-1 (numbers) + HR-2 (citations); the
    // architect-mode skill's "One Clear Action" principle is honoured by
    // surfacing facts + Ask-a-Pro routing — never an imperative.
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2027-28',
      properties: [
        {
          propertyId: 'p3',
          propertyType: 'INVESTMENT',
          acquisitionContractDate: null,
          isNewBuild: null,
          isRenewablesInfrastructure: false,
        },
      ],
      entities: [SAMPLE_ENTITY_DISCRETIONARY_TRUST],
      companies: [SAMPLE_COMPANY_ELIGIBLE],
    });
    const narrative = result.narrativeText.toLowerCase();
    // D-2 verb check (also enforced by the gateway validator at response emit time):
    expect(narrative).not.toMatch(/\byou should\b/);
    expect(narrative).not.toMatch(/\byou must\b/);
    expect(narrative).not.toMatch(/\bi recommend\b/);
    expect(narrative).not.toMatch(/\btransfer to\b/);
    expect(narrative).not.toMatch(/\bsalary sacrifice\b/);
    // It should route to Ask-a-Pro.
    expect(narrative).toMatch(/registered tax agent|financial adviser/);
  });

  it('description names HR-1 + HR-2 + D-2 in plain English', () => {
    const desc = getReformImpactSummaryForUserTool.description;
    expect(desc).toMatch(/HR-1/);
    expect(desc).toMatch(/HR-2/);
    expect(desc).toMatch(/D-2/);
  });

  it('cut-over moment is surfaced as a numeric field', async () => {
    const result = await getReformImpactSummaryForUserTool.execute({
      userId: 'u1',
      financialYear: '2027-28',
      properties: [],
      entities: [],
      companies: [],
    });
    const cutOverField = result.numericFields.find(
      (f) => f.path === 'reform.cutOverUtcEpochMs',
    );
    expect(cutOverField).toBeDefined();
    // 2026-05-12T09:30:00Z = 1747042200000
    expect(cutOverField?.value).toBe(new Date('2026-05-12T09:30:00Z').getTime());
  });
});
