/**
 * Phase 41e.15 — Trust loss rules per Sch 2F ITAA 1936.
 *
 * Trust losses are quarantined unless the trust passes the relevant
 * loss-utilisation tests. The applicable tests vary by trust type:
 *
 * | Trust type | Tests required (Sch 2F) |
 * |---|---|
 * | Family trust (FTE in force) | Income Injection Test (IIT) only |
 * | Fixed trust | 50% Stake Test + Same Business Test (if needed) + IIT |
 * | Non-fixed trust (non-FTE) | All four: 50% Stake / Pattern of Distributions / Control / IIT |
 * | Excepted trust (deceased estate, complying super) | None — losses flow freely |
 *
 * AU primary authority:
 *   - Sch 2F ITAA 1936 — the entire schedule governs trust losses
 *   - Div 266 (fixed trust loss tests)
 *   - Div 267 (non-fixed trust loss tests)
 *   - Div 268 (excepted trusts)
 *   - Div 270 (Income Injection Test — applies to all)
 *   - Div 272 (FTE definitions)
 *
 * v1 design: classify the trust by type + check whether each
 * applicable test is asserted to pass. Returns a structured outcome:
 *   - LOSSES_DEDUCTIBLE — all applicable tests passed
 *   - LOSSES_DENIED — at least one applicable test failed
 *   - INCONCLUSIVE — caller hasn't asserted the test outcome (UC flag)
 *
 * **Important caveat:** the tests themselves (especially Pattern of
 * Distributions and Same Business Test) are highly factual and turn
 * on years of historical data. v1 does NOT compute pass/fail from
 * historical facts — caller asserts via `testOutcomes`. UC flags
 * surface what the caller asserted vs. what's still inconclusive.
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

export type TrustTypeForLossRules =
  | 'FAMILY_TRUST_FTE' // FTE in force per s272-80
  | 'FIXED_TRUST' // Div 266
  | 'NON_FIXED_TRUST' // Div 267
  | 'EXCEPTED_TRUST'; // Div 268

export type TrustLossTestOutcome = 'PASS' | 'FAIL' | 'NOT_ASSERTED';

export interface TrustLossInput {
  trustType: TrustTypeForLossRules;
  /** Loss amount the trust is seeking to utilise. */
  lossAmount: number;
  /** Test outcomes asserted by the caller. */
  testOutcomes: {
    incomeInjectionTest?: TrustLossTestOutcome; // Div 270 — applies to all
    fiftyPercentStakeTest?: TrustLossTestOutcome; // Div 266/267
    patternOfDistributionsTest?: TrustLossTestOutcome; // Div 267
    controlTest?: TrustLossTestOutcome; // Div 267
    sameBusinessTest?: TrustLossTestOutcome; // Div 266
  };
}

export type TrustLossOutcome =
  | 'LOSSES_DEDUCTIBLE'
  | 'LOSSES_DENIED'
  | 'INCONCLUSIVE';

