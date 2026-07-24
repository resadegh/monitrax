/**
 * MON-099 (Neo-G4 · P3) — the Div 152 overlay is WIRED into the master tax
 * orchestrator (both twins). Authority: ITAA 1997 Div 152 — s152-10 basic
 * conditions, s152-15 MNAV $6M, s152-20 turnover $2M, s152-105 15-year
 * exemption, s152-205 50% active-asset reduction, s152-305/310 retirement
 * exemption ($500k lifetime), s152-410 rollover — cited by the ONE engine.
 *
 * The defect: `applyDiv152` was a complete, calc-audit-proven engine that
 * `buildMasterTaxPosition` documented as a step-3 overlay (:27-34) but never
 * called — the LAST Neo-G4 A6 island. These tests are RED on pre-fix code.
 * With this wiring the A6 island allowlist is EMPTY: every built tax engine
 * reaches the live position.
 *
 * §19.2 worked examples (hand-computed):
 *   (a) $200,000 gain, MNAV $4M, held 16y, retiring → 15-year exemption,
 *       assessable $0 (gain entirely disregarded)
 *   (b) $200,000 gain, MNAV $4M, held 10y → 50% active-asset reduction →
 *       assessable $100,000
 *   (c) MNAV $8M AND turnover $3M → basic conditions FAIL → gain unchanged
 *   (e) $300,000 gain + retirement election with $400k lifetime already used:
 *       50% AAR → $150,000; remaining cap 500k−400k = $100,000 →
 *       retirement applied $100,000 → assessable $50,000; cap flag surfaced
 *
 * Honest scope (STEP-0 census 2026-07-24): Div 152 inputs (gain, MNAV,
 * turnover, active-asset test, months held, retirement flag, elections) are
 * captured NOWHERE in the product — no live number can move until a capture
 * feature ships; absent input = byte-identical output (locked below).
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

const d152 = (over: Partial<NonNullable<MasterTaxPositionInput['div152ByEntity']>[string]> = {}) => ({
  gainAfterDiv115: 200_000,
  maxNetAssetValue: 4_000_000,
  aggregatedTurnover: 3_000_000, // > $2M — qualification rides the MNAV leg
  isActiveAsset: true,
  monthsHeld: 120,
  isRetirementOrIncapacity: false,
  ...over,
});

describe('MON-099 · Div 152 overlay wired into buildMasterTaxPosition step 3', () => {
  it('(a) held 16y + retiring → 15-year exemption, gain entirely disregarded (RED pre-fix: no overlay existed)', () => {
    const r = buildMasterTaxPosition(base({
      div152ByEntity: { 'ent-co': d152({ monthsHeld: 192, isRetirementOrIncapacity: true }) },
    }));
    const d = r.crossCutting?.div152ByEntity?.['ent-co'];
    expect(d?.fifteenYearExemptionApplied).toBe(true);
    expect(d?.assessableGain).toBe(0);
    expect(r.modulesInvoked).toContain('div152SmallBusinessConcessions');
    expect(r.authoritySources.some((c) => c.reference === 's152-105')).toBe(true);
    expect(r.authoritySources.some((c) => c.reference === 'Div 152')).toBe(true);
  });

  it('(b) held 10y → 50% active-asset reduction: $200,000 → $100,000 assessable', () => {
    const r = buildMasterTaxPosition(base({
      div152ByEntity: { 'ent-co': d152() },
    }));
    const d = r.crossCutting?.div152ByEntity?.['ent-co'];
    expect(d?.basicConditionsMet).toBe(true);
    expect(d?.activeAssetReductionApplied).toBe(true);
    expect(d?.assessableGain).toBe(100_000); // 200,000 × 50% (s152-205)
    expect(r.authoritySources.some((c) => c.reference === 's152-205')).toBe(true);
  });

  it('(c) MNAV > $6M AND turnover > $2M → NO concession, gain unchanged', () => {
    const r = buildMasterTaxPosition(base({
      div152ByEntity: {
        'ent-co': d152({ maxNetAssetValue: 8_000_000, aggregatedTurnover: 3_000_000 }),
      },
    }));
    const d = r.crossCutting?.div152ByEntity?.['ent-co'];
    expect(d?.basicConditionsMet).toBe(false);
    expect(d?.assessableGain).toBe(200_000); // untouched
    // $8M and $3M are both OUTSIDE the 80–120% threshold bands — no aggregation flag.
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV152-AGGREGATION')).toBe(false);
  });

  it('(d) MNAV near the $6M threshold → UC-DIV152-AGGREGATION surfaced (flagged, never zeroed)', () => {
    const r = buildMasterTaxPosition(base({
      div152ByEntity: { 'ent-co': d152({ maxNetAssetValue: 5_500_000 }) },
    }));
    const d = r.crossCutting?.div152ByEntity?.['ent-co'];
    const flag = r.uncomputed.find((u) => u.id === 'UC-DIV152-AGGREGATION');
    expect(flag).toBeDefined();
    expect(flag?.citation?.reference).toBe('s152-15');
    // Concessions still apply — the flag warns, it does not zero.
    expect(d?.basicConditionsMet).toBe(true);
    expect(d?.assessableGain).toBe(100_000);
  });

  it('(e) retirement exemption honours the $500k lifetime cap: $300,000 gain, $400k used → assessable $50,000', () => {
    const r = buildMasterTaxPosition(base({
      div152ByEntity: {
        'ent-co': d152({
          gainAfterDiv115: 300_000,
          electRetirementExemption: true,
          retirementExemptionUsedToDate: 400_000,
        }),
      },
    }));
    const d = r.crossCutting?.div152ByEntity?.['ent-co'];
    // 300,000 → 50% AAR → 150,000; remaining cap 500k−400k = 100,000 → assessable 50,000.
    expect(d?.retirementExemptionApplied).toBe(100_000);
    expect(d?.assessableGain).toBe(50_000);
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV152-RETIREMENT-CAP')).toBe(true);
    expect(r.authoritySources.some((c) => c.reference === 's152-305')).toBe(true);
  });

  it('no div152ByEntity input → byte-unchanged output (module not invoked; no Div 152 keys anywhere)', () => {
    const withOut = buildMasterTaxPosition(base());
    expect(withOut.modulesInvoked).not.toContain('div152SmallBusinessConcessions');
    expect(withOut.crossCutting?.div152ByEntity).toBeUndefined();
  });

  it('Float === Decimal twin (TRUE Decimal sibling): identical numbers + modules + flags on every case', () => {
    const cases: NonNullable<MasterTaxPositionInput['div152ByEntity']>[] = [
      { e: d152({ monthsHeld: 192, isRetirementOrIncapacity: true }) },
      { e: d152() },
      { e: d152({ maxNetAssetValue: 8_000_000, aggregatedTurnover: 3_000_000 }) },
      { e: d152({ maxNetAssetValue: 5_500_000 }) },
      { e: d152({ gainAfterDiv115: 300_000, electRetirementExemption: true, retirementExemptionUsedToDate: 400_000 }) },
      { e: d152({ gainAfterDiv115: 300_000, electRetirementExemption: true, electRollover: true }) },
    ];
    for (const div152ByEntity of cases) {
      const f = buildMasterTaxPosition(base({ div152ByEntity }));
      const fd = f.crossCutting?.div152ByEntity?.['e'];
      const dec = buildMasterTaxPositionDecimal(base({ div152ByEntity }));
      const dd = dec.crossCutting?.div152ByEntity?.['e'];
      expect(dd?.basicConditionsMet).toBe(fd?.basicConditionsMet);
      expect(dd?.fifteenYearExemptionApplied).toBe(fd?.fifteenYearExemptionApplied);
      expect(dd?.activeAssetReductionApplied).toBe(fd?.activeAssetReductionApplied);
      expect(Number(dd?.assessableGain)).toBeCloseTo(fd?.assessableGain ?? NaN, 6);
      expect(Number(dd?.retirementExemptionApplied)).toBeCloseTo(fd?.retirementExemptionApplied ?? NaN, 6);
      expect(Number(dd?.rolloverApplied)).toBeCloseTo(fd?.rolloverApplied ?? NaN, 6);
      expect(dec.modulesInvoked).toEqual(f.modulesInvoked);
      expect(dec.uncomputed.map((u) => u.id).sort()).toEqual(f.uncomputed.map((u) => u.id).sort());
    }
  });
});
