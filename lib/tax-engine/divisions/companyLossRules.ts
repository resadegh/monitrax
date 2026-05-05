/**
 * Phase 41e.15 — Company loss rules per Div 165 ITAA 1997.
 *
 * Companies must satisfy ONE of two tests to deduct prior-year tax
 * losses against current-year income:
 *
 *   1. **Continuity of Ownership Test (COT)** — s165-12. More than
 *      50% of voting power, dividend rights, and capital rights are
 *      maintained over the same individuals throughout the
 *      ownership-test period.
 *   2. **Business Continuity Test (BCT)** — s165-211. If COT fails,
 *      the company can still deduct losses if it satisfies either:
 *      - **Same Business Test (SBT)** — s165-210; same business as
 *        immediately before the test time, AND no new transaction
 *        or business of a kind not entered into before the test
 *        time.
 *      - **Similar Business Test** — s165-211(2); from 2019 — broader
 *        than SBT, considers similarity factors (assets used, identity
 *        of business, business activities).
 *
 * AU primary authority:
 *   - Div 165 ITAA 1997 (entire division)
 *   - s165-10 (when prior losses can be deducted)
 *   - s165-12 (COT)
 *   - s165-13 (alternative — SBT)
 *   - s165-210 (Same Business Test)
 *   - s165-211 (Similar Business Test — added 2019)
 *
 * v1 design: caller asserts COT outcome + (if COT fails) SBT/SIMILAR
 * outcome. v1 does NOT compute COT from share register history or
 * SBT from business activity records — these are factual matters
 * requiring multi-year evidence.
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

export type CompanyLossTestOutcome = 'PASS' | 'FAIL' | 'NOT_ASSERTED';

export interface CompanyLossInput {
  /** Prior-year losses the company is seeking to deduct. */
  priorYearLossAmount: number;
  /** Continuity of Ownership Test (s165-12) outcome. */
  cotOutcome: CompanyLossTestOutcome;
  /**
   * Business continuity test outcome, only relevant if COT fails.
   * Either SBT (s165-210) or Similar Business Test (s165-211).
   */
  bctOutcome?: CompanyLossTestOutcome;
  /**
   * Which BCT was applied — `'SBT'` (s165-210) or `'SIMILAR'`
   * (s165-211). Affects citation surfaced in result.
   */
  bctTestType?: 'SBT' | 'SIMILAR';
}

export type CompanyLossOutcome =
  | 'LOSSES_DEDUCTIBLE_VIA_COT'
  | 'LOSSES_DEDUCTIBLE_VIA_BCT'
  | 'LOSSES_DENIED'
  | 'INCONCLUSIVE';

