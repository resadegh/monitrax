/**
 * R2 — Golden-household MANAGED RENTAL fixture (Phase 59 / MON-079,
 * PHASE_59_MANAGED_RENTAL_INCOME.md §7).
 *
 * The spec's canonical managed rental locked end-to-end: gross $650/wk
 * declared, $1,100/ft disbursed by the agent. Proves, on both engines:
 *   1. GROSS-INCOME INTEGRITY — assessable rental income is the declared
 *      gross ($33,800/yr), NEVER the net (28,600) and NEVER reduced by the
 *      reconciliation.
 *   2. THE GAP IS A DEDUCTION — the confirmed derived expense ($200/ft →
 *      $5,200/yr) lands in deductions.property; taxable = 28,600 = exactly
 *      the net the bank actually received, annualised. No double-count.
 *   3. D4 fires on the un-modelled stream (deposits below gross, no agent
 *      cost captured) and goes SILENT once the derived expense exists.
 *   4. The anomaly month (a $450 gap vs the $200 baseline) yields a ONE-OFF
 *      excess of $250, counted once (MON-037 semantics).
 *
 * These fixtures are ADDITIVE — they deliberately do NOT touch GOLDEN_DB
 * (whose EXPECTED values many Ring-2 suites pin).
 */
import { describe, it, expect } from 'vitest';
import {
  reconcileManagedRental,
  buildDerivedAgentCostExpense,
  buildAnomalyExcessExpense,
} from '../../lib/calculations/rentalReconciliation';
import { detectRentGap } from '../../lib/intake/detectors';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '../../lib/tax-engine/position/taxPositionCalculator';

const NO_SUPER = { concessional: 0, nonConcessional: 0 };
const FY = '2025-26';

/** The spec §3/§7 managed rental: $650/wk gross, $1,100/ft net. */
const STREAM = {
  id: 'i-managed-rent',
  name: 'Rent — 12 Hilltop Rd',
  amount: 650,
  frequency: 'WEEKLY',
  propertyId: 'p-hilltop',
};

/** Six fortnightly agent disbursements, exactly 14 days apart. */
const DISBURSEMENT_DATES = Array.from(
  { length: 6 },
  (_, i) => new Date(Date.UTC(2026, 0, 2 + i * 14)),
);

const CTX = {
  userId: 'u-golden',
  ownerEntityId: 'le-golden',
  incomeStreamId: STREAM.id,
  propertyId: STREAM.propertyId,
  managingAgentName: 'Ray White',
};

