/**
 * Phase 41h.6 — Tool: runCgtScenario (SCENARIO_RUN)
 *
 * "What if I sold property X this FY?" — re-invokes
 * `applyCapitalLossNetting` with hypothetical additional CGT
 * events appended to the user's current event list. Returns
 * BOTH baseline (current events) and scenario (current + hypothetical)
 * results, plus delta numerical fields the AI narrates without
 * computing them.
 *
 * Authority: ITAA 1997 Div 102-A (assessable net CG), s100-50
 * (loss-netting order), s115-100 (50% / 33⅓% discount).
 *
 * **HR-1/HR-2 preserved**: every number (baseline / scenario /
 * delta) is computed by the calc engine; the AI just narrates
 * what the tool returned.
 *
 * **D-2 preserved**: returning a scenario number is a fact
 * ("if you sold property X your assessable net CG would be $Y"),
 * not a recommendation ("you should sell property X" remains
 * forbidden).
 */

import {
  applyCapitalLossNetting,
  type CapitalLossNettingInput,
  type CgtEvent,
  type CarryForwardLoss,
} from '@/lib/tax-engine/divisions/capitalLossNetting';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

interface RunCgtScenarioInput {
  entityType: CapitalLossNettingInput['entityType'];
  /** Current FY events (the user's actual disposals to date). */
  currentEvents: CgtEvent[];
  /** Carry-forward losses from prior FYs. */
  carryForwardLosses?: CarryForwardLoss[];
  isComplying?: boolean;
  isForeignResident?: boolean;
  /** Hypothetical additional events ("if I sold property X for $Y this FY"). */
  hypotheticalEvents: CgtEvent[];
}

export const runCgtScenarioTool: TaxAdvisorTool<RunCgtScenarioInput> = {
  name: 'runCgtScenario',
  kind: 'SCENARIO_RUN',
  description:
    'SCENARIO_RUN: re-invokes the capital-loss-netting engine with hypothetical additional CGT events appended to the user\'s current FY events. Returns BOTH baseline and scenario results + delta numerical fields. Use when the user asks "what if I sold property X this FY?". Does NOT recommend whether to sell.',
  inputSchema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        description: 'Eligible CGT entity type.',
        enum: [
          'PERSONAL_NAME',
          'SOLE_TRADER',
          'PARTNERSHIP',
          'COMPANY',
          'DISCRETIONARY_TRUST',
          'UNIT_TRUST',
          'SMSF',
        ],
      },
      currentEvents: {
        type: 'array',
        description: 'Current FY CGT events (already-realised disposals).',
        items: { type: 'object' },
      },
      hypotheticalEvents: {
        type: 'array',
        description: 'Hypothetical events to add (e.g. selling property X for $Y).',
        items: { type: 'object' },
      },
      isComplying: {
        type: 'boolean',
        description: 'For SMSF: whether the fund is complying.',
      },
      isForeignResident: {
        type: 'boolean',
        description: 'For individuals: foreign-resident status.',
      },
    },
    required: ['entityType', 'currentEvents', 'hypotheticalEvents'],
  },
  execute: (input) => {
    const baselineInput: CapitalLossNettingInput = {
      entityType: input.entityType,
      events: input.currentEvents,
      carryForwardLosses: input.carryForwardLosses,
      isComplying: input.isComplying,
      isForeignResident: input.isForeignResident,
    };
    const baseline = applyCapitalLossNetting(baselineInput);

    const scenarioInput: CapitalLossNettingInput = {
      ...baselineInput,
      events: [...input.currentEvents, ...input.hypotheticalEvents],
    };
    const scenario = applyCapitalLossNetting(scenarioInput);

    // Pull citations from baseline (both runs share the same authority).
    const citations: IdentifiedCitation[] = baseline.citations.map((c, i) => ({
      ...c,
      id: `cit-${i + 1}`,
    }));
    const allCitationIds = citations.map((c) => c.id);

    const sumHypotheticalGain = input.hypotheticalEvents.reduce(
      (acc, e) => acc + Math.max(0, e.nominalAmount),
      0,
    );
    const sumHypotheticalLoss = input.hypotheticalEvents.reduce(
      (acc, e) => acc + Math.abs(Math.min(0, e.nominalAmount)),
      0,
    );

    const numericFields: NumericField[] = [
      {
        path: 'scenario.baseline.assessableNetCapitalGain',
        value: baseline.assessableNetCapitalGain,
        unit: 'AUD',
        label: 'Baseline assessable net capital gain (no hypothetical)',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.baseline.netGainBeforeDiscount',
        value: baseline.netGainBeforeDiscount,
        unit: 'AUD',
        label: 'Baseline net gain after losses, before discount',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.input.hypotheticalGains',
        value: sumHypotheticalGain,
        unit: 'AUD',
        label: 'Sum of hypothetical positive nominal amounts',
        citationIds: [],
      },
      {
        path: 'scenario.input.hypotheticalLosses',
        value: sumHypotheticalLoss,
        unit: 'AUD',
        label: 'Sum of hypothetical negative nominal amounts',
        citationIds: [],
      },
      {
        path: 'scenario.input.hypotheticalEventCount',
        value: input.hypotheticalEvents.length,
        unit: 'COUNT',
        label: 'Number of hypothetical events being modelled',
        citationIds: [],
      },
      {
        path: 'scenario.result.assessableNetCapitalGain',
        value: scenario.assessableNetCapitalGain,
        unit: 'AUD',
        label: 'Resulting assessable net capital gain (with hypothetical)',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.result.netGainBeforeDiscount',
        value: scenario.netGainBeforeDiscount,
        unit: 'AUD',
        label: 'Resulting net gain after losses, before discount',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.delta.assessableNetCapitalGain',
        value:
          scenario.assessableNetCapitalGain -
          baseline.assessableNetCapitalGain,
        unit: 'AUD',
        label:
          'Change in assessable net capital gain (scenario − baseline)',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.delta.netGainBeforeDiscount',
        value:
          scenario.netGainBeforeDiscount - baseline.netGainBeforeDiscount,
        unit: 'AUD',
        label:
          'Change in pre-discount net gain (scenario − baseline)',
        citationIds: allCitationIds,
      },
    ];

    const narrativeText = [
      `Scenario: appending ${input.hypotheticalEvents.length} hypothetical CGT event(s) — $${sumHypotheticalGain.toLocaleString()} hypothetical gains, $${sumHypotheticalLoss.toLocaleString()} hypothetical losses [cit:cit-1].`,
      `Baseline assessable net CG: $${baseline.assessableNetCapitalGain.toLocaleString()}; resulting: $${scenario.assessableNetCapitalGain.toLocaleString()}.`,
      `Pre-discount net gain shifts from $${baseline.netGainBeforeDiscount.toLocaleString()} to $${scenario.netGainBeforeDiscount.toLocaleString()}.`,
    ].join(' ');

    const out: ToolResult = {
      toolName: 'runCgtScenario',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: [
        ...(baseline.uncomputed ?? []),
        ...(scenario.uncomputed ?? []),
      ],
      narrativeText,
      raw: {
        baseline,
        scenario,
        hypotheticalEventCount: input.hypotheticalEvents.length,
      },
    };
    return out;
  },
};
