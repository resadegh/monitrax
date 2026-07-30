/**
 * MON-131 Tranche 1 (MON-128) — Ring 0/2: the banked-income engine stack
 * (D17 / D20) and the PERMANENT invariants from build brief §3 (amended).
 *
 * COVERAGE — stated precisely (§22.2.4): proves, on synthetic rows,
 *  (1) the FACT hierarchy (actual net pay > NET-entered > derived schedule);
 *  (2) the one-off gate — `isRecurring === false` contributes 0 to every
 *      run-rate on every migrated source (MON-128's root defect);
 *  (3) sources sum to banked income (the L2 invariant);
 *  (4) banked ≤ gross, Float and Decimal;
 *  (5) gross − banked ≡ payg + help + salarySacrifice on the FACT paths
 *      (the identity that fails by $1,196.70/yr today — VR-042 V3);
 *  (6) annual ≡ monthly × 12 on the projection;
 *  (7) HELP undetermined states (flag null → flagged, never asserted);
 *  (8) tenanted-residence (PropertyType.RENTAL) income rows are EXCLUDED
 *      and flagged (D26(b)/X6);
 *  (9) Float ≡ Decimal parity on the aggregate.
 * Does NOT prove: production wiring (T1-B flip + relay compare), rental
 * ACTUALS resolution beyond delegation (owned by propertyCashflow's own
 * suite), or any real-data value (Ring 3).
 */
import { describe, it, expect } from 'vitest';
import { TAX_YEAR_2026_27 } from '@/lib/tax-engine/config/taxYearConfig';
import { computeSalaryBanked, computeSalaryBankedDecimal } from '@/lib/income/banked/salaryBanked';
import { computeRentalBanked } from '@/lib/income/banked/rentalBanked';
import { computeReceivedBanked } from '@/lib/income/banked/receivedBanked';
import {
  buildBankedIncome,
  buildBankedIncomeDecimal,
  projectAggregation,
  type BankedIncomeInput,
} from '@/lib/income/banked/aggregator';
import type { BankedIncomeRow, BankedContext } from '@/lib/income/banked/types';

const ctx: BankedContext = { config: TAX_YEAR_2026_27, repaymentIncome: null };
const ctxWithRi: BankedContext = { config: TAX_YEAR_2026_27, repaymentIncome: 100000 };

const salaryNet: BankedIncomeRow = {
  id: 'inc-net',
  type: 'SALARY',
  amount: 217587.5, // ANNUAL frequency → banked FACT
  frequency: 'ANNUAL',
  salaryType: 'NET',
  grossAmount: 227519.5, // stored already-annual
  netAmount: 217587.5,
  paygWithholding: 11128.7, // deliberately INCONSISTENT with gross − net (9,932)
  isRecurring: true,
};

function baseInput(income: BankedIncomeRow[], overrides: Partial<BankedIncomeInput> = {}): BankedIncomeInput {
  return {
    income,
    properties: [],
    derivedAgentExpenses: [],
    transactions: [],
    ctx,
    ...overrides,
  };
}

