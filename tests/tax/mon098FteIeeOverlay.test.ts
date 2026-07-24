/**
 * MON-098 (Neo-G4 · P2) — the FTE/IEE overlay is WIRED into the master tax
 * orchestrator (both twins). Authority: ITAA 1936 Sch 2F (s272-75 FTE,
 * s272-85 IEE, s272-95 family group, s271-15 FTDT 47%), ITAA 1936 Pt VA
 * (TFN withholding 47%), PCG 2022/2 — cited by the ONE classifier.
 *
 * The defect: `classifyFteIeeDistributions` was a complete, calc-audit-proven
 * engine that `buildMasterTaxPosition` documented as a step-3 overlay (:27-34)
 * but never called (Neomatrix A6 island). These tests are RED on pre-fix
 * code — the orchestrator had no `fteIeeByEntity` input.
 *
 * §19.2 worked examples (hand-computed):
 *   (a) inside family $100,000, TFN quoted → no FTDT, no withholding, net $100,000
 *   (b) OUTSIDE family $100,000 → FTDT 0.47 × 100,000 = $47,000 trustee-payable;
 *       beneficiary still receives gross $100,000
 *   (c) TFN NOT quoted $80,000 (even a family member) → withholding
 *       0.47 × 80,000 = $37,600; net to beneficiary $42,400; no FTDT
 *   (d) CONTROLLED_ENTITY relationship → UC-FTE-CONTROL-TEST surfaced
 *       (caller-asserted control is flagged, never silently trusted)
 *
 * Honest scope (STEP-0 census 2026-07-24): capture is PARTIAL —
 * hasFamilyTrustElection + gross distributions exist (DistributionResolution),
 * but relationship / hasQuotedTfn / coveredByIee are uncaptured, so no LIVE
 * number can move until that capture ships; absent input = byte-identical
 * output (locked below).
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

const ben = (
  id: string,
  amount: number,
  relationship: 'TEST_INDIVIDUAL' | 'FAMILY_MEMBER' | 'CONTROLLED_ENTITY' | 'OUTSIDE_FAMILY',
  hasQuotedTfn = true,
  coveredByIee?: boolean,
) => ({
  beneficiaryId: id,
  beneficiaryName: id,
  distributionAmount: amount,
  relationship,
  hasQuotedTfn,
  ...(coveredByIee !== undefined ? { coveredByIee } : {}),
});

describe('MON-098 · FTE/IEE overlay wired into buildMasterTaxPosition step 3', () => {
  it('(a) inside-family distribution → no FTDT, no withholding (RED pre-fix: no overlay existed)', () => {
    const r = buildMasterTaxPosition(base({
      fteIeeByEntity: {
        'trust-1': {
          hasFamilyTrustElection: true,
          beneficiaries: [ben('spouse', 100_000, 'FAMILY_MEMBER')],
        },
      },
    }));
    const fte = r.crossCutting?.fteIeeByEntity?.['trust-1'];
    expect(fte?.classifications[0]?.outcome).toBe('INSIDE_FAMILY');
    expect(fte?.totalFtdtPayable).toBe(0);
    expect(fte?.totalTfnWithholding).toBe(0);
    expect(fte?.classifications[0]?.netToBeneficiary).toBe(100_000);
    expect(r.modulesInvoked).toContain('fteIeeClassifier');
    // Sch 2F citations aggregate to the top level.
    expect(r.authoritySources.some((c) => c.reference === 'Sch 2F')).toBe(true);
    expect(r.authoritySources.some((c) => c.reference === 's272-75 (FTE)')).toBe(true);
  });

  it('(b) outside-family distribution → 47% FTDT trustee-payable ($47,000 on $100,000), UC-FTDT surfaced', () => {
    const r = buildMasterTaxPosition(base({
      fteIeeByEntity: {
        'trust-1': {
          hasFamilyTrustElection: true,
          beneficiaries: [ben('outsider-co', 100_000, 'OUTSIDE_FAMILY')],
        },
      },
    }));
    const fte = r.crossCutting?.fteIeeByEntity?.['trust-1'];
    expect(fte?.classifications[0]?.outcome).toBe('OUTSIDE_FAMILY_FTDT');
    expect(fte?.totalFtdtPayable).toBe(47_000); // 0.47 × 100,000
    expect(fte?.classifications[0]?.netToBeneficiary).toBe(100_000); // trustee bears FTDT
    // The s271-15 citation + the FTDT UNCOMPUTED flag surface at the top level.
    expect(r.authoritySources.some((c) => c.reference === 's271-15 (FTDT)')).toBe(true);
    expect(r.uncomputed.some((u) => u.id === 'UC-FTDT-OUTSIDE-FAMILY')).toBe(true);
  });

  it('(c) beneficiary not quoting TFN → 47% withheld regardless of relationship ($37,600 on $80,000)', () => {
    const r = buildMasterTaxPosition(base({
      fteIeeByEntity: {
        'trust-1': {
          hasFamilyTrustElection: true,
          beneficiaries: [ben('child', 80_000, 'FAMILY_MEMBER', false)],
        },
      },
    }));
    const fte = r.crossCutting?.fteIeeByEntity?.['trust-1'];
    expect(fte?.classifications[0]?.outcome).toBe('TFN_WITHHOLDING');
    expect(fte?.totalTfnWithholding).toBe(37_600); // 0.47 × 80,000
    expect(fte?.classifications[0]?.netToBeneficiary).toBeCloseTo(42_400, 6);
    expect(fte?.totalFtdtPayable).toBe(0); // family member — no FTDT
    expect(r.authoritySources.some((c) => c.reference === 'Pt VA (TFN withholding)')).toBe(true);
  });

  it('(d) fact-dependent classification is SURFACED, never silently trusted: control test + IEE', () => {
    const r = buildMasterTaxPosition(base({
      fteIeeByEntity: {
        'trust-1': {
          hasFamilyTrustElection: true,
          beneficiaries: [
            ben('family-co', 50_000, 'CONTROLLED_ENTITY'),
            ben('iee-entity', 30_000, 'OUTSIDE_FAMILY', true, true),
          ],
        },
      },
    }));
    const fte = r.crossCutting?.fteIeeByEntity?.['trust-1'];
    // Caller-asserted control → UC-FTE-CONTROL-TEST flagged at the top level, amounts NOT zeroed.
    const flag = r.uncomputed.find((u) => u.id === 'UC-FTE-CONTROL-TEST');
    expect(flag).toBeDefined();
    expect(flag?.citation?.reference).toBe('s272-95');
    expect(fte?.classifications[0]?.netToBeneficiary).toBe(50_000);
    // Valid IEE → treated as inside family, no FTDT, s272-85 cited.
    expect(fte?.classifications[1]?.outcome).toBe('INSIDE_VIA_IEE');
    expect(fte?.totalFtdtPayable).toBe(0);
    expect(r.authoritySources.some((c) => c.reference === 's272-85 (IEE)')).toBe(true);
  });

  it('no fteIeeByEntity input → byte-unchanged output (module not invoked; no FTE keys anywhere)', () => {
    const withOut = buildMasterTaxPosition(base());
    expect(withOut.modulesInvoked).not.toContain('fteIeeClassifier');
    expect(withOut.crossCutting?.fteIeeByEntity).toBeUndefined();
  });

  it('Float === Decimal twin: identical overlay results + modules + flags on every case', () => {
    const cases: NonNullable<MasterTaxPositionInput['fteIeeByEntity']>[] = [
      { t: { hasFamilyTrustElection: true, beneficiaries: [ben('a', 100_000, 'FAMILY_MEMBER')] } },
      { t: { hasFamilyTrustElection: true, beneficiaries: [ben('b', 100_000, 'OUTSIDE_FAMILY')] } },
      { t: { hasFamilyTrustElection: true, beneficiaries: [ben('c', 80_000, 'FAMILY_MEMBER', false)] } },
      { t: { hasFamilyTrustElection: false, beneficiaries: [ben('d', 60_000, 'OUTSIDE_FAMILY', false)] } },
      { t: { hasFamilyTrustElection: true, beneficiaries: [ben('e', 50_000, 'CONTROLLED_ENTITY'), ben('f', 30_000, 'OUTSIDE_FAMILY', true, true)] } },
    ];
    for (const fteIeeByEntity of cases) {
      const f = buildMasterTaxPosition(base({ fteIeeByEntity }));
      const d = buildMasterTaxPositionDecimal(base({ fteIeeByEntity }));
      expect(d.crossCutting?.fteIeeByEntity).toEqual(f.crossCutting?.fteIeeByEntity);
      expect(d.modulesInvoked).toEqual(f.modulesInvoked);
      expect(d.uncomputed.map((u) => u.id).sort()).toEqual(f.uncomputed.map((u) => u.id).sort());
    }
  });
});