export interface CompanyLossResult {
  outcome: CompanyLossOutcome;
  /** Loss amount that may be deducted (priorYearLossAmount if DEDUCTIBLE, else 0). */
  deductibleLossAmount: number;
  testReport: Array<{
    testName: string;
    outcome: CompanyLossTestOutcome;
    citation: string;
  }>;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Apply Div 165 company loss rules. Hierarchy:
 *   1. If COT passes → LOSSES_DEDUCTIBLE_VIA_COT.
 *   2. If COT fails AND BCT (SBT or Similar) passes → LOSSES_DEDUCTIBLE_VIA_BCT.
 *   3. If COT fails AND BCT also fails → LOSSES_DENIED.
 *   4. Anything NOT_ASSERTED → INCONCLUSIVE + UC flag.
 */
export function applyCompanyLossRules(
  input: CompanyLossInput,
): CompanyLossResult {
  const { priorYearLossAmount, cotOutcome, bctOutcome, bctTestType } = input;

  const citations: AuthorityCitation[] = [
    { kind: 'ITAA_1997', reference: 'Div 165 ITAA 1997', lastReviewed: '2026-05-05' },
    { kind: 'ITAA_1997', reference: 's165-10 (deduction of prior losses)', lastReviewed: '2026-05-05' },
    { kind: 'ITAA_1997', reference: 's165-12 (Continuity of Ownership Test)', lastReviewed: '2026-05-05' },
  ];
  const uncomputed: UncomputedFlag[] = [];
  const testReport: CompanyLossResult['testReport'] = [
    {
      testName: 'Continuity of Ownership Test',
      outcome: cotOutcome,
      citation: 's165-12 ITAA 1997',
    },
  ];

  let outcome: CompanyLossOutcome;
  let deductibleLossAmount = 0;

  if (cotOutcome === 'PASS') {
    outcome = 'LOSSES_DEDUCTIBLE_VIA_COT';
    deductibleLossAmount = priorYearLossAmount;
  } else if (cotOutcome === 'NOT_ASSERTED') {
    outcome = 'INCONCLUSIVE';
    uncomputed.push({
      id: 'UC-COMPANY-LOSS-COT-NOT-ASSERTED',
      rationale:
        'Continuity of Ownership Test (s165-12) outcome NOT_ASSERTED. v1 does not compute COT from share register history — caller must assert based on >50% maintained voting / dividend / capital rights throughout the test period. Engage a registered tax agent.',
    });
  } else {
    // COT FAILED — check BCT.
    if (bctOutcome === 'PASS') {
      const bctCitation =
        bctTestType === 'SIMILAR'
          ? 's165-211 ITAA 1997'
          : 's165-210 ITAA 1997';
      const bctName =
        bctTestType === 'SIMILAR'
          ? 'Similar Business Test'
          : 'Same Business Test';
      testReport.push({
        testName: bctName,
        outcome: 'PASS',
        citation: bctCitation,
      });
      citations.push({
        kind: 'ITAA_1997',
        reference: bctCitation,
        lastReviewed: '2026-05-05',
      });
      outcome = 'LOSSES_DEDUCTIBLE_VIA_BCT';
      deductibleLossAmount = priorYearLossAmount;
      uncomputed.push({
        id: 'UC-COMPANY-LOSS-BCT-FACTUAL',
        rationale: `${bctName} outcome asserted PASS. v1 does not verify SBT/Similar Business Test from business activity records — these tests turn on factual evidence (assets used, business identity, transactions entered before/after test time). Outcome is caller-asserted.`,
      });
    } else if (bctOutcome === 'FAIL' || bctOutcome === undefined) {
      testReport.push({
        testName: bctTestType === 'SIMILAR' ? 'Similar Business Test' : 'Same Business Test',
        outcome: bctOutcome ?? 'NOT_ASSERTED',
        citation: bctTestType === 'SIMILAR' ? 's165-211 ITAA 1997' : 's165-210 ITAA 1997',
      });
      outcome = 'LOSSES_DENIED';
      uncomputed.push({
        id: 'UC-COMPANY-LOSS-DENIED',
        rationale: `Continuity of Ownership Test failed AND no Business Continuity Test asserted/passed. Prior-year losses of $${priorYearLossAmount.toLocaleString()} are quarantined under Div 165. Engage a registered tax agent — losses may still be utilised in future years if the company's circumstances change.`,
      });
    } else {
      // bctOutcome === 'NOT_ASSERTED'
      testReport.push({
        testName: bctTestType === 'SIMILAR' ? 'Similar Business Test' : 'Same Business Test',
        outcome: 'NOT_ASSERTED',
        citation: bctTestType === 'SIMILAR' ? 's165-211 ITAA 1997' : 's165-210 ITAA 1997',
      });
      outcome = 'INCONCLUSIVE';
      uncomputed.push({
        id: 'UC-COMPANY-LOSS-BCT-NOT-ASSERTED',
        rationale:
          'Continuity of Ownership Test failed but BCT (s165-210 SBT or s165-211 Similar Business) outcome NOT_ASSERTED. v1 cannot conclude whether prior losses are deductible. Engage a registered tax agent.',
      });
    }
  }

  return {
    outcome,
    deductibleLossAmount,
    testReport,
    citations,
    uncomputed,
  };
}