describe('salary banked — the FACT hierarchy (D17)', () => {
  it('NET-entered: banked = the entered amount; withholding = gross − banked BY CONSTRUCTION (stored paygWithholding column retired)', () => {
    const r = computeSalaryBanked(salaryNet, ctx);
    expect(r.basis).toBe('FACT_NET_ENTERED');
    expect(r.bankedAnnual).toBe(217587.5);
    expect(r.grossAnnual).toBe(227519.5);
    // The identity the tranche restores: 227,519.50 − 217,587.50 = 9,932.00
    // (the APPLIED value — NOT the stored 11,128.70).
    expect(r.components.payg).toBeCloseTo(9932, 6);
  });

  it('actual net pay FACT wins over both the NET amount and any derivation', () => {
    const r = computeSalaryBanked(
      { ...salaryNet, actualNetPay: 18000, frequency: 'MONTHLY', amount: 18132.29 },
      ctx,
    );
    expect(r.basis).toBe('FACT_ACTUAL_NET_PAY');
    expect(r.bankedAnnual).toBeCloseTo(216000, 6); // 18,000 × 12 — row's OWN period (D33)
  });

  it('GROSS-entered derives from the FY schedule; salary sacrifice reduces the withholding base', () => {
    const gross: BankedIncomeRow = {
      id: 'inc-gross',
      type: 'SALARY',
      amount: 2000, // weekly
      frequency: 'WEEKLY',
      salaryType: 'GROSS',
      helpLoanDeclared: false,
    };
    const r = computeSalaryBanked(gross, ctx);
    expect(r.basis).toBe('DERIVED_SCHEDULE');
    // FY26-27 scale 2, weekly $2,000: x = 2000.99, band $1,282–$2,595
    // (a 0.32, b 181.7319): y = 0.32 × 2000.99 − 181.7319 = 458.5849 → $459/wk.
    expect(r.components.payg).toBe(459 * 52);
    expect(r.bankedAnnual).toBe(2000 * 52 - 459 * 52);

    // With $10,400/yr sacrifice: base drops to $1,800/wk → x = 1800.99,
    // same band: y = 0.32 × 1800.99 − 181.7319 = 394.5849 → $395/wk.
    const withSacrifice = computeSalaryBanked({ ...gross, salarySacrifice: 10400 }, ctx);
    expect(withSacrifice.components.payg).toBe(395 * 52);
    expect(withSacrifice.bankedAnnual).toBe(2000 * 52 - 10400 - 395 * 52);
  });

  it('HELP: declared=true consumes repayment income; null is UNDETERMINED (flagged, never asserted)', () => {
    const gross: BankedIncomeRow = {
      id: 'inc-help',
      type: 'SALARY',
      amount: 104000,
      frequency: 'ANNUAL',
      salaryType: 'GROSS',
      helpLoanDeclared: true,
    };
    // RI $100,000 → band 1: 0.15 × 30,472 = 4,570.80.
    const r = computeSalaryBanked(gross, ctxWithRi);
    expect(r.components.help).toBeCloseTo(4570.8, 6);

    const noRi = computeSalaryBanked(gross, ctx);
    expect(noRi.undetermined).toContain('helpWithholding');
    expect(noRi.flags).toContain('HELP_DECLARED_BUT_REPAYMENT_INCOME_UNAVAILABLE');

    const flagNull = computeSalaryBanked({ ...gross, helpLoanDeclared: null }, ctxWithRi);
    expect(flagNull.undetermined).toContain('helpLoanDeclared');
    expect(flagNull.flags).toContain('HELP_LOAN_UNDETERMINED');
    expect(flagNull.components.help).toBe(0); // employer withholds nothing without a declaration
  });

  it('a one-off salary row contributes 0 to every run-rate and its value is counted once', () => {
    const r = computeSalaryBanked({ ...salaryNet, isRecurring: false }, ctx);
    expect(r.bankedAnnual).toBe(0);
    expect(r.oneOffAmount).toBe(217587.5);
  });

  it('implausible FACT wedge is FLAGGED, never adjusted (the 9,932-vs-schedule signal)', () => {
    // $227.5K gross with a $9,932 wedge is far below the schedule's withholding
    // → the plausibility signal fires; banked stays the FACT.
    const r = computeSalaryBanked(salaryNet, ctx);
    expect(r.flags).toContain('WITHHOLDING_IMPLAUSIBLE');
    expect(r.plausibility?.divergent).toBe(true);
    expect(r.bankedAnnual).toBe(217587.5); // unchanged — FACT wins
  });

  it('Float ≡ Decimal on every basis', () => {
    for (const row of [
      salaryNet,
      { ...salaryNet, actualNetPay: 18000, frequency: 'MONTHLY' },
      { id: 'g', type: 'SALARY', amount: 2000, frequency: 'WEEKLY', salaryType: 'GROSS', helpLoanDeclared: false } as BankedIncomeRow,
    ]) {
      const f = computeSalaryBanked(row, ctx);
      const d = computeSalaryBankedDecimal(row, ctx);
      expect(d.basis).toBe(f.basis);
      expect(d.bankedAnnual.toNumber()).toBeCloseTo(f.bankedAnnual, 6);
      if (f.grossAnnual !== null) expect(d.grossAnnual?.toNumber()).toBeCloseTo(f.grossAnnual, 6);
    }
  });
});

describe('rental banked — type split + one-off gate (D26(b)/X6)', () => {
  it('a tenanted-residence property (PropertyType.RENTAL) produces NO rental income; rows are flagged', () => {
    const r = computeRentalBanked({
      properties: [{ id: 'p-tenanted', type: 'RENTAL' }],
      income: [
        { id: 'i-1', type: 'RENT', amount: 500, frequency: 'WEEKLY', propertyId: 'p-tenanted' },
      ],
      derivedAgentExpenses: [],
      transactions: [],
    });
    expect(r.bankedAnnual).toBe(0);
    expect(r.misattachedRows).toEqual([{ incomeId: 'i-1', propertyId: 'p-tenanted' }]);
    expect(r.flags).toContain('MISATTACHED_TENANTED_RESIDENCE');
  });

  it('owned property rental delegates to the canonical engine (declared fallback here)', () => {
    const r = computeRentalBanked({
      properties: [{ id: 'p-1', type: 'INVESTMENT' }],
      income: [{ id: 'i-1', type: 'RENTAL', amount: 2000, frequency: 'MONTHLY', propertyId: 'p-1' }],
      derivedAgentExpenses: [],
      transactions: [],
    });
    expect(r.perProperty).toHaveLength(1);
    expect(r.bankedAnnual).toBeCloseTo(24000, 6);
    expect(r.perProperty[0].usedActuals).toBe(false);
  });

  it('a one-off non-property rental receipt contributes 0 to the run-rate, counted once', () => {
    const r = computeRentalBanked({
      properties: [],
      income: [{ id: 'i-1', type: 'RENT', amount: 3000, frequency: 'MONTHLY', isRecurring: false }],
      derivedAgentExpenses: [],
      transactions: [],
    });
    expect(r.bankedAnnual).toBe(0);
    expect(r.oneOffAmount).toBe(3000);
  });
});