describe('R2 · managed rental — gross-income integrity + the gap as a deduction', () => {
  const reconciliation = reconcileManagedRental({
    declaredGrossAmount: STREAM.amount,
    declaredGrossFrequency: 'WEEKLY',
    netDisbursementAmount: 1100,
    disbursementDates: DISBURSEMENT_DATES,
  });

  it('the engine resolves the cadence from evidence and lands the canonical numbers', () => {
    expect(reconciliation.disbursementFrequency).toBe('FORTNIGHTLY');
    expect(reconciliation.grossPerDisbursementPeriod).toBeCloseTo(1300, 9);
    expect(reconciliation.gap).toBeCloseTo(200, 9);
    expect(reconciliation.gapAnnual).toBeCloseTo(5200, 9);
    expect(reconciliation.material).toBe(true);
  });

  it('tax position (both engines): gross 33,800 UNCHANGED · deduction 5,200 · taxable 28,600 = the net received', () => {
    const derived = buildDerivedAgentCostExpense(CTX, reconciliation);
    const input = {
      incomes: [
        { id: STREAM.id, name: STREAM.name, type: 'RENTAL', amount: STREAM.amount, frequency: STREAM.frequency, propertyId: STREAM.propertyId },
      ],
      expenses: [
        {
          id: 'e-derived-golden',
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
      superContributions: NO_SUPER,
      financialYear: FY,
    };

    const f = calculateTaxPosition(input);
    expect(f.income.rental).toBe(650 * 52); // 33,800 — the DECLARED GROSS
    expect(f.deductions.property).toBeCloseTo(5200, 6); // 200 × 26
    expect(f.tax.taxableIncome).toBeCloseTo(28_600, 6); // = 1,100 × 26

    const d = calculateTaxPositionDecimal(input);
    expect(Number(d.income.rental.toString())).toBeCloseTo(f.income.rental, 6);
    expect(Number(d.deductions.property.toString())).toBeCloseTo(f.deductions.property, 6);
    expect(Number(d.tax.taxableIncome.toString())).toBeCloseTo(f.tax.taxableIncome, 6);
  });

  it('never a double-count: without the confirm, gross stays 33,800 and NO deduction exists', () => {
    const input = {
      incomes: [
        { id: STREAM.id, name: STREAM.name, type: 'RENTAL', amount: STREAM.amount, frequency: STREAM.frequency, propertyId: STREAM.propertyId },
      ],
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    };
    const f = calculateTaxPosition(input);
    expect(f.income.rental).toBe(33_800);
    expect(f.deductions.property).toBe(0);
  });
});

describe('R2 · D4 rent-gap detector on the golden stream', () => {
  const disbursements = DISBURSEMENT_DATES.map((date) => ({ date, amount: 1100 }));

  it('fires on the un-modelled stream: deposits $200/ft below gross, nothing captured', () => {
    const flag = detectRentGap({
      incomeType: 'RENTAL',
      isRecurring: true,
      declaredAmount: STREAM.amount,
      declaredFrequency: STREAM.frequency,
      transactions: disbursements,
      hasAgentCostExpense: false,
    });
    expect(flag).not.toBeNull();
    expect(flag!.grossPerPeriod).toBeCloseTo(1300, 9);
    expect(flag!.netPerPeriod).toBeCloseTo(1100, 9);
    expect(flag!.gapPerPeriod).toBeCloseTo(200, 9);
    expect(flag!.gapAnnual).toBeCloseTo(5200, 9);
    expect(flag!.disbursementFrequency).toBe('FORTNIGHTLY');
  });

  it('goes silent once the derived agent-cost expense exists (never nags a captured stream)', () => {
    expect(
      detectRentGap({
        incomeType: 'RENTAL',
        isRecurring: true,
        declaredAmount: STREAM.amount,
        declaredFrequency: STREAM.frequency,
        transactions: disbursements,
        hasAgentCostExpense: true,
      }),
    ).toBeNull();
  });

  it('is conservative: never fires on non-rental, one-offs, a lone deposit, or a direct-equivalent stream', () => {
    const base = {
      incomeType: 'RENTAL',
      isRecurring: true,
      declaredAmount: STREAM.amount,
      declaredFrequency: STREAM.frequency,
      transactions: disbursements,
      hasAgentCostExpense: false,
    };
    expect(detectRentGap({ ...base, incomeType: 'SALARY' })).toBeNull();
    expect(detectRentGap({ ...base, isRecurring: false })).toBeNull();
    expect(detectRentGap({ ...base, transactions: disbursements.slice(0, 1) })).toBeNull();
    // Direct-equivalent: deposits match the normalised gross → no gap.
    expect(
      detectRentGap({
        ...base,
        transactions: DISBURSEMENT_DATES.map((date) => ({ date, amount: 1300 })),
      }),
    ).toBeNull();
  });

  it('uses the median deposit — one anomalous repair month must not skew the base', () => {
    const withRepairMonth = [
      ...DISBURSEMENT_DATES.slice(0, 5).map((date) => ({ date, amount: 1100 })),
      { date: DISBURSEMENT_DATES[5], amount: 850 }, // the repair fortnight
    ];
    const flag = detectRentGap({
      incomeType: 'RENTAL',
      isRecurring: true,
      declaredAmount: STREAM.amount,
      declaredFrequency: STREAM.frequency,
      transactions: withRepairMonth,
      hasAgentCostExpense: false,
    });
    expect(flag!.netPerPeriod).toBeCloseTo(1100, 9); // median, not mean
    expect(flag!.gapPerPeriod).toBeCloseTo(200, 9);
  });
});

describe('R2 · the anomaly month (learn-once rule in force)', () => {
  it('a $450 gap vs the $200 baseline re-confirms with a $250 one-off excess, counted once', () => {
    const anomalous = reconcileManagedRental({
      declaredGrossAmount: STREAM.amount,
      declaredGrossFrequency: 'WEEKLY',
      netDisbursementAmount: 850,
      disbursementDates: DISBURSEMENT_DATES,
      rule: { baselineGapAmount: 200, tolerancePct: 0.2 },
    });
    expect(anomalous.anomaly).toBe(true);
    expect(anomalous.anomalyExcess).toBeCloseTo(250, 9);

    const excessRow = buildAnomalyExcessExpense(CTX, anomalous);
    expect(excessRow.isRecurring).toBe(false);

    // Counted ONCE in the tax position (never ×26): baseline 5,200 + 250.
    const input = {
      incomes: [
        { id: STREAM.id, name: STREAM.name, type: 'RENTAL', amount: STREAM.amount, frequency: STREAM.frequency, propertyId: STREAM.propertyId },
      ],
      expenses: [
        { id: 'e-baseline', name: 'Agent management & costs', category: 'PROPERTY_MANAGEMENT', amount: 200, frequency: 'FORTNIGHTLY', isTaxDeductible: true, isRecurring: true, propertyId: STREAM.propertyId },
        { id: 'e-excess', name: excessRow.name, category: excessRow.category, amount: excessRow.amount, frequency: excessRow.frequency, isTaxDeductible: true, isRecurring: excessRow.isRecurring, propertyId: STREAM.propertyId },
      ],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    };
    const f = calculateTaxPosition(input);
    expect(f.deductions.property).toBeCloseTo(5200 + 250, 6);
    const d = calculateTaxPositionDecimal(input);
    expect(Number(d.deductions.property.toString())).toBeCloseTo(5450, 6);
  });
});
