/**
 * Phase 41h.5 — Tool: runContributionScenario (SCENARIO_RUN)
 *
 * First `SCENARIO_RUN` tool in the registry — establishes the
 * pattern for "what if" simulations. Re-invokes `trackContributionCaps`
 * with hypothetical additional contributions and returns both the
 * baseline and scenario results so the AI can narrate a delta.
 *
 * **Why SCENARIO_RUN, not FACT_LOOKUP**: the input includes
 * caller-supplied hypothetical contributions ("if I contribute $X
 * more"), which is a what-if calc — not a factual lookup of
 * current state. The kind discriminator surfaces this in the AI's
 * tool catalogue so the model picks SCENARIO_RUN tools when the
 * user asks scenario questions ("what if I…", "would it be worth
 * contributing more this FY?").
 *
 * **Discipline**: SCENARIO_RUN is still bound by HR-1 + HR-2. The
 * tool returns ONLY numbers from the underlying calc engine
 * (`trackContributionCaps`); the AI cannot author estimates. The
 * scenario inputs are recorded explicitly so the response surface
 * makes clear this is a hypothetical calc, not the user's actual
 * position.
 *
 * **D-2**: returning a scenario number is NOT a recommendation.
 * The tool surfaces "if you contribute $X more, your headroom
 * becomes $Y" — fact. "You should contribute $X more" remains
 * forbidden (HR-1 + D-2: no `recommend*` tool exists; and the
 * gateway's validator catches recommendation language in TIER_1
 * responses).
 */

import {
  trackContributionCapsDecimal,
  type CapTrackingInputDecimal,
} from '@/lib/tax-engine/super/capTracker';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { serializeDecimalsForJson } from '@/lib/decimal';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

interface RunContributionScenarioInput {
  financialYear: string;
  /** Current state. */
  currentConcessionalYTD: number;
  currentNonConcessionalYTD: number;
  totalSuperBalance?: number;
  carryForwardAmounts?: Array<{ financialYear: string; unusedAmount: number }>;
  /** Hypothetical additional contribution. */
  additionalConcessional?: number;
  additionalNonConcessional?: number;
}

