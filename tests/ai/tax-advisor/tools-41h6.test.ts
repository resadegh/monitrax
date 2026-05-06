/**
 * Phase 41h.6 — Tests for the SCENARIO_RUN tools expansion.
 *
 * 3 new tools (all SCENARIO_RUN):
 *   - runCgtScenario
 *   - runLandTaxScenario
 *   - runDiv7aRefinanceScenario
 *
 * Tests verify:
 *   - HR-1: every numericField has stable path + numeric value
 *   - HR-2: every numericField citationId resolves to a real citation
 *   - D-2: kind === 'SCENARIO_RUN', description disclaims recommendation
 *   - Baseline + scenario + delta numerical fields all present
 *   - Zero-hypothetical produces zero-delta (idempotency invariant)
 *   - Per-tool fact correctness against fixtures from underlying engines
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  taxAdvisorToolRegistry,
  bootstrapTaxAdvisorRegistry,
  runCgtScenarioTool,
  runLandTaxScenarioTool,
  runDiv7aRefinanceScenarioTool,
} from '@/lib/ai/tax-advisor';

beforeEach(() => {
  taxAdvisorToolRegistry.__testOnlyClear();
  bootstrapTaxAdvisorRegistry();
});

// ============================================================
// runCgtScenario
// ============================================================

describe('runCgtScenario (SCENARIO_RUN)', () => {
  it('exposes baseline + scenario + delta numeric fields', () => {
    const r = runCgtScenarioTool.execute({
      entityType: 'PERSONAL_NAME',
      currentEvents: [
        { id: 'e1', monthsHeld: 18, nominalAmount: 100_000, label: 'Property A sale (current)' },
      ],
      hypotheticalEvents: [
        { id: 'h1', monthsHeld: 24, nominalAmount: 50_000, label: 'Hypothetical: shares B' },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    expect(synced).not.toBeNull();
    if (!synced) return;

    expect(
      synced.numericFields.some((n) => n.path === 'scenario.baseline.assessableNetCapitalGain'),
    ).toBe(true);
    expect(
      synced.numericFields.some((n) => n.path === 'scenario.result.assessableNetCapitalGain'),
    ).toBe(true);
    expect(
      synced.numericFields.some((n) => n.path === 'scenario.delta.assessableNetCapitalGain'),
    ).toBe(true);
    expect(
      synced.numericFields.find((n) => n.path === 'scenario.input.hypotheticalEventCount')?.value,
    ).toBe(1);
  });

  it('zero hypothetical events → zero delta (idempotency invariant)', () => {
    const r = runCgtScenarioTool.execute({
      entityType: 'PERSONAL_NAME',
      currentEvents: [
        { id: 'e1', monthsHeld: 18, nominalAmount: 80_000 },
      ],
      hypotheticalEvents: [],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const delta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.assessableNetCapitalGain',
    );
    expect(delta?.value).toBe(0);
  });

  it('hypothetical gain increases assessable net CG (delta > 0)', () => {
    const r = runCgtScenarioTool.execute({
      entityType: 'PERSONAL_NAME',
      currentEvents: [],
      hypotheticalEvents: [
        { id: 'h1', monthsHeld: 24, nominalAmount: 200_000 },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const delta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.assessableNetCapitalGain',
    );
    expect(delta?.value).toBeGreaterThan(0);
  });

  it('hypothetical loss reduces assessable net CG (delta ≤ 0)', () => {
    const r = runCgtScenarioTool.execute({
      entityType: 'PERSONAL_NAME',
      currentEvents: [
        { id: 'e1', monthsHeld: 24, nominalAmount: 100_000 },
      ],
      hypotheticalEvents: [
        { id: 'h1', monthsHeld: 6, nominalAmount: -30_000 },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const delta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.assessableNetCapitalGain',
    );
    expect(delta?.value).toBeLessThanOrEqual(0);
  });

  it('echoes summed hypothetical gains / losses as input fields', () => {
    const r = runCgtScenarioTool.execute({
      entityType: 'PERSONAL_NAME',
      currentEvents: [],
      hypotheticalEvents: [
        { id: 'h1', monthsHeld: 24, nominalAmount: 100_000 },
        { id: 'h2', monthsHeld: 6, nominalAmount: -25_000 },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    expect(
      synced.numericFields.find((n) => n.path === 'scenario.input.hypotheticalGains')?.value,
    ).toBe(100_000);
    expect(
      synced.numericFields.find((n) => n.path === 'scenario.input.hypotheticalLosses')?.value,
    ).toBe(25_000);
  });

  it('cites Div 102-A / s100-50 / s115-100 (HR-2)', () => {
    const r = runCgtScenarioTool.execute({
      entityType: 'PERSONAL_NAME',
      currentEvents: [],
      hypotheticalEvents: [{ id: 'h1', monthsHeld: 24, nominalAmount: 50_000 }],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const refs = synced.citations.map((c) => c.reference).join(' ');
    expect(refs).toMatch(/Div 102-A|s100-50|s115/);
  });

  it('every numericField citationId resolves to a real citation', () => {
    const r = runCgtScenarioTool.execute({
      entityType: 'PERSONAL_NAME',
      currentEvents: [],
      hypotheticalEvents: [{ id: 'h1', monthsHeld: 24, nominalAmount: 50_000 }],
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
// runLandTaxScenario
// ============================================================

describe('runLandTaxScenario (SCENARIO_RUN)', () => {
  it('exposes baseline + scenario + delta numeric fields', () => {
    const r = runLandTaxScenarioTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
      currentProperties: [
        { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
      ],
      hypotheticalProperties: [
        { propertyId: 'h1', state: 'QLD', taxableLandValue: 1_200_000, isResidential: true },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;

    expect(synced.numericFields.some((n) => n.path === 'scenario.baseline.grandTotalTax')).toBe(
      true,
    );
    expect(synced.numericFields.some((n) => n.path === 'scenario.result.grandTotalTax')).toBe(true);
    expect(synced.numericFields.some((n) => n.path === 'scenario.delta.grandTotalTax')).toBe(true);
  });

  it('zero hypothetical properties → zero delta (idempotency)', () => {
    const r = runLandTaxScenarioTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
      currentProperties: [
        { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
      ],
      hypotheticalProperties: [],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const delta = synced.numericFields.find((n) => n.path === 'scenario.delta.grandTotalTax');
    expect(delta?.value).toBe(0);
    expect(
      synced.numericFields.find((n) => n.path === 'scenario.input.hypotheticalPropertyCount')
        ?.value,
    ).toBe(0);
  });

  it('adding a hypothetical property in a NEW state increases statesAssessed', () => {
    const r = runLandTaxScenarioTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
      currentProperties: [
        { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
      ],
      hypotheticalProperties: [
        { propertyId: 'h1', state: 'QLD', taxableLandValue: 1_200_000, isResidential: true },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const baselineStates = synced.numericFields.find(
      (n) => n.path === 'scenario.baseline.statesAssessed',
    )?.value;
    const resultStates = synced.numericFields.find(
      (n) => n.path === 'scenario.result.statesAssessed',
    )?.value;
    expect(baselineStates).toBe(1);
    expect(resultStates).toBe(2);
  });

  it('echoes sum of hypothetical taxable land values', () => {
    const r = runLandTaxScenarioTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
      currentProperties: [],
      hypotheticalProperties: [
        { propertyId: 'h1', state: 'QLD', taxableLandValue: 1_200_000, isResidential: true },
        { propertyId: 'h2', state: 'VIC', taxableLandValue: 800_000, isResidential: false },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    expect(
      synced.numericFields.find((n) => n.path === 'scenario.input.hypotheticalTotalValue')?.value,
    ).toBe(2_000_000);
  });

  it('foreign owner hypothetical residential increases foreign surcharge', () => {
    const r = runLandTaxScenarioTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: true,
      currentProperties: [],
      hypotheticalProperties: [
        { propertyId: 'h1', state: 'NSW', taxableLandValue: 2_000_000, isResidential: true },
      ],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const surchargeDelta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.grandTotalForeignSurcharge',
    );
    expect(surchargeDelta?.value).toBeGreaterThan(0);
  });

  it('every numericField citationId resolves (HR-2)', () => {
    const r = runLandTaxScenarioTool.execute({
      ownershipType: 'INDIVIDUAL',
      isForeignOwner: false,
      currentProperties: [
        { propertyId: 'p1', state: 'NSW', taxableLandValue: 1_500_000, isResidential: true },
      ],
      hypotheticalProperties: [
        { propertyId: 'h1', state: 'QLD', taxableLandValue: 1_200_000, isResidential: true },
      ],
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
// runDiv7aRefinanceScenario
// ============================================================

describe('runDiv7aRefinanceScenario (SCENARIO_RUN)', () => {
  it('flipping a NO_AGREEMENT loan to compliant reduces total deemed dividend', () => {
    const r = runDiv7aRefinanceScenarioTool.execute({
      currentLoans: [
        {
          loanId: 'L1',
          openingBalance: 100_000,
          yearsRemaining: 7,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 20_000, // generous payment so MRP would clear if agreement existed
          hasComplianceAgreement: false,
        },
      ],
      loanIdsToRefinance: ['L1'],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const baseline = synced.numericFields.find(
      (n) => n.path === 'scenario.baseline.totalDeemedDividend',
    );
    const result = synced.numericFields.find(
      (n) => n.path === 'scenario.result.totalDeemedDividend',
    );
    const delta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.totalDeemedDividend',
    );
    expect(baseline?.value).toBeGreaterThan(0);
    expect(result?.value ?? 0).toBeLessThan(baseline?.value ?? Infinity);
    expect(delta?.value ?? 0).toBeLessThanOrEqual(0);
  });

  it('zero loanIdsToRefinance → zero delta (idempotency)', () => {
    const r = runDiv7aRefinanceScenarioTool.execute({
      currentLoans: [
        {
          loanId: 'L1',
          openingBalance: 50_000,
          yearsRemaining: 5,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 0,
          hasComplianceAgreement: false,
        },
      ],
      loanIdsToRefinance: [],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const delta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.totalDeemedDividend',
    );
    expect(delta?.value).toBe(0);
    expect(
      synced.numericFields.find((n) => n.path === 'scenario.input.refinancedLoanCount')?.value,
    ).toBe(0);
  });

  it('flipping a loan increases COMPLIANT loan count', () => {
    const r = runDiv7aRefinanceScenarioTool.execute({
      currentLoans: [
        {
          loanId: 'L1',
          openingBalance: 50_000,
          yearsRemaining: 5,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 15_000, // generous — would be COMPLIANT if agreement existed
          hasComplianceAgreement: false,
        },
      ],
      loanIdsToRefinance: ['L1'],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const baselineCompliant = synced.numericFields.find(
      (n) => n.path === 'scenario.baseline.compliantLoanCount',
    )?.value;
    const resultCompliant = synced.numericFields.find(
      (n) => n.path === 'scenario.result.compliantLoanCount',
    )?.value;
    expect(baselineCompliant).toBe(0);
    expect(resultCompliant).toBe(1);
    const compliantDelta = synced.numericFields.find(
      (n) => n.path === 'scenario.delta.compliantLoanCount',
    );
    expect(compliantDelta?.value).toBe(1);
  });

  it('only flips the loans listed in loanIdsToRefinance — leaves others untouched', () => {
    const r = runDiv7aRefinanceScenarioTool.execute({
      currentLoans: [
        {
          loanId: 'L1',
          openingBalance: 50_000,
          yearsRemaining: 5,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 15_000,
          hasComplianceAgreement: false,
        },
        {
          loanId: 'L2',
          openingBalance: 80_000,
          yearsRemaining: 6,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 20_000,
          hasComplianceAgreement: false, // stays non-compliant in scenario
        },
      ],
      loanIdsToRefinance: ['L1'],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    expect(
      synced.numericFields.find((n) => n.path === 'scenario.result.compliantLoanCount')?.value,
    ).toBe(1); // only L1 flipped
  });

  it('cites Div 7A authority (s109* / s109N) — HR-2', () => {
    const r = runDiv7aRefinanceScenarioTool.execute({
      currentLoans: [
        {
          loanId: 'L1',
          openingBalance: 50_000,
          yearsRemaining: 5,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 0,
          hasComplianceAgreement: false,
        },
      ],
      loanIdsToRefinance: ['L1'],
    });
    const synced = r instanceof Promise ? null : r;
    if (!synced) return;
    const refs = synced.citations.map((c) => c.reference).join(' ');
    expect(refs).toMatch(/s109|Div 7A/i);
  });
});

// ============================================================
// HR-1 / HR-2 / D-2 contract — applies to all 3 new tools
// ============================================================

describe('HR-1 / HR-2 / D-2 contract — Phase 41h.6 SCENARIO_RUN tools', () => {
  const tools = [
    {
      name: 'runCgtScenario',
      tool: runCgtScenarioTool,
      sample: {
        entityType: 'PERSONAL_NAME' as const,
        currentEvents: [],
        hypotheticalEvents: [],
      },
    },
    {
      name: 'runLandTaxScenario',
      tool: runLandTaxScenarioTool,
      sample: {
        ownershipType: 'INDIVIDUAL' as const,
        isForeignOwner: false,
        currentProperties: [],
        hypotheticalProperties: [],
      },
    },
    {
      name: 'runDiv7aRefinanceScenario',
      tool: runDiv7aRefinanceScenarioTool,
      sample: { currentLoans: [], loanIdsToRefinance: [] },
    },
  ];

  for (const { name, tool, sample } of tools) {
    it(`${name} — kind === 'SCENARIO_RUN' (D-2 boundary)`, () => {
      expect(tool.kind).toBe('SCENARIO_RUN');
    });

    it(`${name} — description disclaims recommendation (D-2)`, () => {
      const lc = tool.description.toLowerCase();
      expect(lc).toMatch(/scenario_run|does not recommend/);
    });

    it(`${name} — name does NOT contain banned words`, () => {
      const banned = ['recommend', 'estimate', 'guess', 'suggest'];
      for (const word of banned) {
        expect(tool.name.toLowerCase()).not.toContain(word);
      }
    });

    it(`${name} — every numericField has stable path + numeric value (HR-1)`, async () => {
      const r = await tool.execute(sample as never);
      expect(r.numericFields.length).toBeGreaterThan(0);
      for (const f of r.numericFields) {
        expect(typeof f.path).toBe('string');
        expect(f.path.length).toBeGreaterThan(0);
        expect(typeof f.value).toBe('number');
        expect(['AUD', 'PERCENT', 'RATIO', 'COUNT', 'YEARS']).toContain(f.unit);
      }
    });

    it(`${name} — every citation has kind + reference + lastReviewed + id (HR-2)`, async () => {
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

    it(`${name} — exposes scenario.baseline.*, scenario.input.*, scenario.result.*, scenario.delta.* paths`, async () => {
      const r = await tool.execute(sample as never);
      const paths = r.numericFields.map((f) => f.path);
      expect(paths.some((p) => p.startsWith('scenario.baseline.'))).toBe(true);
      expect(paths.some((p) => p.startsWith('scenario.input.'))).toBe(true);
      expect(paths.some((p) => p.startsWith('scenario.result.'))).toBe(true);
      expect(paths.some((p) => p.startsWith('scenario.delta.'))).toBe(true);
    });
  }
});
