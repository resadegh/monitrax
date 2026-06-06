/**
 * Phase 41h.6 — Tool: runLandTaxScenario (SCENARIO_RUN)
 *
 * "What if I bought a property in QLD for $X?" — re-invokes
 * `calculateCrossStateLandTax` with hypothetical additional
 * properties appended to the user's current portfolio. Returns
 * BOTH baseline (current portfolio) and scenario (current +
 * hypothetical) results, plus delta numerical fields.
 *
 * Authority: per-state Land Tax Acts (NSW Land Tax Act 1956,
 * VIC Land Tax Act 2005, QLD Land Tax Act 2010, etc.). Citations
 * lifted directly from the cross-state aggregator.
 *
 * **HR-1/HR-2 preserved**: every number computed by the calc
 * engine; AI just narrates.
 *
 * **D-2 preserved**: returning a scenario number is a fact
 * ("if you bought a $1.5M property in QLD, your annual land
 * tax would increase by $X"), not a recommendation.
 */

import {
  calculateCrossStateLandTaxDecimal,
  type CrossStateLandTaxInput,
  type PortfolioProperty,
} from '@/lib/tax-engine/landTax/crossStateAggregator';
import { serializeDecimalsForJson } from '@/lib/decimal';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

interface RunLandTaxScenarioInput {
  ownershipType: CrossStateLandTaxInput['ownershipType'];
  isForeignOwner: boolean;
  /** Current portfolio (the properties the user already owns). */
  currentProperties: PortfolioProperty[];
  /** Hypothetical additional properties ("if I bought property X for $Y in QLD"). */
  hypotheticalProperties: PortfolioProperty[];
}

export const runLandTaxScenarioTool: TaxAdvisorTool<RunLandTaxScenarioInput> = {
  name: 'runLandTaxScenario',
  kind: 'SCENARIO_RUN',
  description:
    'SCENARIO_RUN: re-invokes the cross-state land tax aggregator with hypothetical additional properties appended to the user\'s current portfolio. Returns BOTH baseline and scenario results + delta numerical fields. Use when the user asks "what if I bought a property in <state> for $<value>?". Does NOT recommend whether to buy.',
  inputSchema: {
    type: 'object',
    properties: {
      ownershipType: {
        type: 'string',
        description: 'Ownership type for the entire portfolio.',
        enum: [
          'INDIVIDUAL',
          'COMPANY',
          'DISCRETIONARY_TRUST',
          'UNIT_TRUST_FIXED',
          'UNIT_TRUST_NON_FIXED',
          'SMSF',
        ],
      },
      isForeignOwner: {
        type: 'boolean',
        description: 'Whether the owner is a foreign person.',
      },
      currentProperties: {
        type: 'array',
        description: 'Current portfolio properties.',
        items: { type: 'object' },
      },
      hypotheticalProperties: {
        type: 'array',
        description: 'Hypothetical additional properties.',
        items: { type: 'object' },
      },
    },
    required: [
      'ownershipType',
      'isForeignOwner',
      'currentProperties',
      'hypotheticalProperties',
    ],
  },
  execute: (input) => {
    const baselineInput: CrossStateLandTaxInput = {
      ownershipType: input.ownershipType,
      isForeignOwner: input.isForeignOwner,
      properties: input.currentProperties,
    };
    // Q-DEC PR 3.D — Decimal engine.
    const baseline = calculateCrossStateLandTaxDecimal(baselineInput);

    const scenarioInput: CrossStateLandTaxInput = {
      ...baselineInput,
      properties: [...input.currentProperties, ...input.hypotheticalProperties],
    };
    const scenario = calculateCrossStateLandTaxDecimal(scenarioInput);

    const citations: IdentifiedCitation[] = scenario.citations.map((c, i) => ({
      ...c,
      id: `cit-${i + 1}`,
    }));
    const allCitationIds = citations.map((c) => c.id);

    const numericFields: NumericField[] = [
      // Baseline
      {
        path: 'scenario.baseline.grandTotalTax',
        value: baseline.grandTotalTax.toNumber(),
        unit: 'AUD',
        label: 'Baseline total land tax across all states',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.baseline.statesAssessed',
        value: baseline.statesAssessed,
        unit: 'COUNT',
        label: 'Baseline states with at least one property',
        citationIds: [],
      },
      // Scenario inputs
      {
        path: 'scenario.input.hypotheticalPropertyCount',
        value: input.hypotheticalProperties.length,
        unit: 'COUNT',
        label: 'Hypothetical properties added',
        citationIds: [],
      },
      {
        path: 'scenario.input.hypotheticalTotalValue',
        value: input.hypotheticalProperties.reduce(
          (acc, p) => acc + p.taxableLandValue,
          0,
        ),
        unit: 'AUD',
        label: 'Sum of hypothetical taxable land values',
        citationIds: [],
      },
      // Scenario result
      {
        path: 'scenario.result.grandTotalTax',
        value: scenario.grandTotalTax.toNumber(),
        unit: 'AUD',
        label: 'Resulting total land tax (with hypothetical)',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.result.statesAssessed',
        value: scenario.statesAssessed,
        unit: 'COUNT',
        label: 'Resulting states assessed',
        citationIds: [],
      },
      {
        path: 'scenario.result.grandTotalGeneralTax',
        value: scenario.grandTotalGeneralTax.toNumber(),
        unit: 'AUD',
        label: 'Resulting general land tax component',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.result.grandTotalForeignSurcharge',
        value: scenario.grandTotalForeignSurcharge.toNumber(),
        unit: 'AUD',
        label: 'Resulting foreign / absentee owner surcharge component',
        citationIds: allCitationIds,
      },
      // Delta
      {
        path: 'scenario.delta.grandTotalTax',
        value: scenario.grandTotalTax.minus(baseline.grandTotalTax).toNumber(),
        unit: 'AUD',
        label: 'Change in total land tax (scenario − baseline)',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.delta.grandTotalForeignSurcharge',
        value: scenario.grandTotalForeignSurcharge.minus(baseline.grandTotalForeignSurcharge).toNumber(),
        unit: 'AUD',
        label:
          'Change in foreign-owner surcharge component (scenario − baseline)',
        citationIds: allCitationIds,
      },
    ];

    const narrativeText = [
      `Scenario: appending ${input.hypotheticalProperties.length} hypothetical property(ies) [cit:cit-1].`,
      `Baseline land tax: $${baseline.grandTotalTax.toNumber().toLocaleString()} across ${baseline.statesAssessed} state(s); resulting: $${scenario.grandTotalTax.toNumber().toLocaleString()} across ${scenario.statesAssessed} state(s).`,
      `Net change: $${scenario.grandTotalTax.minus(baseline.grandTotalTax).toNumber().toLocaleString()}.`,
    ].join(' ');

    const out: ToolResult = {
      toolName: 'runLandTaxScenario',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: scenario.uncomputed,
      narrativeText,
      raw: serializeDecimalsForJson({
        baseline,
        scenario,
        hypotheticalCount: input.hypotheticalProperties.length,
      }),
    };
    return out;
  },
};
