/**
 * Phase 41h.0 — Tool registry + HR-1/HR-2 structural enforcement tests.
 *
 * These tests are the **structural contract**. They lock in the
 * hard rules so a future PR can't relax them by accident:
 *
 *   - HR-1: Every numeric field the AI emits MUST come from a tool
 *     result's `numericFields[]` (path-addressed).
 *   - HR-2: Every citation the AI references MUST come from a tool
 *     result's `citations[]` (id-addressed).
 *   - D-2: Tool kinds are a closed set — `FACT_LOOKUP | SCENARIO_RUN`.
 *     There is NO `RECOMMENDATION` kind.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  taxAdvisorToolRegistry,
  bootstrapTaxAdvisorRegistry,
  getContributionCapHeadroomTool,
  getLandTaxPositionTool,
  getEntityTaxPositionTool,
} from '@/lib/ai/tax-advisor';
import {
  findNumericFieldInSession,
  findCitationInSession,
  collectSessionCitations,
  collectSessionUncomputed,
  type ToolSession,
} from '@/lib/ai/tax-advisor/types';
import { assertToolKind } from '@/lib/ai/tax-advisor/registry';

beforeEach(() => {
  taxAdvisorToolRegistry.__testOnlyClear();
  bootstrapTaxAdvisorRegistry();
});

describe('Tool registry — bootstrap + listing', () => {
  it('registers exactly 7 canonical tools at bootstrap (3 from 41h.0 + 4 from 41h.5)', () => {
    expect(taxAdvisorToolRegistry.size()).toBe(7);
  });

  it('lists tools alphabetically', () => {
    const names = taxAdvisorToolRegistry.list().map((t) => t.name);
    expect(names).toEqual([
      'getCgtExposure',
      'getContributionCapHeadroom',
      'getDiv7aRisk',
      'getEntityTaxPosition',
      'getInHouseAssetRatio',
      'getLandTaxPosition',
      'runContributionScenario',
    ]);
  });

  it('throws on duplicate registration', () => {
    expect(() =>
      taxAdvisorToolRegistry.register(getContributionCapHeadroomTool),
    ).toThrow(/already registered/i);
  });

  it('returns undefined for unknown tool', () => {
    expect(taxAdvisorToolRegistry.get('recommendStructuralChange')).toBeUndefined();
  });
});

describe('HR-1 / HR-2 / D-2 structural enforcement', () => {
  it('D-2: every registered tool has kind FACT_LOOKUP or SCENARIO_RUN — no RECOMMENDATION', () => {
    for (const tool of taxAdvisorToolRegistry.list()) {
      expect(['FACT_LOOKUP', 'SCENARIO_RUN']).toContain(tool.kind);
      expect(tool.kind).not.toBe('RECOMMENDATION' as never);
    }
  });

  it('D-2: assertToolKind throws if a tool with an unsupported kind is presented', () => {
    expect(() =>
      assertToolKind({
        name: 'fakeRecommend',
        kind: 'RECOMMENDATION' as never,
        description: 'evil',
        inputSchema: { type: 'object', properties: {}, required: [] },
        execute: () => {
          throw new Error('should not reach');
        },
      }),
    ).toThrow(/D-2 boundary/);
  });

  it('HR-1: every tool result emits numericFields with stable paths', () => {
    // Run cap headroom tool — it returns deterministic numeric fields.
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 10_000,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    expect(synced).not.toBeNull();
    if (!synced) return;

    expect(synced.numericFields.length).toBeGreaterThan(0);
    for (const f of synced.numericFields) {
      expect(typeof f.path).toBe('string');
      expect(f.path.length).toBeGreaterThan(0);
      expect(typeof f.value).toBe('number');
      expect(['AUD', 'PERCENT', 'RATIO', 'COUNT', 'YEARS']).toContain(f.unit);
      expect(typeof f.label).toBe('string');
      expect(Array.isArray(f.citationIds)).toBe(true);
    }
  });

  it('HR-2: every numericField citationId resolves to an actual citation in the same result', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 10_000,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    const citationIdSet = new Set(synced.citations.map((c) => c.id));
    for (const f of synced.numericFields) {
      for (const cid of f.citationIds) {
        expect(citationIdSet.has(cid)).toBe(true);
      }
    }
  });

  it('HR-2: every citation has kind + reference + lastReviewed', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 10_000,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    for (const c of synced.citations) {
      expect(c.kind).toMatch(/^(ITAA_1936|ITAA_1997|SIS_ACT|TR|TD|PCG|PS_LA|STATE_DUTIES_ACT|STATE_LAND_TAX_ACT)$/);
      expect(c.reference.length).toBeGreaterThan(0);
      expect(c.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.id).toMatch(/^cit-/);
    }
  });
});

describe('Tool: getContributionCapHeadroom', () => {
  it('returns concessional cap headroom for FY24-25', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 22_000,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    const cap = synced.numericFields.find((n) => n.path === 'contributionCaps.concessional.cap');
    expect(cap?.value).toBe(30_000);
    const remaining = synced.numericFields.find((n) => n.path === 'contributionCaps.concessional.remaining');
    expect(remaining?.value).toBe(8_000);
  });

  it('cites s291-20 + s292-85', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 0,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    expect(synced.citations.some((c) => c.reference.includes('s291-20'))).toBe(true);
    expect(synced.citations.some((c) => c.reference.includes('s292-85'))).toBe(true);
  });

  it('narrativeText embeds [cit:cit-N] tokens, never raw legal claims', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 22_000,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    expect(synced.narrativeText).toMatch(/\[cit:cit-\d+\]/);
  });
});

describe('Tool: getLandTaxPosition', () => {
  it('returns cross-state aggregated land tax', () => {
    const result = getLandTaxPositionTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
      properties: [
        { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
      ],
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    const total = synced.numericFields.find((n) => n.path === 'landTax.grandTotalTax');
    expect(total?.value).toBeGreaterThan(0);
  });

  it('surfaces UC-MULTI-STATE-LAND-TAX from underlying calc', () => {
    const result = getLandTaxPositionTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
      properties: [
        { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
      ],
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    expect(synced.uncomputed.some((u) => u.id === 'UC-MULTI-STATE-LAND-TAX')).toBe(true);
  });
});

describe('Tool: getEntityTaxPosition', () => {
  const fy = { financialYear: '2024-25', label: 'FY24-25' };

  it('returns assessableIncome + taxableIncome + netTax for PERSONAL_NAME', () => {
    const result = getEntityTaxPositionTool.execute({
      entityId: 'e1',
      entityType: 'PERSONAL_NAME',
      fy,
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
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    expect(synced.numericFields.some((n) => n.path === 'entity.e1.taxableIncome')).toBe(true);
    expect(synced.numericFields.some((n) => n.path === 'entity.e1.netTax')).toBe(true);
  });
});

describe('ToolSession utilities', () => {
  it('findNumericFieldInSession resolves a path that exists in any prior invocation', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 22_000,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    const session: ToolSession = {
      sessionId: 's1',
      startedAt: '2026-05-05T00:00:00Z',
      invocations: [{ toolName: 'getContributionCapHeadroom', input: {}, result: synced }],
    };
    const found = findNumericFieldInSession(session, 'contributionCaps.concessional.cap');
    expect(found?.value).toBe(30_000);
  });

  it('findNumericFieldInSession returns undefined for a non-existent path (HR-1: AI cannot fabricate)', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 22_000,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    const session: ToolSession = {
      sessionId: 's1',
      startedAt: '2026-05-05T00:00:00Z',
      invocations: [{ toolName: 'getContributionCapHeadroom', input: {}, result: synced }],
    };
    expect(findNumericFieldInSession(session, 'fabricated.path.notReal')).toBeUndefined();
  });

  it('findCitationInSession resolves composite ids', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 0,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    const session: ToolSession = {
      sessionId: 's1',
      startedAt: '2026-05-05T00:00:00Z',
      invocations: [{ toolName: 'getContributionCapHeadroom', input: {}, result: synced }],
    };
    const found = findCitationInSession(session, 'getContributionCapHeadroom#cit-1');
    expect(found?.reference).toContain('s291-20');
  });

  it('findCitationInSession returns undefined for a fabricated citation id (HR-2)', () => {
    const result = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 0,
      nonConcessionalYTD: 0,
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    const session: ToolSession = {
      sessionId: 's1',
      startedAt: '2026-05-05T00:00:00Z',
      invocations: [{ toolName: 'getContributionCapHeadroom', input: {}, result: synced }],
    };
    expect(findCitationInSession(session, 'getContributionCapHeadroom#cit-99-fake')).toBeUndefined();
  });

  it('collectSessionCitations de-dupes across multiple tool invocations', () => {
    const r1 = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 0,
      nonConcessionalYTD: 0,
    }) as ReturnType<typeof getContributionCapHeadroomTool.execute>;
    const r2 = getContributionCapHeadroomTool.execute({
      financialYear: '2024-25',
      concessionalYTD: 5_000,
      nonConcessionalYTD: 0,
    }) as ReturnType<typeof getContributionCapHeadroomTool.execute>;
    const a = r1 as Awaited<typeof r1>;
    const b = r2 as Awaited<typeof r2>;

    const session: ToolSession = {
      sessionId: 's1',
      startedAt: '2026-05-05T00:00:00Z',
      invocations: [
        { toolName: 'getContributionCapHeadroom', input: {}, result: a },
        { toolName: 'getContributionCapHeadroom', input: {}, result: b },
      ],
    };
    const all = collectSessionCitations(session);
    // Same tool called twice — citations should de-dupe to the unique kind|reference set
    expect(all.length).toBe(a.citations.length);
  });

  it('collectSessionUncomputed de-dupes by id', () => {
    const result = getLandTaxPositionTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
      properties: [
        { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
      ],
    });
    const synced = result instanceof Promise ? null : result;
    if (!synced) return;

    const session: ToolSession = {
      sessionId: 's1',
      startedAt: '2026-05-05T00:00:00Z',
      invocations: [
        { toolName: 'getLandTaxPosition', input: {}, result: synced },
        { toolName: 'getLandTaxPosition', input: {}, result: synced },
      ],
    };
    const ids = collectSessionUncomputed(session).map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
  });
});

describe('Tool descriptions — HR-1 / HR-2 contract language', () => {
  it('every tool description identifies kind FACT_LOOKUP and disclaims recommendation', () => {
    for (const tool of taxAdvisorToolRegistry.list()) {
      const lc = tool.description.toLowerCase();
      // Must clearly state the tool is a fact-lookup, not a recommendation.
      expect(lc).toMatch(/fact_lookup|fact lookup|does not recommend/);
    }
  });

  it('no tool name contains "recommend", "estimate", "guess", "suggest"', () => {
    const banned = ['recommend', 'estimate', 'guess', 'suggest'];
    for (const tool of taxAdvisorToolRegistry.list()) {
      for (const word of banned) {
        expect(tool.name.toLowerCase()).not.toContain(word);
      }
    }
  });
});
