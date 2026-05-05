/**
 * Phase 41e.9 — Personal Services Income (PSI) classifier.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11 +
 * `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §5.5 #7.
 *
 * AU primary authority:
 *   - ITAA 1997 Part 2-42 — Personal Services Income
 *   - s84-5 — defines PSI as income mainly a reward for an
 *     individual's personal efforts or skills
 *   - s87-15 — Personal Services Business (PSB) determination
 *     prevents PSI rules from applying. PSB applies when ANY of:
 *       (a) Results test — paid for a result, supplies plant /
 *           equipment, liable for rectification (s87-18)
 *       (b) ≥ 75% of PSI is from one client → fails 80%-one-client
 *           test → must satisfy results test OR have a Personal
 *           Services Business Determination from the ATO
 *       (c) Unrelated clients test (s87-20) — services provided to
 *           ≥ 2 unrelated clients via direct advertising
 *       (d) Employment test (s87-25) — engages employees doing
 *           ≥ 20% of the principal work
 *       (e) Business premises test (s87-30) — uses premises
 *           exclusively for the personal-services business
 *   - TR 2022/3 — Commissioner's view on PSI / PSB rules (refreshed)
 *
 * **Operative effect of PSI:** if income IS PSI and the entity is
 * NOT a PSB, the PSI is attributed to the individual at marginal
 * rates regardless of the company/trust structure receiving it.
 * Deductions are also restricted (s86-60).
 *
 * Pure functions; no DB. Composed by `entityTaxRouter` for COMPANY
 * entities receiving PSI inputs (Pty Ltd doing personal services).
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

export interface PsiInput {
  /**
   * Total income for the FY received by the entity that may be PSI
   * (i.e. mainly a reward for personal efforts/skills of an individual).
   */
  totalPsiIncome: number;
  /**
   * Income from the LARGEST single client (or its associates).
   * Used for the 80%-one-client test.
   */
  incomeFromLargestClient: number;
  /**
   * Number of UNRELATED clients the entity provided services to.
   * For the "unrelated clients test" (s87-20). Two unrelated clients
   * gained via direct advertising satisfies this test.
   */
  unrelatedClientCount: number;
  /**
   * `true` if the entity gained the unrelated clients via direct
   * advertising / public offer (NOT via personal contacts /
   * recruitment agencies / labour-hire firms) — required for the
   * unrelated clients test to count.
   */
  gainedClientsViaDirectAdvertising?: boolean;
  /**
   * `true` if income is mainly paid for a RESULT, with the entity
   * supplying plant/equipment AND liable for rectifying defective
   * work at its own cost. All three required for the results test
   * (s87-18). v1 collapses to single boolean — caller asserts.
   */
  meetsResultsTest?: boolean;
  /**
   * `true` if the entity engages employees (or contractors who are
   * not associates of the test individual) doing ≥ 20% of the
   * principal work (s87-25).
   */
  meetsEmploymentTest?: boolean;
  /**
   * `true` if the entity uses business premises exclusively for the
   * personal-services business and physically separate from the test
   * individual's residence and any associate (s87-30).
   */
  meetsBusinessPremisesTest?: boolean;
  /**
   * `true` if the entity holds a Personal Services Business
   * Determination from the ATO (s87-60). When held, PSB is
   * automatic regardless of the other tests for the period covered.
   */
  hasPsbDetermination?: boolean;
}

export type PsiTestResult = 'PASS' | 'FAIL';

export interface PsiClassificationResult {
  /** Is the income PSI in the first place? */
  isPsi: boolean;
  /** Does the entity qualify as a Personal Services Business? */
  isPsb: boolean;
  /** Per-test breakdown — useful for AFSL footer + UI. */
  tests: {
    eightyPercentOneClient: PsiTestResult;
    resultsTest: PsiTestResult;
    unrelatedClientsTest: PsiTestResult;
    employmentTest: PsiTestResult;
    businessPremisesTest: PsiTestResult;
  };
  /**
   * If NOT a PSB: the dollar amount attributed to the individual at
   * marginal rates (s86-15). When IS a PSB: 0.
   */
  psiAttributedToIndividual: number;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1997', reference: 'Part 2-42 (PSI)', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 's84-5', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 's87-15 (PSB)', lastReviewed: '2026-05-05' },
  { kind: 'TR', reference: '2022/3', lastReviewed: '2026-05-05' },
];

