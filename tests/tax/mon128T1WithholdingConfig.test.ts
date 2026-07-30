/**
 * MON-131 Tranche 1 (MON-128) — Ring 0: PAYG schedule-in-config (D35/X1) +
 * HELP/STSL marginal system with the top-band cliff (D42 C2/C3).
 *
 * COVERAGE — stated precisely (§22.2.4): these tests prove
 *  (1) the FY26-27 Schedule 1 coefficients produce the hand-computed ATO
 *      worked examples (formula y = a·x − b, x = floor(weekly) + 0.99,
 *      whole-dollar rounding) — Float and Decimal identically;
 *  (2) the LEGACY no-config default is byte-identical to the pre-T1
 *      hardcoded FY24-26 behaviour (the T1-A moves-nothing guarantee at the
 *      engine boundary);
 *  (3) a config without a schedule REFUSES (never borrows another FY);
 *  (4) the HELP bands + the $186,050→$186,051 cliff both directions, the
 *      repayment-income add-backs, and UNDETERMINED on unconfigured FYs.
 * They do NOT prove any production surface renders these values (that is the
 * T1-B flip + Ring 3), and they do NOT cover the fractional-weekly band-gap
 * defect (legacy behaviour deliberately preserved in T1-A; registered as its
 * own issue, fixed + declared at the flip).
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePAYG,
  calculatePAYGDecimal,
  PaygScheduleUnavailableError,
} from '@/lib/tax-engine/core/paygCalculator';
import {
  calculateHelpRepayment,
  calculateHelpRepaymentDecimal,
} from '@/lib/tax-engine/core/helpRepaymentCalculator';
import {
  computeRepaymentIncome,
  computeRepaymentIncomeDecimal,
} from '@/lib/tax-engine/position/repaymentIncome';
import {
  TAX_YEAR_2024_25,
  TAX_YEAR_2025_26,
  TAX_YEAR_2026_27,
  TAX_YEAR_2023_24,
} from '@/lib/tax-engine/config/taxYearConfig';

describe('PAYG Schedule 1 — FY2026-27 coefficients from config (D35/X1)', () => {
  // Hand-computed from the ATO formula (§19.2 worked examples), verified
  // 2026-07-30 against the ATO coefficients page + one independent secondary:
  //   weekly $1,000.00 → x = 1000.99, band $865–$1,281 (a 0.3227, b 185.1935)
  //     y = 0.3227 × 1000.99 − 185.1935 = 137.825973 → $138/wk → $7,176/yr
  it('weekly $1,000 withholds $138/wk under FY26-27 scale 2', () => {
    const r = calculatePAYG(
      { grossIncome: 1000, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
      TAX_YEAR_2026_27,
    );
    expect(r.weeklyWithholding).toBe(138);
    expect(r.annualWithholding).toBe(138 * 52);
  });

  //   weekly $500 → x = 500.99, band $362–$537 (a 0.15, b 54.3462)
  //     y = 0.15 × 500.99 − 54.3462 = 20.80235 → $21/wk
  it('weekly $500 withholds $21/wk under FY26-27 scale 2 (15% band)', () => {
    const r = calculatePAYG(
      { grossIncome: 500, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
      TAX_YEAR_2026_27,
    );
    expect(r.weeklyWithholding).toBe(21);
  });

  it('weekly $300 (below the $362 threshold) withholds nil', () => {
    const r = calculatePAYG(
      { grossIncome: 300, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
      TAX_YEAR_2026_27,
    );
    expect(r.weeklyWithholding).toBe(0);
  });

  //   weekly $4,000 → x = 4000.99, top band (a 0.47, b 655.7704)
  //     y = 0.47 × 4000.99 − 655.7704 = 1224.6949 → $1,225/wk
  it('weekly $4,000 withholds $1,225/wk under FY26-27 scale 2 (top band)', () => {
    const r = calculatePAYG(
      { grossIncome: 4000, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
      TAX_YEAR_2026_27,
    );
    expect(r.weeklyWithholding).toBe(1225);
  });

  //   scale 1 (no TFT), weekly $1,000 → band $932–$2,245 (a 0.32, b 71.6508)
  //     y = 0.32 × 1000.99 − 71.6508 = 248.6660 → $249/wk
  it('weekly $1,000 scale 1 (no tax-free threshold) withholds $249/wk', () => {
    const r = calculatePAYG(
      { grossIncome: 1000, frequency: 'WEEKLY', hasTaxFreeThreshold: false },
      TAX_YEAR_2026_27,
    );
    expect(r.weeklyWithholding).toBe(249);
  });

  it('FY26-27 withholds LESS than FY24-26 at the same earnings (the 15% band cut)', () => {
    const fy2627 = calculatePAYG(
      { grossIncome: 1000, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
      TAX_YEAR_2026_27,
    );
    const fy2425 = calculatePAYG(
      { grossIncome: 1000, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
      TAX_YEAR_2024_25,
    );
    expect(fy2627.weeklyWithholding).toBeLessThan(fy2425.weeklyWithholding);
    // FY24-26 band $866–$2,596 (a 0.3227, b 180.0385):
    //   y = 0.3227 × 1000.99 − 180.0385 = 142.980973 → $143/wk
    expect(fy2425.weeklyWithholding).toBe(143);
  });

  it('LEGACY no-config default is byte-identical to the FY24-26 schedule (T1-A moves-nothing)', () => {
    for (const weekly of [300, 500, 700, 1000, 2000, 4000]) {
      const legacy = calculatePAYG({ grossIncome: weekly, frequency: 'WEEKLY', hasTaxFreeThreshold: true });
      const explicit = calculatePAYG(
        { grossIncome: weekly, frequency: 'WEEKLY', hasTaxFreeThreshold: true },
        TAX_YEAR_2024_25,
      );
      expect(legacy.weeklyWithholding).toBe(explicit.weeklyWithholding);
    }
    // FY25-26 carries the SAME schedule (the ATO did not reissue for 25-26).
    expect(TAX_YEAR_2025_26.paygSchedule).toBe(TAX_YEAR_2024_25.paygSchedule);
  });

  it('a config without a schedule REFUSES — never borrows another FY (D35)', () => {
    expect(TAX_YEAR_2023_24.paygSchedule).toBeUndefined();
    expect(() =>
      calculatePAYG({ grossIncome: 1000, frequency: 'WEEKLY' }, TAX_YEAR_2023_24),
    ).toThrow(PaygScheduleUnavailableError);
  });

  it('Float ≡ Decimal on every worked example (regulatory whole-dollar rounding)', () => {
    for (const weekly of [300, 500, 1000, 1500, 2500, 4000]) {
      for (const config of [TAX_YEAR_2024_25, TAX_YEAR_2026_27]) {
        const f = calculatePAYG({ grossIncome: weekly, frequency: 'WEEKLY', hasTaxFreeThreshold: true }, config);
        const d = calculatePAYGDecimal({ grossIncome: weekly, frequency: 'WEEKLY', hasTaxFreeThreshold: true }, config);
        expect(d.weeklyWithholding.toNumber()).toBe(f.weeklyWithholding);
        expect(d.annualWithholding.toNumber()).toBe(f.annualWithholding);
      }
    }
  });
});

describe('HELP/STSL FY2026-27 — marginal bands + the top-band CLIFF (D42 C2)', () => {
  const cfg = TAX_YEAR_2026_27;

  it('nil at and below the $69,528 threshold', () => {
    for (const ri of [0, 50000, 69528]) {
      const r = calculateHelpRepayment(ri, cfg);
      expect(r.status).toBe('COMPUTED');
      if (r.status === 'COMPUTED') {
        expect(r.amount).toBe(0);
        expect(r.band).toBe('NIL');
      }
    }
  });

  it('band 1: 15c per $1 over $69,528 (worked: $100,000 → $4,570.80)', () => {
    // 0.15 × (100,000 − 69,528) = 0.15 × 30,472 = 4,570.80
    const r = calculateHelpRepayment(100000, cfg);
    expect(r.status).toBe('COMPUTED');
    if (r.status === 'COMPUTED') {
      expect(r.amount).toBeCloseTo(4570.8, 6);
      expect(r.band).toBe('MARGINAL_1');
      expect(r.basis).toBe('MARGINAL');
    }
  });

  it('band 2: $9,028 + 17c per $1 over $129,717 (worked: $150,000 → $12,476.11)', () => {
    // 9,028 + 0.17 × (150,000 − 129,717) = 9,028 + 3,448.11 = 12,476.11
    const r = calculateHelpRepayment(150000, cfg);
    expect(r.status).toBe('COMPUTED');
    if (r.status === 'COMPUTED') {
      expect(r.amount).toBeCloseTo(12476.11, 6);
      expect(r.band).toBe('MARGINAL_2');
    }
  });

  it('THE CLIFF, both directions: $186,050 is marginal; $186,051 is 10% of the WHOLE', () => {
    // At the boundary: 9,028 + 0.17 × (186,050 − 129,717) = 9,028 + 9,576.61 = 18,604.61
    const atBoundary = calculateHelpRepayment(186050, cfg);
    expect(atBoundary.status).toBe('COMPUTED');
    if (atBoundary.status === 'COMPUTED') {
      expect(atBoundary.amount).toBeCloseTo(18604.61, 6);
      expect(atBoundary.band).toBe('MARGINAL_2');
      expect(atBoundary.basis).toBe('MARGINAL');
    }
    // One dollar over: 10% × 186,051 = 18,605.10 — of the TOTAL, not the excess.
    const overBoundary = calculateHelpRepayment(186051, cfg);
    expect(overBoundary.status).toBe('COMPUTED');
    if (overBoundary.status === 'COMPUTED') {
      expect(overBoundary.amount).toBeCloseTo(18605.1, 6);
      expect(overBoundary.band).toBe('TOP_CLIFF');
      expect(overBoundary.basis).toBe('TOTAL_INCOME');
    }
    // Well above: $250,000 → $25,000 (NOT 9,028 + 17% of the excess = $29,476.11).
    const high = calculateHelpRepayment(250000, cfg);
    if (high.status === 'COMPUTED') expect(high.amount).toBeCloseTo(25000, 6);
  });

  it('UNDETERMINED on an FY without verified parameters — never borrowed', () => {
    const r = calculateHelpRepayment(100000, TAX_YEAR_2024_25);
    expect(r.status).toBe('UNDETERMINED');
  });

  it('Float ≡ Decimal across bands and the cliff', () => {
    for (const ri of [0, 69528, 69529, 100000, 129717, 129718, 186050, 186051, 250000]) {
      const f = calculateHelpRepayment(ri, cfg);
      const d = calculateHelpRepaymentDecimal(ri, cfg);
      expect(d.status).toBe(f.status);
      if (f.status === 'COMPUTED' && d.status === 'COMPUTED') {
        expect(d.amount.toNumber()).toBeCloseTo(f.amount, 8);
        expect(d.band).toBe(f.band);
      }
    }
  });
});

describe('repayment income (D42 C3) — the add-backs, FHSS exclusion, honesty labels', () => {
  it('sums the five components with the FHSS exclusion', () => {
    const r = computeRepaymentIncome({
      taxableIncome: 145426,
      fhssReleasedAmounts: 10000,
      reportableFringeBenefits: 5000,
      totalNetInvestmentLoss: 26899, // net rental losses ADD BACK (raises RI)
      reportableSuperContributions: 12000,
      exemptForeignEmploymentIncome: 0,
    });
    expect(r.repaymentIncome).toBe(145426 - 10000 + 5000 + 26899 + 12000 + 0);
    expect(r.complete).toBe(true);
  });

  it('omitted components are labelled DEFAULT_ZERO and the result is NOT complete', () => {
    const r = computeRepaymentIncome({ taxableIncome: 145426, totalNetInvestmentLoss: 26899 });
    expect(r.repaymentIncome).toBe(145426 + 26899);
    expect(r.complete).toBe(false);
    expect(r.componentBasis.reportableFringeBenefits).toBe('DEFAULT_ZERO');
    expect(r.componentBasis.totalNetInvestmentLoss).toBe('PROVIDED');
  });

  it('the add-back can push repayment income over the cliff when taxable income is under it', () => {
    // Taxable $170,000 (< $186,050) + $20,000 net investment loss → RI $190,000 → cliff.
    const ri = computeRepaymentIncome({ taxableIncome: 170000, totalNetInvestmentLoss: 20000 });
    const help = calculateHelpRepayment(ri.repaymentIncome, TAX_YEAR_2026_27);
    expect(help.status).toBe('COMPUTED');
    if (help.status === 'COMPUTED') {
      expect(help.band).toBe('TOP_CLIFF');
      expect(help.amount).toBeCloseTo(19000, 6); // 10% of the WHOLE $190,000
    }
  });

  it('Float ≡ Decimal', () => {
    const c = { taxableIncome: 145426.55, totalNetInvestmentLoss: 26899.13, reportableSuperContributions: 1200.4 };
    const f = computeRepaymentIncome(c);
    const d = computeRepaymentIncomeDecimal(c);
    expect(d.repaymentIncome.toNumber()).toBeCloseTo(f.repaymentIncome, 8);
    expect(d.complete).toBe(f.complete);
  });
});