export const runContributionScenarioTool: TaxAdvisorTool<RunContributionScenarioInput> = {
  name: 'runContributionScenario',
  kind: 'SCENARIO_RUN',
  description:
    'SCENARIO_RUN: re-invokes trackContributionCaps with hypothetical additional concessional / non-concessional contributions and returns BOTH baseline and scenario results. Use when the user asks "what if I contributed $X more". Does NOT recommend whether to contribute — it surfaces the resulting cap headroom + excess-tax risk so the user can decide.',
  inputSchema: {
    type: 'object',
    properties: {
      financialYear: {
        type: 'string',
        description: 'Financial year, e.g. "2024-25".',
      },
      currentConcessionalYTD: {
        type: 'number',
        description: 'Current concessional contributions YTD (AUD).',
      },
      currentNonConcessionalYTD: {
        type: 'number',
        description: 'Current non-concessional contributions YTD (AUD).',
      },
      totalSuperBalance: {
        type: 'number',
        description: 'Total super balance at 30 June of previous FY.',
      },
      additionalConcessional: {
        type: 'number',
        description: 'Hypothetical additional concessional contribution (AUD).',
      },
      additionalNonConcessional: {
        type: 'number',
        description: 'Hypothetical additional non-concessional contribution (AUD).',
      },
    },
    required: [
      'financialYear',
      'currentConcessionalYTD',
      'currentNonConcessionalYTD',
    ],
  },
  execute: (input) => {
    // Q-DEC PR 3.D — Decimal engine; per-field `.toNumber()` boundary.
    const config = getTaxYearConfig(input.financialYear);

    const baselineInput: CapTrackingInputDecimal = {
      concessionalYTD: input.currentConcessionalYTD,
      nonConcessionalYTD: input.currentNonConcessionalYTD,
      totalSuperBalance: input.totalSuperBalance,
      carryForwardAmounts: input.carryForwardAmounts,
    };
    const baseline = trackContributionCapsDecimal(baselineInput, config);

    const additionalC = input.additionalConcessional ?? 0;
    const additionalNC = input.additionalNonConcessional ?? 0;

    const scenarioInput: CapTrackingInputDecimal = {
      concessionalYTD: input.currentConcessionalYTD + additionalC,
      nonConcessionalYTD: input.currentNonConcessionalYTD + additionalNC,
      totalSuperBalance: input.totalSuperBalance,
      carryForwardAmounts: input.carryForwardAmounts,
    };
    const scenario = trackContributionCapsDecimal(scenarioInput, config);

    const citations: IdentifiedCitation[] = [
      {
        id: 'cit-1',
        kind: 'ITAA_1997',
        reference: 'ITAA 1997 s291-20 (concessional contributions cap)',
        lastReviewed: '2026-05-05',
      },
      {
        id: 'cit-2',
        kind: 'ITAA_1997',
        reference: 'ITAA 1997 s292-85 (non-concessional contributions cap)',
        lastReviewed: '2026-05-05',
      },
      {
        id: 'cit-3',
        kind: 'ITAA_1997',
        reference: 'ITAA 1997 Div 291 / 292 (excess contributions tax)',
        lastReviewed: '2026-05-05',
      },
    ];

    const numericFields: NumericField[] = [
      // Baseline
      {
        path: 'scenario.baseline.concessional.remaining',
        value: baseline.concessional.remaining.toNumber(),
        unit: 'AUD',
        label: 'Baseline concessional cap headroom',
        citationIds: ['cit-1'],
      },
      {
        path: 'scenario.baseline.nonConcessional.remaining',
        value: baseline.nonConcessional.remaining.toNumber(),
        unit: 'AUD',
        label: 'Baseline non-concessional cap headroom',
        citationIds: ['cit-2'],
      },
      {
        path: 'scenario.baseline.excessContributionsTax',
        value: baseline.excessContributionsTax.toNumber(),
        unit: 'AUD',
        label: 'Baseline excess contributions tax',
        citationIds: ['cit-3'],
      },
      // Scenario inputs (echoed for transparency)
      {
        path: 'scenario.input.additionalConcessional',
        value: additionalC,
        unit: 'AUD',
        label: 'Hypothetical additional concessional contribution',
        citationIds: [],
      },
      {
        path: 'scenario.input.additionalNonConcessional',
        value: additionalNC,
        unit: 'AUD',
        label: 'Hypothetical additional non-concessional contribution',
        citationIds: [],
      },
      // Scenario outcome
      {
        path: 'scenario.result.concessional.remaining',
        value: scenario.concessional.remaining.toNumber(),
        unit: 'AUD',
        label: 'Resulting concessional cap headroom (after hypothetical)',
        citationIds: ['cit-1'],
      },
      {
        path: 'scenario.result.nonConcessional.remaining',
        value: scenario.nonConcessional.remaining.toNumber(),
        unit: 'AUD',
        label: 'Resulting non-concessional cap headroom (after hypothetical)',
        citationIds: ['cit-2'],
      },
      {
        path: 'scenario.result.excessContributionsTax',
        value: scenario.excessContributionsTax.toNumber(),
        unit: 'AUD',
        label: 'Resulting excess contributions tax (after hypothetical)',
        citationIds: ['cit-3'],
      },
      // Delta (computed in-tool — still numeric facts, never AI-authored)
      {
        path: 'scenario.delta.concessionalRemaining',
        value: scenario.concessional.remaining.minus(baseline.concessional.remaining).toNumber(),
        unit: 'AUD',
        label: 'Change in concessional headroom (scenario − baseline)',
        citationIds: ['cit-1'],
      },
      {
        path: 'scenario.delta.excessContributionsTax',
        value: scenario.excessContributionsTax.minus(baseline.excessContributionsTax).toNumber(),
        unit: 'AUD',
        label: 'Change in excess contributions tax (scenario − baseline)',
        citationIds: ['cit-3'],
      },
    ];

    const narrativeText = [
      `Scenario: contributing an additional $${additionalC.toLocaleString()} concessional + $${additionalNC.toLocaleString()} non-concessional in ${input.financialYear} [cit:cit-1] [cit:cit-2].`,
      `Resulting concessional headroom: $${scenario.concessional.remaining.toNumber().toLocaleString()} (was $${baseline.concessional.remaining.toNumber().toLocaleString()}).`,
      `Resulting non-concessional headroom: $${scenario.nonConcessional.remaining.toNumber().toLocaleString()} (was $${baseline.nonConcessional.remaining.toNumber().toLocaleString()}).`,
      scenario.excessContributionsTax.gt(baseline.excessContributionsTax)
        ? `Excess contributions tax exposure increases to $${scenario.excessContributionsTax.toNumber().toLocaleString()} [cit:cit-3].`
        : 'No new excess contributions tax exposure.',
    ].join(' ');

    const out: ToolResult = {
      toolName: 'runContributionScenario',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: [],
      narrativeText,
      raw: serializeDecimalsForJson({ baseline, scenario, additionalC, additionalNC }),
    };
    return out;
  },
};
