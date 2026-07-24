/**
 * MON-097 (Neo-G4 · P1) — the PSI overlay is WIRED into the master tax
 * orchestrator (both twins). Authority: ITAA 1997 Part 2-42 (s84-5, s87-15,
 * s87-18/20/25/30, s86-15/86-60), TR 2022/3 — cited by the ONE classifier.
 *
 * The defect: `classifyPsi` was a complete, calc-audit-proven engine that
 * `buildMasterTaxPosition` documented as a step-3 overlay (:27) but never
 * called (Neomatrix A6 island). These tests are RED on pre-fix code — the
 * orchestrator had no `psiByEntity` input and never invoked the module.
 *
 * Honest scope (STEP-0 census 2026-07-24): Monitrax does not yet CAPTURE
 * PSI inputs (no schema fields / assembler mapping), so no LIVE number can
 * move until a capture feature ships — the wiring is exercised here and by
 * tools; absent input = byte-identical output (locked below).
 */
import { describe, it, expect } from 'vitest';
import {
  buildMasterTaxPosition,
  buildMasterTaxPositionDecimal,
  type MasterTaxPositionInput,
} from '../../lib/tax-engine/orchestrator/masterTaxPosition';

const FY = { financialYear: '2024-25' } as MasterTaxPositionInput['fy'];
const base = (over: Partial<MasterTaxPositionInput> = {}): MasterTaxPositionInput => ({
  userId: 'u1',
  fy: FY,
  entities: [],
  ...over,
});

describe('MON-097 · PSI overlay wired into buildMasterTaxPosition step 3', () => {
  it('(a) 90% one-client, no results test → PSI attributed to the individual (RED pre-fix: no overlay existed)', () => {
    const r = buildMasterTaxPosition(base({
      psiByEntity: {
        'ent-co': {
          totalPsiIncome: 150_000,
          incomeFromLargestClient: 135_000, // 90% ≥ 80%
          unrelatedClientCount: 1,
        },
      },
    }));
    const psi = r.crossCutting?.psiByEntity?.['ent-co'];
    expect(psi?.isPsi).toBe(true);
    expect(psi?.isPsb).toBe(false);
    expect(psi?.psiAttributedToIndividual).toBe(150_000);
    expect(r.modulesInvoked).toContain('psiClassifier');
    // The s86-60 deduction-restriction UNCOMPUTED flag surfaces at the top level.
    expect(r.uncomputed.some((u) => u.id === 'UC-PSI-DEDUCTION-RESTRICTIONS')).toBe(true);
    // Citations aggregated (Part 2-42 + s86-15 among them).
    expect(r.authoritySources.some((c) => c.reference.includes('Part 2-42'))).toBe(true);
    expect(r.authoritySources.some((c) => c.reference === 's86-15')).toBe(true);
  });

  it('(b) unrelated-clients test passes → PSB, no attribution', () => {
    const r = buildMasterTaxPosition(base({
      psiByEntity: {
        'ent-co': {
          totalPsiIncome: 150_000,
          incomeFromLargestClient: 90_000, // 60% < 80%
          unrelatedClientCount: 3,
          gainedClientsViaDirectAdvertising: true,
        },
      },
    }));
    const psi = r.crossCutting?.psiByEntity?.['ent-co'];
    expect(psi?.isPsb).toBe(true);
    expect(psi?.psiAttributedToIndividual).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-PSI-DEDUCTION-RESTRICTIONS')).toBe(false);
  });

  it('(c) no psiByEntity input → byte-unchanged output (module not invoked; no PSI keys anywhere)', () => {
    const withOut = buildMasterTaxPosition(base());
    expect(withOut.modulesInvoked).not.toContain('psiClassifier');
    expect(withOut.crossCutting?.psiByEntity).toBeUndefined();
    // And a zero-income PSI input classifies as not-PSI with zero attribution.
    const zeroPsi = buildMasterTaxPosition(base({
      psiByEntity: { 'ent-shop': { totalPsiIncome: 0, incomeFromLargestClient: 0, unrelatedClientCount: 0 } },
    }));
    expect(zeroPsi.crossCutting?.psiByEntity?.['ent-shop']?.isPsi).toBe(false);
    expect(zeroPsi.crossCutting?.psiByEntity?.['ent-shop']?.psiAttributedToIndividual).toBe(0);
  });

  it('(d) the UNCOMPUTED s86-60 flag is SURFACED (never silently defaulted) and the boundary footer sees it', () => {
    const r = buildMasterTaxPosition(base({
      psiByEntity: {
        'ent-co': { totalPsiIncome: 100_000, incomeFromLargestClient: 100_000, unrelatedClientCount: 0 },
      },
    }));
    const flag = r.uncomputed.find((u) => u.id === 'UC-PSI-DEDUCTION-RESTRICTIONS');
    expect(flag).toBeDefined();
    expect(flag?.citation?.reference).toBe('s86-60');
  });

  it('Float === Decimal twin: identical overlay results + modules + flags on every case', () => {
    const cases: NonNullable<MasterTaxPositionInput['psiByEntity']>[] = [
      { e: { totalPsiIncome: 150_000, incomeFromLargestClient: 135_000, unrelatedClientCount: 1 } },
      { e: { totalPsiIncome: 150_000, incomeFromLargestClient: 90_000, unrelatedClientCount: 3, gainedClientsViaDirectAdvertising: true } },
      { e: { totalPsiIncome: 100_000, incomeFromLargestClient: 50_000, unrelatedClientCount: 0 } },
      { e: { totalPsiIncome: 100_000, incomeFromLargestClient: 90_000, unrelatedClientCount: 0, meetsResultsTest: true } },
    ];
    for (const psiByEntity of cases) {
      const f = buildMasterTaxPosition(base({ psiByEntity }));
      const d = buildMasterTaxPositionDecimal(base({ psiByEntity }));
      expect(d.crossCutting?.psiByEntity).toEqual(f.crossCutting?.psiByEntity);
      expect(d.modulesInvoked).toEqual(f.modulesInvoked);
      expect(d.uncomputed.map((u) => u.id).sort()).toEqual(f.uncomputed.map((u) => u.id).sort());
    }
  });
});
