/**
 * Phase 59 — R0: managed-rental reconciliation engine worked examples
 * (PHASE_59_MANAGED_RENTAL_INCOME.md §7; CLAUDE.md §19.2 four-step evidence).
 *
 * Input contract (§19.2 step 1): declaredGrossAmount is Income.amount — the
 * PER-PERIOD declared gross (AUD, e.g. 650 per WEEKLY period, same convention
 * the tax engine annualises); netDisbursementAmount is the bank credit (AUD).
 * Governing rule (step 2): ATO — gross rent is assessable (ITAA 1997 s6-5);
 * agent management/letting costs are deductible (s8-1); frequencies convert
 * via the canonical 52/26/12/4/2/1 periods (lib/utils/frequencies.ts).
 * Expected outputs (step 3) are hand-computed in each test name.
 * Verification (step 4) = these assertions + Float/Decimal parity.
 */
import { describe, it, expect } from 'vitest';
import {
  reconcileManagedRental,
  reconcileManagedRentalDecimal,
  buildDerivedAgentCostExpense,
  buildAnomalyExcessExpense,
} from '../../lib/calculations/rentalReconciliation';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '../../lib/tax-engine/position/taxPositionCalculator';

const CANONICAL = {
  declaredGrossAmount: 650,
  declaredGrossFrequency: 'WEEKLY',
  netDisbursementAmount: 1100,
  disbursementFrequency: 'FORTNIGHTLY',
} as const;

describe('reconcileManagedRental — worked examples', () => {
  it('$650/wk gross vs $1,100/ft net → 1,300/ft gross, $200 gap, $5,200/yr, material', () => {
    const r = reconcileManagedRental(CANONICAL);
    expect(r.grossPerDisbursementPeriod).toBeCloseTo(1300, 9); // 650×52÷26
    expect(r.gap).toBeCloseTo(200, 9); // 1300−1100
    expect(r.gapAnnual).toBeCloseTo(5200, 9); // 200×26
    expect(r.material).toBe(true);
    expect(r.anomaly).toBe(false);
  });

  it('Float === Decimal parity on the canonical example', () => {
    const f = reconcileManagedRental(CANONICAL);
    const d = reconcileManagedRentalDecimal(CANONICAL);
    expect(Number(d.grossPerDisbursementPeriod.toString())).toBeCloseTo(f.grossPerDisbursementPeriod, 9);
    expect(Number(d.gap.toString())).toBeCloseTo(f.gap, 9);
    expect(Number(d.gapAnnual.toString())).toBeCloseTo(f.gapAnnual, 9);
    expect(d.material).toBe(f.material);
    expect(d.anomaly).toBe(f.anomaly);
  });

  it('derives the disbursement cadence from dates via the ONE canonical detector', () => {
    // 6 disbursements exactly 14 days apart → FORTNIGHTLY (never a second path)
    const dates = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(2026, 0, 2 + i * 14)));
    const r = reconcileManagedRental({
      declaredGrossAmount: 650,
      declaredGrossFrequency: 'WEEKLY',
      netDisbursementAmount: 1100,
      disbursementDates: dates,
    });
    expect(r.disbursementFrequency).toBe('FORTNIGHTLY');
    expect(r.gap).toBeCloseTo(200, 9);
  });

  it('a lone disbursement with no cadence evidence compares on the rent cadence', () => {
    // gross per WEEKLY period = 650; net 600 → gap 50/wk
    const r = reconcileManagedRental({
      declaredGrossAmount: 650,
      declaredGrossFrequency: 'WEEKLY',
      netDisbursementAmount: 600,
    });
    expect(r.disbursementFrequency).toBe('WEEKLY');
    expect(r.gap).toBeCloseTo(50, 9);
  });

  it('sub-materiality gaps do not fire ($4 < $5 floor; 0.3% < 1% floor)', () => {
    const dollars = reconcileManagedRental({ ...CANONICAL, netDisbursementAmount: 1296 }); // gap 4
    expect(dollars.material).toBe(false);
    const fraction = reconcileManagedRental({
      declaredGrossAmount: 2600, // 5,200/ft gross
      declaredGrossFrequency: 'WEEKLY',
      netDisbursementAmount: 5185, // gap 15 = 0.29% of 5,200
      disbursementFrequency: 'FORTNIGHTLY',
    });
    expect(fraction.material).toBe(false);
  });

  it('an over-disbursement (net > gross) is a negative gap, never material', () => {
    const r = reconcileManagedRental({ ...CANONICAL, netDisbursementAmount: 1400 });
    expect(r.gap).toBeCloseTo(-100, 9);
    expect(r.material).toBe(false);
  });

  it('anomaly semantics: $450 gap vs $200 baseline (tol 20%) → excess $250; $210 stays silent', () => {
    const anomalous = reconcileManagedRental({
      ...CANONICAL,
      netDisbursementAmount: 850,
      rule: { baselineGapAmount: 200, tolerancePct: 0.2 },
    });
    expect(anomalous.anomaly).toBe(true);
    expect(anomalous.anomalyExcess).toBeCloseTo(250, 9);

    const silent = reconcileManagedRental({
      ...CANONICAL,
      netDisbursementAmount: 1090,
      rule: { baselineGapAmount: 200, tolerancePct: 0.2 },
    });
    expect(silent.anomaly).toBe(false);
    expect(silent.anomalyExcess).toBe(0);

    const dec = reconcileManagedRentalDecimal({
      ...CANONICAL,
      netDisbursementAmount: 850,
      rule: { baselineGapAmount: 200, tolerancePct: 0.2 },
    });
    expect(dec.anomaly).toBe(true);
    expect(Number(dec.anomalyExcess.toString())).toBeCloseTo(250, 9);
  });
});

