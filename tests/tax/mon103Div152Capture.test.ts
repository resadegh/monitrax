/**
 * MON-103 (capture Stage 3) — Div 152 small-business CGT concession facts
 * are CAPTURED and flow through the ONE producer into the live overlay,
 * with the all-or-nothing safe default (Reza standing GO 2026-07-27):
 *
 *   1. SIX-FACT ALL-OR-NOTHING: `buildDiv152Input` returns null (overlay
 *      inert) unless the four numerics (gainAfterDiv115, maxNetAssetValue,
 *      aggregatedTurnover, monthsHeld) AND the two eligibility booleans
 *      (isActiveAsset, isRetirementOrIncapacity) are ALL explicitly set.
 *      For those two booleans NEITHER default is safe — false denies real
 *      concessions on display, true fabricates them — so "Not sure" keeps
 *      the overlay inert.
 *   2. ELECTIONS carry the ENGINE's own defaults when unanswered (null →
 *      absent key: reduction ON s152-205, exemption OFF s152-305, rollover
 *      OFF s152-410). Electing the retirement exemption REQUIRES
 *      retirementExemptionUsedToDate — a blank can never assume $0 of the
 *      $500k lifetime cap already used (that would OVERSTATE the exemption).
 *
 * §19.2 worked example (locked end-to-end, mirrors the approved Stitch
 * design): gain $120,000, MNAV $4.2M (≤ $6M — s152-15 passes), turnover
 * $2.5M (> $2M — irrelevant, either test suffices), active asset, 64
 * months, retirement-connected, reduction elected + retirement exemption
 * elected with $400,000 lifetime used →
 *   50% AAR: −$60,000 → $60,000 (s152-205)
 *   retirement exemption: remaining cap $500k−$400k = $100k → −$60,000 → $0
 *   **assessable gain $0** with s152-205 + s152-305 cited.
 *
 * Coverage (precise): verifies the pure gate + mapping and the orchestrator
 * flow from a built input. Does NOT verify the Prisma read path
 * (assembleDiv152Input's DB query — Ring-3 on a seeded entity owns that)
 * and does NOT verify the rendered card UX (Reza's eyeball + Ring-3).
 */
import { describe, it, expect } from 'vitest';
import { buildDiv152Input } from '../../lib/services/entityTaxFactsAssembler';
import {
  buildMasterTaxPosition,
  buildMasterTaxPositionDecimal,
  type MasterTaxPositionInput,
} from '../../lib/tax-engine/orchestrator/masterTaxPosition';

const FY = { financialYear: '2025-26' } as MasterTaxPositionInput['fy'];

const assessment = (
  over: Partial<Parameters<typeof buildDiv152Input>[0]> = {},
): Parameters<typeof buildDiv152Input>[0] => ({
  gainAfterDiv115: 120_000,
  maxNetAssetValue: 4_200_000, // ≤ $6M — s152-15 passes
  aggregatedTurnover: 2_500_000, // > $2M — MNAV alone satisfies the basic conditions
  monthsHeld: 64,
  isActiveAsset: true,
  isRetirementOrIncapacity: true,
  electActiveAssetReduction: true,
  electRetirementExemption: true,
  electRollover: false,
  retirementExemptionUsedToDate: 400_000,
  ...over,
});