describe('received banked (INVESTMENT / OTHER) — cash only, gated', () => {
  it('one-off gate: isRecurring === false → 0 run-rate', () => {
    const r = computeReceivedBanked(
      { id: 'i-1', type: 'INVESTMENT', amount: 5000, frequency: 'QUARTERLY', isRecurring: false },
      'investment',
    );
    expect(r.bankedAnnual).toBe(0);
    expect(r.oneOffAmount).toBe(5000);
  });

  it('recurring investment income: gross ≡ banked (received as-is; franking NEVER added)', () => {
    const r = computeReceivedBanked(
      { id: 'i-1', type: 'INVESTMENT', amount: 1300, frequency: 'QUARTERLY' },
      'investment',
    );
    expect(r.bankedAnnual).toBeCloseTo(5200, 6);
    expect(r.grossAnnual).toBeCloseTo(5200, 6);
  });
});

describe('L2 aggregator — the permanent invariants (build brief §3)', () => {
  const mixed = baseInput(
    [
      salaryNet,
      { id: 'i-div', type: 'INVESTMENT', amount: 1300, frequency: 'QUARTERLY' },
      { id: 'i-other', type: 'OTHER', amount: 100, frequency: 'WEEKLY' },
      { id: 'i-oneoff', type: 'OTHER', amount: 9000, frequency: 'MONTHLY', isRecurring: false },
      { id: 'i-rent', type: 'RENTAL', amount: 2000, frequency: 'MONTHLY', propertyId: 'p-1' },
    ],
    { properties: [{ id: 'p-1', type: 'INVESTMENT' }] },
  );

  it('sources sum to banked income — the L2 invariant', () => {
    const r = buildBankedIncome(mixed);
    const s = r.annual.bySource;
    expect(s.salary.banked + s.rental.banked + s.investment.banked + s.other.banked).toBeCloseTo(
      r.annual.banked,
      8,
    );
  });

  it('banked ≤ gross, always (Float and Decimal)', () => {
    const f = buildBankedIncome(mixed);
    expect(f.annual.banked).toBeLessThanOrEqual(f.annual.gross);
    const d = buildBankedIncomeDecimal(mixed);
    expect(d.annual.banked.lte(d.annual.gross)).toBe(true);
  });

  it('gross − banked ≡ payg + help + salarySacrifice (exact, by construction)', () => {
    const r = buildBankedIncome(mixed);
    expect(r.annual.gross - r.annual.banked).toBeCloseTo(r.annual.withholding.total, 8);
  });

  it('one-off rows appear ONLY in oneOff — never in any run-rate', () => {
    const r = buildBankedIncome(mixed);
    expect(r.oneOff.total).toBe(9000);
    expect(r.oneOff.count).toBe(1);
    const withoutOneOff = buildBankedIncome(
      baseInput(mixed.income.filter((i) => i.id !== 'i-oneoff'), { properties: mixed.properties }),
    );
    expect(r.annual.banked).toBeCloseTo(withoutOneOff.annual.banked, 8);
  });

  it('projection: annual ≡ monthly × 12 on every field, and netTotal carries banked', () => {
    const r = buildBankedIncome(mixed);
    const monthly = projectAggregation(r, 'all', 'monthly');
    const annual = projectAggregation(r, 'all', 'annual');
    expect(annual.grossTotal).toBeCloseTo(monthly.grossTotal * 12, 6);
    expect(annual.netTotal).toBeCloseTo(monthly.netTotal * 12, 6);
    expect(annual.paygWithholding).toBeCloseTo(monthly.paygWithholding * 12, 6);
    expect(annual.netTotal).toBeCloseTo(r.annual.banked, 8);
    // identity target (VR-042 V2): the projection's gross IS the aggregate gross.
    expect(annual.grossTotal).toBeCloseTo(r.annual.gross, 8);
  });

  it('subset projections partition: primary + secondary ≡ all', () => {
    const r = buildBankedIncome(mixed);
    const all = projectAggregation(r, 'all', 'annual');
    const primary = projectAggregation(r, 'primary', 'annual');
    const secondary = projectAggregation(r, 'secondary', 'annual');
    expect(primary.netTotal + secondary.netTotal).toBeCloseTo(all.netTotal, 8);
    expect(primary.grossTotal + secondary.grossTotal).toBeCloseTo(all.grossTotal, 8);
  });

  it('Float ≡ Decimal on the aggregate', () => {
    const f = buildBankedIncome(mixed);
    const d = buildBankedIncomeDecimal(mixed);
    expect(d.annual.banked.toNumber()).toBeCloseTo(f.annual.banked, 6);
    expect(d.annual.gross.toNumber()).toBeCloseTo(f.annual.gross, 6);
    expect(d.annual.withholding.total.toNumber()).toBeCloseTo(f.annual.withholding.total, 6);
    expect(d.oneOff.total.toNumber()).toBe(f.oneOff.total);
  });
});
