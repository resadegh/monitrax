/**
 * Phase 41h.5 — Tests for the new tools.
 *
 * 4 new tools (3 FACT_LOOKUP + 1 SCENARIO_RUN) close Phase 41h.
 * Tests verify:
 *   - HR-1 / HR-2 contract: every numericField has stable path,
 *     citations are well-formed, citationIds resolve
 *   - Per-tool fact correctness (output values match underlying
 *     calc engine for known fixtures)
 *   - SCENARIO_RUN tool exposes both baseline + scenario + delta
 *   - Registry size grows from 3 → 7; SCENARIO_RUN kind appears
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  taxAdvisorToolRegistry,
  bootstrapTaxAdvisorRegistry,
  getCgtExposureTool,
  getDiv7aRiskTool,
  getInHouseAssetRatioTool,
  runContributionScenarioTool,
} from '@/lib/ai/tax-advisor';

beforeEach(() => {
  taxAdvisorToolRegistry.__testOnlyClear();
  bootstrapTaxAdvisorRegistry();
});

describe('Phase 41h.5/6 + 41f.4-extension + 41E.2 — registry contains 13 tools (5 SCENARIO_RUN + 8 FACT_LOOKUP)', () => {
  it('registry size = 13', () => {
    // Phase 41h.5 (4) + 41h.6 (3 SCENARIO_RUN additions) + 41h.0 (3) +
    // 41f.4-ext (getTrustDeedRules) + 41E.2 (getReformedTaxRegimeStatus +
    // getReformImpactSummaryForUser). See `lib/ai/tax-advisor/index.ts`
    // CANONICAL_TOOLS docstring for the running count.
    expect(taxAdvisorToolRegistry.size()).toBe(13);
  });

  it('exactly five SCENARIO_RUN tools registered (41h.5 + 41h.6 + 41E.2)', () => {
    const scenarios = taxAdvisorToolRegistry
      .list()
      .filter((t) => t.kind === 'SCENARIO_RUN')
      .map((t) => t.name)
      .sort();
    expect(scenarios).toEqual([
      'getReformImpactSummaryForUser',
      'runCgtScenario',
      'runContributionScenario',
      'runDiv7aRefinanceScenario',
      'runLandTaxScenario',
    ]);
  });

  it('all other tools remain FACT_LOOKUP', () => {
    const facts = taxAdvisorToolRegistry.list().filter((t) => t.kind === 'FACT_LOOKUP');
    expect(facts).toHaveLength(8);
  });

  it('every 41h.5 tool name appears in the registry', () => {
    const names = taxAdvisorToolRegistry.list().map((t) => t.name);
    expect(names).toContain('getCgtExposure');
    expect(names).toContain('getDiv7aRisk');
    expect(names).toContain('getInHouseAssetRatio');
    expect(names).toContain('runContributionScenario');
  });
});

// ============================================================
// getCgtExposure
// ============================================================

describe('getCgtExposure', () => {
  it('returns assessable net gain after netting + discount', () => {
    const r = getCgtExposureTool.execute({
      entityType: 'INDIVIDUAL',
      events: [
        {
          eventId: 'sale-property-A',
          label: 'Sale of investment property A',
          nominalAmount: 100_000,
          discountEligible: true,
        },
        {
          eventId: 'sale-shares-B',
          label: 'Sale of shares B',
          nominalAmount: -20_000,
          discountEligible: false,
        },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    expect(synced).not.toBeNull();
    if (!synced) return;

    const total = synced.numericFields.find((n) => n.path === 'cgt.totalNominalGains');
    expect(total?.value).toBe(100_000);
    const losses = synced.numericFields.find((n) => n.path === 'cgt.totalCurrentYearLosses');
    expect(losses?.value).toBe(20_000);
    const netBeforeDiscount = synced.numericFields.find((n) => n.path === 'cgt.netGainBeforeDiscount');
    expect(netBeforeDiscount?.value).toBe(80_000);
  });

  it('cites Div 102-A / s100-50 / s115-100 from underlying engine', () => {
    const r = getCgtExposureTool.execute({
      entityType: 'INDIVIDUAL',
      events: [{ eventId: 'e1', nominalAmount: 50_000, discountEligible: true }],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    expect(synced.citations.length).toBeGreaterThan(0);
    const refs = synced.citations.map((c) => c.reference).join(' ');
    expect(refs).toMatch(/Div 102-A|s100-50|s115/);
  });

  it('every numericField citationId resolves to a real citation', () => {
    const r = getCgtExposureTool.execute({
      entityType: 'INDIVIDUAL',
      events: [{ eventId: 'e1', nominalAmount: 50_000, discountEligible: true }],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const idSet = new Set(synced.citations.map((c) => c.id));
    for (const f of synced.numericFields) {
      for (const cid of f.citationIds) {
        expect(idSet.has(cid)).toBe(true);
      }
    }
  });
});

// ============================================================
// getDiv7aRisk
// ============================================================

describe('getDiv7aRisk', () => {
  it('classifies a compliant loan with no deemed dividend', () => {
    const r = getDiv7aRiskTool.execute({
      loans: [
        {
          loanId: 'L1',
          openingBalance: 50_000,
          yearsRemaining: 5,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 15_000, // generous payment
          hasComplianceAgreement: true,
        },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const loanCount = synced.numericFields.find((n) => n.path === 'div7a.loanCount');
    expect(loanCount?.value).toBe(1);
    const compliant = synced.numericFields.find((n) => n.path === 'div7a.compliantLoanCount');
    expect(compliant?.value).toBe(1);
  });

  it('classifies NO_AGREEMENT loan as deemed dividend', () => {
    const r = getDiv7aRiskTool.execute({
      loans: [
        {
          loanId: 'L1',
          openingBalance: 100_000,
          yearsRemaining: 7,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 0,
          hasComplianceAgreement: false,
        },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const total = synced.numericFields.find((n) => n.path === 'div7a.totalDeemedDividend');
    expect(total?.value).toBeGreaterThan(0);
    const atRisk = synced.numericFields.find((n) => n.path === 'div7a.atRiskLoanCount');
    expect(atRisk?.value).toBe(1);
  });

  it('handles zero-loan input gracefully', () => {
    const r = getDiv7aRiskTool.execute({ loans: [] });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    expect(synced.numericFields.find((n) => n.path === 'div7a.loanCount')?.value).toBe(0);
    expect(synced.numericFields.find((n) => n.path === 'div7a.totalDeemedDividend')?.value).toBe(0);
  });
});

// ============================================================
// getInHouseAssetRatio
// ============================================================

describe('getInHouseAssetRatio', () => {
  it('5% cap — within → COMPLIANT', () => {
    const r = getInHouseAssetRatioTool.execute({
      totalFundValue: 1_000_000,
      meetsSolePurposeTest: true,
      fyIncome: 50_000,
      hasNonArmsLengthIncome: false,
      inHouseAssets: [{ assetId: 'a1', marketValue: 30_000 }], // 3%
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const breachAmount = synced.numericFields.find(
      (n) => n.path === 'smsf.inHouseAsset.breachAmount',
    );
    expect(breachAmount?.value).toBe(0);
    const pct = synced.numericFields.find((n) => n.path === 'smsf.inHouseAsset.breachPercentage');
    expect(pct?.value).toBeCloseTo(0.03, 4);
  });

  it('5% cap — exceed → BREACH with breach amount + percentage', () => {
    const r = getInHouseAssetRatioTool.execute({
      totalFundValue: 1_000_000,
      meetsSolePurposeTest: true,
      fyIncome: 50_000,
      hasNonArmsLengthIncome: false,
      inHouseAssets: [{ assetId: 'a1', marketValue: 80_000 }], // 8%
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const breachAmount = synced.numericFields.find(
      (n) => n.path === 'smsf.inHouseAsset.breachAmount',
    );
    expect(breachAmount?.value).toBe(30_000); // 80k - 50k cap
    const pct = synced.numericFields.find((n) => n.path === 'smsf.inHouseAsset.breachPercentage');
    expect(pct?.value).toBeCloseTo(0.08, 4);
  });

  it('always cites SIS Act Pt 8', () => {
    const r = getInHouseAssetRatioTool.execute({
      totalFundValue: 500_000,
      meetsSolePurposeTest: true,
      fyIncome: 0,
      hasNonArmsLengthIncome: false,
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const refs = synced.citations.map((c) => c.reference).join(' ');
    expect(refs).toMatch(/Pt 8|s71|in-house/i);
  });
});

// ============================================================
// runContributionScenario (SCENARIO_RUN)
// ============================================================

describe('runContributionScenario (SCENARIO_RUN)', () => {
  it('returns both baseline + scenario + delta numeric fields', () => {
    const r = runContributionScenarioTool.execute({
      financialYear: '2024-25',
      currentConcessionalYTD: 22_000,
      currentNonConcessionalYTD: 0,
      additionalConcessional: 5_000,
      additionalNonConcessional: 0,
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;

    // Baseline
    expect(
      synced.numericFields.some((n) => n.path === 'scenario.baseline.concessional.remaining'),
    ).toBe(true);
    // Scenario inputs echoed
    expect(
      synced.numericFields.find((n) => n.path === 'scenario.input.additionalConcessional')?.value,
    ).toBe(5_000);
    // Scenario result
    expect(
      synced.numericFields.some((n) => n.path === 'scenario.result.concessional.remaining'),
    ).toBe(true);
    // Delta
    const delta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.concessionalRemaining',
    );
    expect(delta?.value).toBe(-5_000); // headroom drops by $5k
  });

  it('hypothetical of zero produces zero delta', () => {
    const r = runContributionScenarioTool.execute({
      financialYear: '2024-25',
      currentConcessionalYTD: 22_000,
      currentNonConcessionalYTD: 0,
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const delta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.concessionalRemaining',
    );
    expect(delta?.value).toBe(0);
  });

  it('scenario crossing the cap surfaces excess contributions tax delta', () => {
    const r = runContributionScenarioTool.execute({
      financialYear: '2024-25',
      currentConcessionalYTD: 28_000,
      currentNonConcessionalYTD: 0,
      additionalConcessional: 10_000, // pushes from $28k → $38k, well over $30k cap
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const excessDelta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.excessContributionsTax',
    );
    expect(excessDelta?.value).toBeGreaterThan(0);
  });

  it('cites s291-20 + s292-85 + Div 291/292 (excess tax)', () => {
    const r = runContributionScenarioTool.execute({
      financialYear: '2024-25',
      currentConcessionalYTD: 0,
      currentNonConcessionalYTD: 0,
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    expect(synced.citations.some((c) => c.reference.includes('s291-20'))).toBe(true);
    expect(synced.citations.some((c) => c.reference.includes('s292-85'))).toBe(true);
    expect(synced.citations.some((c) => c.reference.includes('Div 291'))).toBe(true);
  });

  it('every numericField citationId resolves (HR-2)', () => {
    const r = runContributionScenarioTool.execute({
      financialYear: '2024-25',
      currentConcessionalYTD: 22_000,
      currentNonConcessionalYTD: 0,
      additionalConcessional: 5_000,
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const idSet = new Set(synced.citations.map((c) => c.id));
    for (const f of synced.numericFields) {
      for (const cid of f.citationIds) {
        expect(idSet.has(cid)).toBe(true);
      }
    }
  });
});

// ============================================================
// HR-1 / HR-2 contract — applies to every new tool
// ============================================================

describe('HR-1 / HR-2 / D-2 contract — applies to all new tools', () => {
  const tools = [
    { name: 'getCgtExposure', tool: getCgtExposureTool, sample: { entityType: 'INDIVIDUAL' as const, events: [] } },
    { name: 'getDiv7aRisk', tool: getDiv7aRiskTool, sample: { loans: [] } },
    {
      name: 'getInHouseAssetRatio',
      tool: getInHouseAssetRatioTool,
      sample: {
        totalFundValue: 100_000,
        meetsSolePurposeTest: true,
        fyIncome: 0,
        hasNonArmsLengthIncome: false,
      },
    },
    {
      name: 'runContributionScenario',
      tool: runContributionScenarioTool,
      sample: {
        financialYear: '2024-25',
        currentConcessionalYTD: 0,
        currentNonConcessionalYTD: 0,
      },
    },
  ];

  for (const { name, tool, sample } of tools) {
    it(`${name} — every numericField has stable path`, async () => {
      const r = await tool.execute(sample as never);
      for (const f of r.numericFields) {
        expect(typeof f.path).toBe('string');
        expect(f.path.length).toBeGreaterThan(0);
        expect(typeof f.value).toBe('number');
      }
    });

    it(`${name} — every citation has kind + reference + lastReviewed + id`, async () => {
      const r = await tool.execute(sample as never);
      for (const c of r.citations) {
        expect(c.kind).toMatch(
          /^(ITAA_1936|ITAA_1997|SIS_ACT|TR|TD|PCG|PS_LA|STATE_DUTIES_ACT|STATE_LAND_TAX_ACT)$/,
        );
        expect(c.reference.length).toBeGreaterThan(0);
        expect(c.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(c.id).toMatch(/^cit-/);
      }
    });

    it(`${name} — name does NOT contain banned words`, () => {
      const banned = ['recommend', 'estimate', 'guess', 'suggest'];
      for (const word of banned) {
        expect(tool.name.toLowerCase()).not.toContain(word);
      }
    });

    it(`${name} — description either fact_lookup-disclaim or scenario_run-disclaim`, () => {
      const lc = tool.description.toLowerCase();
      expect(lc).toMatch(/fact_lookup|fact lookup|scenario_run|does not recommend|use when/);
    });
  }
});