/**
 * Classify an entity's income for PSI / PSB status.
 *
 * Decision flow:
 *   1. If `totalPsiIncome <= 0` → not PSI, not relevant.
 *   2. Treat as PSI for analysis (caller's responsibility to determine
 *      whether income IS personal-services income — v1 trusts the
 *      caller; the s84-5 character test isn't easily mechanised).
 *   3. Run the PSB tests:
 *      a. Results test — if pass, immediately PSB.
 *      b. 80%-one-client test:
 *         - If income from one client < 80% → can satisfy any of
 *           Unrelated/Employment/Premises tests for PSB.
 *         - If income from one client ≥ 80% → must satisfy Results
 *           test OR hold PSB Determination from ATO.
 *      c. PSB Determination → automatic PSB.
 *   4. If PSB → no attribution. Income stays at entity level.
 *   5. If NOT PSB → attribute net PSI income to individual at marginal
 *      rates (this module reports the gross amount; the deduction-
 *      restriction calc per s86-60 lands in a future sub-PR — flagged).
 */
export function classifyPsi(input: PsiInput): PsiClassificationResult {
  const {
    totalPsiIncome,
    incomeFromLargestClient,
    unrelatedClientCount,
    gainedClientsViaDirectAdvertising = false,
    meetsResultsTest = false,
    meetsEmploymentTest = false,
    meetsBusinessPremisesTest = false,
    hasPsbDetermination = false,
  } = input;

  const citations = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  // No PSI income → return early.
  if (totalPsiIncome <= 0) {
    return {
      isPsi: false,
      isPsb: false,
      tests: {
        eightyPercentOneClient: 'PASS',
        resultsTest: 'PASS',
        unrelatedClientsTest: 'PASS',
        employmentTest: 'PASS',
        businessPremisesTest: 'PASS',
      },
      psiAttributedToIndividual: 0,
      reason: 'No PSI income to classify.',
      citations,
      uncomputed,
    };
  }

  // Per-test outcomes.
  const oneClientPercentage =
    totalPsiIncome > 0
      ? incomeFromLargestClient / totalPsiIncome
      : 0;
  const eightyPercentOneClient: PsiTestResult =
    oneClientPercentage < 0.8 ? 'PASS' : 'FAIL';

  const resultsTestResult: PsiTestResult = meetsResultsTest ? 'PASS' : 'FAIL';
  const employmentTestResult: PsiTestResult = meetsEmploymentTest
    ? 'PASS'
    : 'FAIL';
  const businessPremisesTestResult: PsiTestResult = meetsBusinessPremisesTest
    ? 'PASS'
    : 'FAIL';

  // Unrelated clients test (s87-20): must have ≥ 2 unrelated clients
  // GAINED via direct advertising (or public offer).
  const unrelatedClientsTest: PsiTestResult =
    unrelatedClientCount >= 2 && gainedClientsViaDirectAdvertising
      ? 'PASS'
      : 'FAIL';

  // PSB determination short-circuits — automatic PSB.
  if (hasPsbDetermination) {
    citations.push({ kind: 'ITAA_1997', reference: 's87-60', lastReviewed: '2026-05-05' });
    return {
      isPsi: true,
      isPsb: true,
      tests: {
        eightyPercentOneClient,
        resultsTest: resultsTestResult,
        unrelatedClientsTest,
        employmentTest: employmentTestResult,
        businessPremisesTest: businessPremisesTestResult,
      },
      psiAttributedToIndividual: 0,
      reason:
        'Entity holds an ATO Personal Services Business Determination (s87-60) — automatic PSB; PSI rules do not apply for the period covered.',
      citations,
      uncomputed,
    };
  }

  // Results test → automatic PSB.
  if (resultsTestResult === 'PASS') {
    citations.push({ kind: 'ITAA_1997', reference: 's87-18 (results test)', lastReviewed: '2026-05-05' });
    return {
      isPsi: true,
      isPsb: true,
      tests: {
        eightyPercentOneClient,
        resultsTest: resultsTestResult,
        unrelatedClientsTest,
        employmentTest: employmentTestResult,
        businessPremisesTest: businessPremisesTestResult,
      },
      psiAttributedToIndividual: 0,
      reason:
        'Results test (s87-18) passed — paid for a result, supplies plant/equipment, liable for rectification. Automatic PSB; PSI rules do not apply.',
      citations,
      uncomputed,
    };
  }

  // 80%-one-client analysis.
  if (eightyPercentOneClient === 'FAIL') {
    // ≥ 80% from one client → must rely on results test (already FAIL
    // above) or PSB determination (already false). NOT a PSB.
    citations.push({ kind: 'ITAA_1997', reference: 's86-15', lastReviewed: '2026-05-05' });
    uncomputed.push({
      id: 'UC-PSI-DEDUCTION-RESTRICTIONS',
      rationale:
        'Net PSI attributed to individual at marginal rates per s86-15. Deductions are restricted per s86-60 (only those that would have been deductible if the individual earned the income directly — e.g. car expenses for travel between work sites, but not most home-office or salary-to-associate expenses). Caller computes net attributed amount; v1 reports gross.',
      citation: { kind: 'ITAA_1997', reference: 's86-60', lastReviewed: '2026-05-05' },
    });
    return {
      isPsi: true,
      isPsb: false,
      tests: {
        eightyPercentOneClient,
        resultsTest: resultsTestResult,
        unrelatedClientsTest,
        employmentTest: employmentTestResult,
        businessPremisesTest: businessPremisesTestResult,
      },
      psiAttributedToIndividual: totalPsiIncome,
      reason: `${(oneClientPercentage * 100).toFixed(0)}% of PSI is from one client (≥ 80% threshold). Without results test or PSB determination, PSI rules apply: $${Math.round(totalPsiIncome).toLocaleString()} attributed to the individual at marginal rates per s86-15.`,
      citations,
      uncomputed,
    };
  }

  // < 80% from one client — can satisfy any of unrelated / employment / premises.
  const anyAlternativeTestPasses =
    unrelatedClientsTest === 'PASS' ||
    employmentTestResult === 'PASS' ||
    businessPremisesTestResult === 'PASS';

  if (anyAlternativeTestPasses) {
    if (unrelatedClientsTest === 'PASS') {
      citations.push({ kind: 'ITAA_1997', reference: 's87-20 (unrelated clients)', lastReviewed: '2026-05-05' });
    }
    if (employmentTestResult === 'PASS') {
      citations.push({ kind: 'ITAA_1997', reference: 's87-25 (employment test)', lastReviewed: '2026-05-05' });
    }
    if (businessPremisesTestResult === 'PASS') {
      citations.push({ kind: 'ITAA_1997', reference: 's87-30 (premises test)', lastReviewed: '2026-05-05' });
    }
    return {
      isPsi: true,
      isPsb: true,
      tests: {
        eightyPercentOneClient,
        resultsTest: resultsTestResult,
        unrelatedClientsTest,
        employmentTest: employmentTestResult,
        businessPremisesTest: businessPremisesTestResult,
      },
      psiAttributedToIndividual: 0,
      reason: `< 80% from one client AND at least one alternative test (unrelated clients / employment / premises) passed. Qualifies as PSB; PSI rules do not apply.`,
      citations,
      uncomputed,
    };
  }

  // < 80% from one client BUT no alternative test passed → still NOT a PSB.
  citations.push({ kind: 'ITAA_1997', reference: 's86-15', lastReviewed: '2026-05-05' });
  uncomputed.push({
    id: 'UC-PSI-DEDUCTION-RESTRICTIONS',
    rationale:
      'Net PSI attributed to individual at marginal rates per s86-15. Deductions restricted per s86-60. Caller computes net attributed amount; v1 reports gross.',
    citation: { kind: 'ITAA_1997', reference: 's86-60', lastReviewed: '2026-05-05' },
  });
  return {
    isPsi: true,
    isPsb: false,
    tests: {
      eightyPercentOneClient,
      resultsTest: resultsTestResult,
      unrelatedClientsTest,
      employmentTest: employmentTestResult,
      businessPremisesTest: businessPremisesTestResult,
    },
    psiAttributedToIndividual: totalPsiIncome,
    reason: `Although < 80% from one client, no alternative test (unrelated / employment / premises) passed. PSI rules apply: $${Math.round(totalPsiIncome).toLocaleString()} attributed to the individual at marginal rates.`,
    citations,
    uncomputed,
  };
}