describe('MON-103 · the all-or-nothing gate (buildDiv152Input)', () => {
  it('any numeric missing → null (overlay inert)', () => {
    expect(buildDiv152Input(assessment({ gainAfterDiv115: null }))).toBeNull();
    expect(buildDiv152Input(assessment({ maxNetAssetValue: null }))).toBeNull();
    expect(buildDiv152Input(assessment({ aggregatedTurnover: null }))).toBeNull();
    expect(buildDiv152Input(assessment({ monthsHeld: null }))).toBeNull();
  });

  it('eligibility "Not sure" → null — neither defaulting direction is safe for isActiveAsset / isRetirementOrIncapacity', () => {
    expect(buildDiv152Input(assessment({ isActiveAsset: null }))).toBeNull();
    expect(buildDiv152Input(assessment({ isRetirementOrIncapacity: null }))).toBeNull();
  });

  it('retirement exemption elected WITHOUT the lifetime-used figure → null — $0-used is never assumed (it would overstate the exemption)', () => {
    expect(
      buildDiv152Input(assessment({ electRetirementExemption: true, retirementExemptionUsedToDate: null })),
    ).toBeNull();
  });

  it('unanswered elections → ABSENT keys, so the ENGINE\'s own defaults apply (reduction ON, exemption/rollover OFF)', () => {
    const input = buildDiv152Input(
      assessment({
        electActiveAssetReduction: null,
        electRetirementExemption: null,
        electRollover: null,
        retirementExemptionUsedToDate: null,
      }),
    );
    expect(input).not.toBeNull();
    for (const key of [
      'electActiveAssetReduction',
      'electRetirementExemption',
      'electRollover',
      'retirementExemptionUsedToDate',
    ]) {
      expect(key in input!).toBe(false);
    }
  });

  it('answered elections pass through verbatim — an explicit opt-out (false) is an answer, not an absence', () => {
    const input = buildDiv152Input(assessment({ electActiveAssetReduction: false }));
    expect(input).toMatchObject({
      electActiveAssetReduction: false,
      electRetirementExemption: true,
      retirementExemptionUsedToDate: 400_000,
    });
  });
});

describe('MON-103 · captured facts fire the live overlay end-to-end (§19.2 worked example)', () => {
  it('the design\'s ladder: $120,000 → AAR −$60,000 → retirement exemption −$60,000 → assessable $0 (both twins)', () => {
    const input = buildDiv152Input(assessment())!;
    for (const build of [buildMasterTaxPosition, buildMasterTaxPositionDecimal]) {
      const r = build({ userId: 'u1', fy: FY, entities: [], div152ByEntity: { 'ent-co': input } });
      const d = r.crossCutting?.div152ByEntity?.['ent-co'];
      expect(d?.basicConditionsMet).toBe(true);
      expect(d?.fifteenYearExemptionApplied).toBe(false); // 64 months < 180
      expect(d?.activeAssetReductionApplied).toBe(true);
      expect(Number(d?.retirementExemptionApplied)).toBeCloseTo(60_000, 6); // min(60k, 500k−400k)
      expect(Number(d?.assessableGain)).toBeCloseTo(0, 6);
      expect(r.modulesInvoked).toContain('div152SmallBusinessConcessions');
      expect(r.authoritySources.some((c) => c.reference === 's152-205')).toBe(true);
      expect(r.authoritySources.some((c) => c.reference === 's152-305')).toBe(true);
    }
  });

  it('the 15-year direction: 190 months + retirement → gain entirely disregarded, s152-105 cited', () => {
    const input = buildDiv152Input(assessment({ monthsHeld: 190 }))!;
    const r = buildMasterTaxPositionDecimal({
      userId: 'u1',
      fy: FY,
      entities: [],
      div152ByEntity: { 'ent-co': input },
    });
    const d = r.crossCutting?.div152ByEntity?.['ent-co'];
    expect(d?.fifteenYearExemptionApplied).toBe(true);
    expect(Number(d?.assessableGain)).toBeCloseTo(0, 6);
    expect(r.authoritySources.some((c) => c.reference === 's152-105')).toBe(true);
  });

  it('gate CLOSED (an eligibility "Not sure") → no overlay input → byte-identical position', () => {
    expect(buildDiv152Input(assessment({ isActiveAsset: null }))).toBeNull();
    const withOut = buildMasterTaxPositionDecimal({ userId: 'u1', fy: FY, entities: [] });
    expect(withOut.crossCutting?.div152ByEntity).toBeUndefined();
    expect(withOut.modulesInvoked).not.toContain('div152SmallBusinessConcessions');
  });
});