export interface TrustLossResult {
  outcome: TrustLossOutcome;
  /** Loss amount that may be deducted (lossAmount if DEDUCTIBLE, else 0). */
  deductibleLossAmount: number;
  /** Per-test status report for the AFSL footer. */
  testReport: Array<{
    testName: string;
    required: boolean;
    outcome: TrustLossTestOutcome;
    citation: string;
  }>;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Tests required per trust type, per Sch 2F ITAA 1936.
 */
function requiredTests(
  trustType: TrustTypeForLossRules,
): Array<keyof TrustLossInput['testOutcomes']> {
  switch (trustType) {
    case 'FAMILY_TRUST_FTE':
      // FTE-protected trusts only need IIT (s270).
      return ['incomeInjectionTest'];
    case 'FIXED_TRUST':
      // Div 266: 50% stake test + same business test (when relevant) + IIT.
      return ['fiftyPercentStakeTest', 'sameBusinessTest', 'incomeInjectionTest'];
    case 'NON_FIXED_TRUST':
      // Div 267: 50% stake + pattern of distributions + control + IIT.
      return [
        'fiftyPercentStakeTest',
        'patternOfDistributionsTest',
        'controlTest',
        'incomeInjectionTest',
      ];
    case 'EXCEPTED_TRUST':
      // Div 268: no tests required.
      return [];
  }
}

const TEST_CITATIONS: Record<keyof TrustLossInput['testOutcomes'], string> = {
  incomeInjectionTest: 'Sch 2F ITAA 1936 Div 270 (Income Injection Test)',
  fiftyPercentStakeTest: 'Sch 2F ITAA 1936 s269-50 (50% Stake Test)',
  patternOfDistributionsTest: 'Sch 2F ITAA 1936 s267-30 (Pattern of Distributions Test)',
  controlTest: 'Sch 2F ITAA 1936 s269-95 (Control Test)',
  sameBusinessTest: 'Sch 2F ITAA 1936 s269-100 (Same Business Test)',
};

const TEST_DISPLAY_NAMES: Record<keyof TrustLossInput['testOutcomes'], string> = {
  incomeInjectionTest: 'Income Injection Test',
  fiftyPercentStakeTest: '50% Stake Test',
  patternOfDistributionsTest: 'Pattern of Distributions Test',
  controlTest: 'Control Test',
  sameBusinessTest: 'Same Business Test',
};

/**
 * Apply Sch 2F trust loss tests. Returns LOSSES_DEDUCTIBLE only when
 * all applicable tests pass; LOSSES_DENIED if any applicable test
 * fails; INCONCLUSIVE if any applicable test is NOT_ASSERTED.
 */
export function applyTrustLossRules(input: TrustLossInput): TrustLossResult {
  const { trustType, lossAmount, testOutcomes } = input;
  const tests = requiredTests(trustType);

  const citations: AuthorityCitation[] = [
    { kind: 'ITAA_1936', reference: 'Sch 2F ITAA 1936', lastReviewed: '2026-05-05' },
  ];
  const uncomputed: UncomputedFlag[] = [];
  const testReport: TrustLossResult['testReport'] = [];

  let anyFail = false;
  let anyNotAsserted = false;

  for (const t of tests) {
    const outcome = testOutcomes[t] ?? 'NOT_ASSERTED';
    testReport.push({
      testName: TEST_DISPLAY_NAMES[t],
      required: true,
      outcome,
      citation: TEST_CITATIONS[t],
    });
    citations.push({
      kind: 'ITAA_1936',
      reference: TEST_CITATIONS[t],
      lastReviewed: '2026-05-05',
    });
    if (outcome === 'FAIL') anyFail = true;
    if (outcome === 'NOT_ASSERTED') anyNotAsserted = true;
  }

  if (trustType === 'EXCEPTED_TRUST') {
    citations.push({
      kind: 'ITAA_1936',
      reference: 'Sch 2F ITAA 1936 Div 268 (Excepted Trusts)',
      lastReviewed: '2026-05-05',
    });
  }

  let outcome: TrustLossOutcome;
  let deductibleLossAmount: number;

  if (anyFail) {
    outcome = 'LOSSES_DENIED';
    deductibleLossAmount = 0;
    uncomputed.push({
      id: 'UC-TRUST-LOSS-DENIED',
      rationale: `One or more required Sch 2F tests failed for ${trustType}. Loss of $${lossAmount.toLocaleString()} is quarantined and may NOT be deducted in the current year. Engage a registered tax agent for carry-forward / utilisation in future years.`,
    });
  } else if (anyNotAsserted) {
    outcome = 'INCONCLUSIVE';
    deductibleLossAmount = 0;
    uncomputed.push({
      id: 'UC-TRUST-LOSS-INCONCLUSIVE',
      rationale: `One or more required Sch 2F tests for ${trustType} are NOT_ASSERTED. v1 does not compute pass/fail from historical facts — Pattern of Distributions, Control, and Same Business tests turn on multi-year evidence the caller must supply. Engage a registered tax agent.`,
    });
  } else {
    outcome = 'LOSSES_DEDUCTIBLE';
    deductibleLossAmount = lossAmount;
  }

  return {
    outcome,
    deductibleLossAmount,
    testReport,
    citations,
    uncomputed,
  };
}

// =============================================================================
// Q-DEC PR 2.D.3c — Decimal sibling path
// =============================================================================

export interface TrustLossInputDecimal {
  trustType: TrustTypeForLossRules;
  lossAmount: number | string | Decimal;
  testOutcomes: TrustLossInput['testOutcomes'];
}

export interface TrustLossResultDecimal {
  outcome: TrustLossOutcome;
  deductibleLossAmount: Decimal;
  testReport: TrustLossResult['testReport'];
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `applyTrustLossRules`. Same Sch 2F test-outcome
 * dispatch; Decimal preserves precision on the loss amount.
 */
export function applyTrustLossRulesDecimal(input: TrustLossInputDecimal): TrustLossResultDecimal {
  const { trustType, testOutcomes } = input;
  const lossAmount = toDecimal(input.lossAmount) ?? new Decimal(0);
  const tests = requiredTests(trustType);

  const citations: AuthorityCitation[] = [
    { kind: 'ITAA_1936', reference: 'Sch 2F ITAA 1936', lastReviewed: '2026-05-05' },
  ];
  const uncomputed: UncomputedFlag[] = [];
  const testReport: TrustLossResult['testReport'] = [];

  let anyFail = false;
  let anyNotAsserted = false;

  for (const t of tests) {
    const outcome = testOutcomes[t] ?? 'NOT_ASSERTED';
    testReport.push({
      testName: TEST_DISPLAY_NAMES[t],
      required: true,
      outcome,
      citation: TEST_CITATIONS[t],
    });
    citations.push({
      kind: 'ITAA_1936',
      reference: TEST_CITATIONS[t],
      lastReviewed: '2026-05-05',
    });
    if (outcome === 'FAIL') anyFail = true;
    if (outcome === 'NOT_ASSERTED') anyNotAsserted = true;
  }

  if (trustType === 'EXCEPTED_TRUST') {
    citations.push({
      kind: 'ITAA_1936',
      reference: 'Sch 2F ITAA 1936 Div 268 (Excepted Trusts)',
      lastReviewed: '2026-05-05',
    });
  }

  let outcome: TrustLossOutcome;
  let deductibleLossAmount: Decimal;

  if (anyFail) {
    outcome = 'LOSSES_DENIED';
    deductibleLossAmount = new Decimal(0);
    uncomputed.push({
      id: 'UC-TRUST-LOSS-DENIED',
      rationale: `One or more required Sch 2F tests failed for ${trustType}. Loss of $${lossAmount.toDecimalPlaces(0).toString()} is quarantined and may NOT be deducted in the current year. Engage a registered tax agent for carry-forward / utilisation in future years.`,
    });
  } else if (anyNotAsserted) {
    outcome = 'INCONCLUSIVE';
    deductibleLossAmount = new Decimal(0);
    uncomputed.push({
      id: 'UC-TRUST-LOSS-INCONCLUSIVE',
      rationale: `One or more required Sch 2F tests for ${trustType} are NOT_ASSERTED. v1 does not compute pass/fail from historical facts — Pattern of Distributions, Control, and Same Business tests turn on multi-year evidence the caller must supply. Engage a registered tax agent.`,
    });
  } else {
    outcome = 'LOSSES_DEDUCTIBLE';
    deductibleLossAmount = lossAmount;
  }

  return { outcome, deductibleLossAmount, testReport, citations, uncomputed };
}