describe('the derived expense IS the tax wiring — gross unchanged, gap deducted', () => {
  const ctx = {
    userId: 'u1',
    ownerEntityId: 'le1',
    incomeStreamId: 'i-rent',
    propertyId: 'p1',
    managingAgentName: 'Ray White',
  };

  it('buildDerivedAgentCostExpense → deductible, property-linked, recurring at disbursement cadence', () => {
    const r = reconcileManagedRental(CANONICAL);
    const row = buildDerivedAgentCostExpense(ctx, r);
    expect(row).toMatchObject({
      category: 'PROPERTY_MANAGEMENT',
      amount: 200,
      frequency: 'FORTNIGHTLY',
      isTaxDeductible: true,
      isRecurring: true,
      derived: true,
      derivedSource: 'RECONCILIATION',
      itemised: false,
      derivedFromIncomeId: 'i-rent',
      propertyId: 'p1',
    });
  });

  it('anomaly excess builds a ONE-OFF row (counted once — MON-037 semantics)', () => {
    const r = reconcileManagedRental({
      ...CANONICAL,
      netDisbursementAmount: 850,
      rule: { baselineGapAmount: 200, tolerancePct: 0.2 },
    });
    const row = buildAnomalyExcessExpense(ctx, r);
    expect(row.amount).toBeCloseTo(250, 9);
    expect(row.isRecurring).toBe(false);
    expect(row.derived).toBe(true);
  });

  it('flows through the CANONICAL tax position: rental income 33,800 gross, deduction 5,200 — both engines', () => {
    // The full path the derived row takes in prod: an Income row (declared
    // gross, MANAGED) + the derived PROPERTY_MANAGEMENT Expense row →
    // calculateTaxPosition. Gross income must be UNCHANGED by the
    // reconciliation; the gap arrives ONLY as a deduction.
    const reconciliation = reconcileManagedRental(CANONICAL);
    const derived = buildDerivedAgentCostExpense(ctx, reconciliation);

    const input = {
      incomes: [
        { id: 'i-rent', name: 'Rent — 12 Hilltop Rd', type: 'RENTAL', amount: 650, frequency: 'WEEKLY' },
      ],
      expenses: [
        {
          id: 'e-derived',
          name: derived.name,
          category: derived.category,
          amount: derived.amount,
          frequency: derived.frequency,
          isTaxDeductible: derived.isTaxDeductible,
          isRecurring: derived.isRecurring,
          propertyId: derived.propertyId ?? undefined,
        },
      ],
      depreciations: [],
      superContributions: { concessional: 0, nonConcessional: 0 },
      financialYear: '2025-26',
    };

    const f = calculateTaxPosition(input);
    expect(f.income.rental).toBeCloseTo(650 * 52, 6); // 33,800 — gross UNCHANGED
    expect(f.deductions.property).toBeCloseTo(5200, 6); // 200 × 26
    expect(f.tax.taxableIncome).toBeCloseTo(33800 - 5200, 6); // 28,600 = net received

    const d = calculateTaxPositionDecimal(input);
    expect(Number(d.income.rental.toString())).toBeCloseTo(f.income.rental, 6);
    expect(Number(d.deductions.property.toString())).toBeCloseTo(f.deductions.property, 6);
  });
});
