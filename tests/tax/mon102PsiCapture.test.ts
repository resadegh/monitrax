/**
 * MON-102 (capture Stage 2) — PSI self-assessment facts are CAPTURED and
 * flow through the ONE producer into the live overlay, with the two safe
 * defaults Reza approved (GO 2026-07-27):
 *
 *   1. NUMERICS ALL-OR-NOTHING: `buildPsiInput` returns null (overlay
 *      inert) unless all three numerics (totalPsiIncome,
 *      incomeFromLargestClient, unrelatedClientCount) are explicitly set.
 *      A partial questionnaire can never produce a partial number.
 *   2. UNANSWERED TESTS = NOT-ESTABLISHED: a null test boolean maps to an
 *      ABSENT key (undefined), which the classifier defaults to `false` —
 *      the engine's own contract and the ATO posture (a PSB test must be
 *      positively demonstrable). Asymmetric-safe: an unanswered test can
 *      only move the result toward MORE attribution, never hide one. A
 *      non-null answer (true OR false) passes through verbatim.
 *
 * §19.2 worked example (locked end-to-end): $150,000 PSI, $135,000 (90%)
 * from the largest client, 1 unrelated client, no tests established →
 * 80%-one-client test FAILS (0.9 ≥ 0.8), no results test / determination
 * → NOT a PSB → **$150,000 attributed to the individual** per s86-15,
 * with the s86-60 deduction-restriction flag surfaced.
 *
 * Coverage (precise): verifies the pure gate + mapping and the
 * orchestrator flow from a built input. Does NOT verify the Prisma read
 * path (assemblePsiInput's DB query — Ring-3 on a seeded PSI entity owns
 * that) and does NOT verify the questionnaire card UX (Reza's eyeball +
 * Ring-3).
 */
import { describe, it, expect } from 'vitest';
import { buildPsiInput } from '../../lib/services/entityTaxFactsAssembler';
import {
  buildMasterTaxPosition,
  buildMasterTaxPositionDecimal,
  type MasterTaxPositionInput,
} from '../../lib/tax-engine/orchestrator/masterTaxPosition';

const FY = { financialYear: '2025-26' } as MasterTaxPositionInput['fy'];

const assessment = (
  over: Partial<Parameters<typeof buildPsiInput>[0]> = {},
): Parameters<typeof buildPsiInput>[0] => ({
  totalPsiIncome: 150_000,
  incomeFromLargestClient: 135_000, // 90% — fails the 80%-one-client test
  unrelatedClientCount: 1,
  gainedClientsViaDirectAdvertising: null,
  meetsResultsTest: null,
  meetsEmploymentTest: null,
  meetsBusinessPremisesTest: null,
  hasPsbDetermination: null,
  ...over,
});

describe('MON-102 · the numerics all-or-nothing gate (buildPsiInput)', () => {
  it('totalPsiIncome null → null (overlay inert)', () => {
    expect(buildPsiInput(assessment({ totalPsiIncome: null }))).toBeNull();
  });

  it('incomeFromLargestClient null → null — the 80% test can never run on a guessed denominator share', () => {
    expect(buildPsiInput(assessment({ incomeFromLargestClient: null }))).toBeNull();
  });

  it('unrelatedClientCount null → null', () => {
    expect(buildPsiInput(assessment({ unrelatedClientCount: null }))).toBeNull();
  });

  it('complete numerics + all tests unanswered → input built with NO test keys (null → absent = not-established, never false-by-write)', () => {
    const input = buildPsiInput(assessment());
    expect(input).not.toBeNull();
    expect(input!.totalPsiIncome).toBe(150_000);
    expect(input!.incomeFromLargestClient).toBe(135_000);
    expect(input!.unrelatedClientCount).toBe(1);
    // The doctrine: unanswered persists as ABSENT, so the engine's own
    // `= false` default (its published contract) is what applies — the
    // assembler never writes a false the user didn't state.
    for (const key of [
      'gainedClientsViaDirectAdvertising',
      'meetsResultsTest',
      'meetsEmploymentTest',
      'meetsBusinessPremisesTest',
      'hasPsbDetermination',
    ]) {
      expect(key in input!).toBe(false);
    }
  });

  it('answered tests pass through verbatim — true AND false both (false is an answer, not an absence)', () => {
    const input = buildPsiInput(
      assessment({ meetsResultsTest: false, hasPsbDetermination: true, meetsEmploymentTest: true }),
    );
    expect(input).toMatchObject({
      meetsResultsTest: false,
      hasPsbDetermination: true,
      meetsEmploymentTest: true,
    });
    expect('meetsBusinessPremisesTest' in input!).toBe(false);
  });
});

describe('MON-102 · captured facts fire the live overlay end-to-end (§19.2 worked example)', () => {
  it('$150k / 90% one-client / no tests → $150,000 attributed per s86-15, s86-60 flagged (both twins)', () => {
    const psiInput = buildPsiInput(assessment())!;
    for (const build of [buildMasterTaxPosition, buildMasterTaxPositionDecimal]) {
      const r = build({ userId: 'u1', fy: FY, entities: [], psiByEntity: { 'ent-co': psiInput } });
      const psi = r.crossCutting?.psiByEntity?.['ent-co'];
      expect(psi?.isPsi).toBe(true);
      expect(psi?.isPsb).toBe(false);
      expect(psi?.psiAttributedToIndividual).toBe(150_000);
      expect(psi?.tests.eightyPercentOneClient).toBe('FAIL'); // 135,000 / 150,000 = 0.9 ≥ 0.8
      expect(r.modulesInvoked).toContain('psiClassifier');
      expect(r.authoritySources.some((c) => c.reference === 's86-15')).toBe(true);
      expect(r.uncomputed.some((u) => u.id === 'UC-PSI-DEDUCTION-RESTRICTIONS')).toBe(true);
    }
  });

  it('the same facts + an ATO determination answered YES → PSB, $0 attributed, s87-60 cited (a captured true flows)', () => {
    const psiInput = buildPsiInput(assessment({ hasPsbDetermination: true }))!;
    const r = buildMasterTaxPositionDecimal({
      userId: 'u1',
      fy: FY,
      entities: [],
      psiByEntity: { 'ent-co': psiInput },
    });
    const psi = r.crossCutting?.psiByEntity?.['ent-co'];
    expect(psi?.isPsb).toBe(true);
    expect(psi?.psiAttributedToIndividual).toBe(0);
    expect(r.authoritySources.some((c) => c.reference === 's87-60')).toBe(true);
  });

  it('gate CLOSED (a numeric missing) → no overlay input → byte-identical position', () => {
    expect(buildPsiInput(assessment({ totalPsiIncome: null }))).toBeNull();
    const withOut = buildMasterTaxPositionDecimal({ userId: 'u1', fy: FY, entities: [] });
    expect(withOut.crossCutting?.psiByEntity).toBeUndefined();
    expect(withOut.modulesInvoked).not.toContain('psiClassifier');
  });
});
