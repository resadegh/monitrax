/**
 * MON-088 — the Medicare family + private-hospital-cover legs (Ring-0
 * worked examples, §19.2). Authority: ATO "Medicare levy surcharge income,
 * thresholds and rates" + "Medicare levy reduction" (cited in the MON-088
 * registry entry).
 *
 * The rule matrix under test (config-driven; FY24-25 values via the
 * honest-stale fallback: singles MLS tiers $97k/$113k/$151k → family = ×2
 * = $194k/$226k/$302k, +$1,500 per dependent child AFTER the first; levy
 * low-income single $27,222 / family $45,907 + $4,216/child):
 *  1. Cover is family ALL-OR-NOTHING: one uncovered member makes every
 *     over-threshold adult liable — a covered partner is NOT exempt while
 *     their spouse is uncovered (the ATO correction to the brief's (c)).
 *  2. FAMILY: MLS tier selected on COMBINED income vs family tiers; the
 *     surcharge is levied on each person's OWN income.
 *  3. Low-earner exception: own income ≤ the levy low-income single
 *     threshold → no MLS for that person.
 *  4. The pre-MON-088 legacy default (no context) stays covered/SINGLE —
 *     the estimate callers' behaviour is unchanged.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateMedicareLevy,
  calculateMedicareLevyDecimal,
} from '../../lib/tax-engine/core/medicareLevyCalculator';
import { getTaxYearConfig } from '../../lib/tax-engine/config/taxYearConfig';
import { calculateTaxPosition } from '../../lib/tax-engine/position/taxPositionCalculator';

const cfg = getTaxYearConfig('2024-25');
const T = cfg.medicareSurchargeThresholds; // singles tiers
const FAM = cfg.medicareSurchargeFamily!;
const famBase = (T[0].max as number) * FAM.singleMultiplier; // 97,000×2 = 194,000

describe('MON-088 · MLS — family income + cover rule matrix (Float)', () => {
  it('(a) couple, combined UNDER the family threshold, no cover → no MLS (was wrongly SINGLE-tested)', () => {
    // $100k + $80k = $180k combined < $194k family base. Pre-fix, $100k
    // tested alone vs $97k single → 1% surcharge. Now: none.
    const r = calculateMedicareLevy(
      { taxableIncome: 100_000, familyStatus: 'FAMILY', spouseIncome: 80_000, dependentChildren: 0, hasPrivateHealthInsurance: false },
      cfg,
    );
    expect(r.medicareSurcharge).toBe(0);
  });

  it('(b) couple, combined OVER the family threshold, no cover → MLS at the combined tier, on OWN income', () => {
    // $120k + $100k = $220k combined → family tier 2 ($194,002–$226,000 → 1%).
    // Surcharge = 1% × OWN $120k = $1,200 (never 1% × combined).
    const r = calculateMedicareLevy(
      { taxableIncome: 120_000, familyStatus: 'FAMILY', spouseIncome: 100_000, dependentChildren: 0, hasPrivateHealthInsurance: false },
      cfg,
    );
    expect(r.medicareSurcharge).toBeCloseTo(120_000 * 0.01, 2);
  });

  it('(c-CORRECTED) cover is all-or-nothing: the CALLER passes familyCovered — one uncovered spouse means the flag is false and BOTH pay', () => {
    // The engine input hasPrivateHealthInsurance === "whole family covered".
    // Family NOT fully covered → each over-threshold adult pays on own income.
    const partnerA = calculateMedicareLevy(
      { taxableIncome: 120_000, familyStatus: 'FAMILY', spouseIncome: 100_000, hasPrivateHealthInsurance: false },
      cfg,
    );
    const partnerB = calculateMedicareLevy(
      { taxableIncome: 100_000, familyStatus: 'FAMILY', spouseIncome: 120_000, hasPrivateHealthInsurance: false },
      cfg,
    );
    expect(partnerA.medicareSurcharge).toBeGreaterThan(0);
    expect(partnerB.medicareSurcharge).toBeGreaterThan(0);
    // Fully covered family → zero for both.
    const covered = calculateMedicareLevy(
      { taxableIncome: 120_000, familyStatus: 'FAMILY', spouseIncome: 100_000, hasPrivateHealthInsurance: true },
      cfg,
    );
    expect(covered.medicareSurcharge).toBe(0);
  });

  it('(d) +1 dependent child AFTER the first raises the family threshold by the config increase', () => {
    // Combined $195k: over the $194k base → liable with 0-1 children.
    // With 2 children: threshold $194k + $1,500 = $195.5k → NOT liable.
    const base = { taxableIncome: 110_000, familyStatus: 'FAMILY' as const, spouseIncome: 85_000, hasPrivateHealthInsurance: false };
    expect(calculateMedicareLevy({ ...base, dependentChildren: 1 }, cfg).medicareSurcharge).toBeGreaterThan(0);
    expect(calculateMedicareLevy({ ...base, dependentChildren: 2 }, cfg).medicareSurcharge).toBe(0);
    expect(FAM.dependentChildIncrease).toBe(1500);
  });

  it('(e) a genuine single is unchanged: own income vs singles tiers', () => {
    const r = calculateMedicareLevy(
      { taxableIncome: 120_000, familyStatus: 'SINGLE', hasPrivateHealthInsurance: false },
      cfg,
    );
    // $120k → singles tier $113,001–$151,000 → 1.25%.
    expect(r.medicareSurcharge).toBeCloseTo(120_000 * 0.0125, 2);
  });

  it('(f) the low-earner exception: own income at/below the levy low threshold pays no MLS in an uncovered rich family', () => {
    const r = calculateMedicareLevy(
      { taxableIncome: 25_000, familyStatus: 'FAMILY', spouseIncome: 300_000, hasPrivateHealthInsurance: false },
      cfg,
    );
    expect(r.medicareSurcharge).toBe(0);
  });

  it('(g) legacy default (no context) is byte-identical: covered + SINGLE → base levy only', () => {
    const r = calculateMedicareLevy({ taxableIncome: 175_432 }, cfg);
    expect(r.medicareSurcharge).toBe(0);
    expect(r.total).toBeCloseTo(175_432 * 0.02, 2); // the live $3,509 shape
  });

  it('(h) levy family-reduction leg tests FAMILY income — a low earner in a RICH family gets NO fabricated reduction', () => {
    // Own $30k, spouse $300k: family income far past shade-out → full 2% on own.
    const r = calculateMedicareLevy(
      { taxableIncome: 30_000, familyStatus: 'FAMILY', spouseIncome: 300_000, hasPrivateHealthInsurance: true },
      cfg,
    );
    expect(r.medicareLevy).toBeCloseTo(30_000 * 0.02, 2);
    // And a genuinely low-income FAMILY (combined under the family threshold)
    // still pays nothing.
    const poor = calculateMedicareLevy(
      { taxableIncome: 30_000, familyStatus: 'FAMILY', spouseIncome: 10_000, hasPrivateHealthInsurance: true },
      cfg,
    );
    expect(poor.medicareLevy).toBe(0); // 40k combined < 45,907 family threshold
  });
});

describe('MON-088 · Float === Decimal twin', () => {
  const cases = [
    { taxableIncome: 100_000, familyStatus: 'FAMILY' as const, spouseIncome: 80_000, hasPrivateHealthInsurance: false },
    { taxableIncome: 120_000, familyStatus: 'FAMILY' as const, spouseIncome: 100_000, hasPrivateHealthInsurance: false },
    { taxableIncome: 25_000, familyStatus: 'FAMILY' as const, spouseIncome: 300_000, hasPrivateHealthInsurance: false },
    { taxableIncome: 110_000, familyStatus: 'FAMILY' as const, spouseIncome: 85_000, dependentChildren: 2, hasPrivateHealthInsurance: false },
    { taxableIncome: 30_000, familyStatus: 'FAMILY' as const, spouseIncome: 300_000, hasPrivateHealthInsurance: true },
    { taxableIncome: 120_000, familyStatus: 'SINGLE' as const, hasPrivateHealthInsurance: false },
  ];
  for (const [i, c] of cases.entries()) {
    it(`case ${i}: levy + surcharge agree across twins`, () => {
      const f = calculateMedicareLevy(c, cfg);
      const d = calculateMedicareLevyDecimal(c, cfg);
      expect(d.medicareLevy.toNumber()).toBeCloseTo(f.medicareLevy, 2);
      expect(d.medicareSurcharge.toNumber()).toBeCloseTo(f.medicareSurcharge, 2);
    });
  }
});

describe('MON-088 · position wiring (Ring-1/2 shape)', () => {
  const salary = (amount: number) => ({
    id: 'i1', name: 'Salary', type: 'SALARY', amount, frequency: 'ANNUAL',
    isTaxable: true,
  }) as any;

  it('medicareContext flows through calculateTaxPosition; absent context = legacy', () => {
    const base = { incomes: [salary(120_000)], expenses: [], depreciations: [], financialYear: '2024-25' };
    const legacy = calculateTaxPosition(base as any);
    expect(legacy.tax.medicareSurcharge).toBe(0); // covered-by-default legacy
    const family = calculateTaxPosition({
      ...base,
      medicareContext: { familyStatus: 'FAMILY', dependentChildren: 0, spouseIncome: 100_000, familyCovered: false },
    } as any);
    // combined > family tier 2 → 1% on OWN taxable income
    expect(family.tax.medicareSurcharge).toBeCloseTo(legacy.tax.taxableIncome * 0.01, 2);
    // income tax NEVER moves with family context (no joint return in AU)
    expect(family.tax.taxOnIncome).toBeCloseTo(legacy.tax.taxOnIncome, 2);
  });

  it('familyCovered null (not entered) does NOT silently assert cover — surcharge applies', () => {
    const r = calculateTaxPosition({
      incomes: [salary(120_000)], expenses: [], depreciations: [], financialYear: '2024-25',
      medicareContext: { familyStatus: 'FAMILY', dependentChildren: 0, spouseIncome: 100_000, familyCovered: null },
    } as any);
    expect(r.tax.medicareSurcharge).toBeGreaterThan(0);
  });
});
