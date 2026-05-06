/**
 * Phase 41h.6 — Tool: runDiv7aRefinanceScenario (SCENARIO_RUN)
 *
 * "What if I refinanced this Div 7A loan to safe-harbour terms?"
 * — re-invokes `classifyDiv7ALoans` with the loan modified to
 * compliant agreement terms (`hasComplianceAgreement: true` +
 * standard 7-year term + benchmark rate). Returns BOTH baseline
 * (current state) and scenario (refinanced state) classifications,
 * plus delta numerical fields.
 *
 * Authority: ITAA 1936 Div 7A (s109B-s109ZE), s109N (minimum
 * yearly repayment safe harbour).
 *
 * **HR-1/HR-2 preserved**: every number computed by the calc
 * engine.
 *
 * **D-2 preserved**: returning a scenario number is a fact
 * ("if loan L1 had a compliant agreement, deemed dividend
 * exposure would drop from $X to $Y"), not a recommendation.
 */

import {
  classifyDiv7ALoans,
  type Div7ALoanInput,
} from '@/lib/tax-engine/divisions/div7aLoanClassifier';
import type {
  TaxAdvisorTool,
  ToolResult,
  NumericField,
  IdentifiedCitation,
} from '../types';

interface RunDiv7aRefinanceScenarioInput {
  /** Current loans (as they stand today). */
  currentLoans: Div7ALoanInput[];
  /**
   * Loan ids to "refinance" — flip `hasComplianceAgreement` to
   * true on each, leaving every other field untouched. The
   * scenario thus models: what if the loans the user identifies
   * suddenly had Div 7A-compliant written agreements, no other
   * changes.
   */
  loanIdsToRefinance: string[];
  /**
   * Optionally override the term + benchmark rate on the
   * refinanced loans. Useful when the user wants to model a
   * specific term ("what if I refinanced to 7-year safe harbour
   * at the FY24-25 benchmark of 8.37%?"). Defaults preserve the
   * loan's existing values (the scenario isolates just the
   * agreement flag).
   */
  overrideYearsRemaining?: number;
  overrideBenchmarkRate?: number;
}

export const runDiv7aRefinanceScenarioTool: TaxAdvisorTool<RunDiv7aRefinanceScenarioInput> = {
  name: 'runDiv7aRefinanceScenario',
  kind: 'SCENARIO_RUN',
  description:
    'SCENARIO_RUN: re-invokes the Div 7A classifier with selected loans flipped to having a compliant Div 7A agreement (and optionally a specific term + benchmark rate). Returns BOTH baseline and scenario classifications + delta numerical fields. Use when the user asks "what if I refinanced loan L1 to safe-harbour terms?". Does NOT recommend whether to refinance.',
  inputSchema: {
    type: 'object',
    properties: {
      currentLoans: {
        type: 'array',
        description: 'Current Div 7A loans (as they stand today).',
        items: { type: 'object' },
      },
      loanIdsToRefinance: {
        type: 'array',
        description: 'Loan ids to model as refinanced to compliant terms.',
        items: { type: 'string' },
      },
      overrideYearsRemaining: {
        type: 'number',
        description:
          'Optional term override for the scenario (e.g. 7 for unsecured s109N safe harbour).',
      },
      overrideBenchmarkRate: {
        type: 'number',
        description:
          'Optional benchmark rate override (decimal, e.g. 0.0837 for 8.37%).',
      },
    },
    required: ['currentLoans', 'loanIdsToRefinance'],
  },
  execute: (input) => {
    const baseline = classifyDiv7ALoans(input.currentLoans);

    const refinancedSet = new Set(input.loanIdsToRefinance);
    const scenarioLoans: Div7ALoanInput[] = input.currentLoans.map((loan) => {
      if (!refinancedSet.has(loan.loanId)) return loan;
      return {
        ...loan,
        hasComplianceAgreement: true,
        yearsRemaining: input.overrideYearsRemaining ?? loan.yearsRemaining,
        benchmarkRate: input.overrideBenchmarkRate ?? loan.benchmarkRate,
      };
    });
    const scenario = classifyDiv7ALoans(scenarioLoans);

    const citations: IdentifiedCitation[] = scenario.citations.map((c, i) => ({
      ...c,
      id: `cit-${i + 1}`,
    }));
    const allCitationIds = citations.map((c) => c.id);

    const baselineCompliantCount = baseline.classifications.filter(
      (c) => c.status === 'COMPLIANT',
    ).length;
    const scenarioCompliantCount = scenario.classifications.filter(
      (c) => c.status === 'COMPLIANT',
    ).length;

    const numericFields: NumericField[] = [
      // Baseline
      {
        path: 'scenario.baseline.totalDeemedDividend',
        value: baseline.totalDeemedDividend,
        unit: 'AUD',
        label: 'Baseline aggregate deemed-dividend exposure',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.baseline.compliantLoanCount',
        value: baselineCompliantCount,
        unit: 'COUNT',
        label: 'Baseline COMPLIANT loan count',
        citationIds: [],
      },
      {
        path: 'scenario.baseline.atRiskLoanCount',
        value: baseline.classifications.length - baselineCompliantCount,
        unit: 'COUNT',
        label: 'Baseline non-COMPLIANT loan count',
        citationIds: [],
      },
      // Scenario inputs
      {
        path: 'scenario.input.refinancedLoanCount',
        value: input.loanIdsToRefinance.length,
        unit: 'COUNT',
        label: 'Loans being modelled as refinanced to compliant terms',
        citationIds: [],
      },
      // Scenario result
      {
        path: 'scenario.result.totalDeemedDividend',
        value: scenario.totalDeemedDividend,
        unit: 'AUD',
        label: 'Resulting aggregate deemed-dividend exposure (with hypothetical refinance)',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.result.compliantLoanCount',
        value: scenarioCompliantCount,
        unit: 'COUNT',
        label: 'Resulting COMPLIANT loan count',
        citationIds: [],
      },
      // Delta
      {
        path: 'scenario.delta.totalDeemedDividend',
        value:
          scenario.totalDeemedDividend - baseline.totalDeemedDividend,
        unit: 'AUD',
        label: 'Change in aggregate deemed-dividend exposure (scenario − baseline)',
        citationIds: allCitationIds,
      },
      {
        path: 'scenario.delta.compliantLoanCount',
        value: scenarioCompliantCount - baselineCompliantCount,
        unit: 'COUNT',
        label: 'Change in COMPLIANT loan count',
        citationIds: [],
      },
    ];

    const narrativeText = [
      `Scenario: modelling ${input.loanIdsToRefinance.length} loan(s) flipped to compliant Div 7A agreement [cit:cit-1].`,
      `Baseline aggregate deemed-dividend exposure: $${baseline.totalDeemedDividend.toLocaleString()}; resulting: $${scenario.totalDeemedDividend.toLocaleString()}.`,
      `COMPLIANT loan count shifts from ${baselineCompliantCount} to ${scenarioCompliantCount}.`,
    ].join(' ');

    const out: ToolResult = {
      toolName: 'runDiv7aRefinanceScenario',
      computedAt: new Date().toISOString(),
      numericFields,
      citations,
      uncomputed: scenario.uncomputed ?? [],
      narrativeText,
      raw: {
        baseline,
        scenario,
        refinancedCount: input.loanIdsToRefinance.length,
      },
    };
    return out;
  },
};
