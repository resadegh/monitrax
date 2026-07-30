/**
 * MON-131 Tranche 1 (MON-128 / D17 / D42 C2-C3) — HELP/STSL compulsory
 * repayment calculator, marginal system (in force from 1 Jul 2025; FY2026-27
 * parameters verified 2026-07-30).
 *
 * THE one producer of the study-loan repayment estimate. Parameters live in
 * `TaxYearConfig.helpRepayment` (taxYearConfig.ts — D35 discipline: config,
 * never engine-local constants). A config without `helpRepayment` returns
 * UNDETERMINED — never a borrowed FY, never zero-as-guess.
 *
 * The structure (ATO, study-and-training-support-loans rates page, FY26-27):
 *   - repayment income ≤ $69,528            → nil
 *   - $69,529 – $129,717                    → 15c per $1 over $69,528
 *   - $129,718 – $186,050                   → $9,028 + 17c per $1 over $129,717
 *   - $186,051 and over                     → **10% of TOTAL repayment income**
 *
 * The top band is a CLIFF on the WHOLE repayment income (D42 C2) — it is NOT
 * a marginal rate on the excess. Coded as `topRateOfTotal × repaymentIncome`.
 *
 * BASIS NOTE (recorded per the salary-take-home contract discipline): this is
 * the ASSESSMENT-basis annual repayment estimate — computed on repayment
 * income (with the C3 add-backs), per MON-131_BUILD_SPECIFICATION §4 T1 (X2:
 * rental → repayment income → HELP band → salary). Employer payroll STSL
 * withholding uses per-period schedule tables on salary earnings alone; the
 * two converge at assessment. The banked-salary engine consumes THIS quantity
 * as the derived HELP component; a payslip's actual net pay (FACT) always
 * wins over any derivation (D17).
 *
 * Consumed by: lib/income/banked/salaryBanked.ts (T1).
 */

import { TaxYearConfig } from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

export type HelpRepaymentBand = 'NIL' | 'MARGINAL_1' | 'MARGINAL_2' | 'TOP_CLIFF';

export interface HelpRepaymentResult {
  status: 'COMPUTED';
  /** Annual compulsory repayment in dollars. */
  amount: number;
  band: HelpRepaymentBand;
  /** 'MARGINAL' = rate on the excess; 'TOTAL_INCOME' = the top-band cliff. */
  basis: 'NONE' | 'MARGINAL' | 'TOTAL_INCOME';
}

export interface HelpRepaymentUndetermined {
  status: 'UNDETERMINED';
  reason: string;
}

/**
 * Compute the annual HELP/STSL compulsory repayment for a repayment income.
 * Returns UNDETERMINED (never a guess) when the FY's parameters are not
 * configured or the repayment income itself is not establishable.
 */
export function calculateHelpRepayment(
  repaymentIncome: number,
  config: TaxYearConfig,
): HelpRepaymentResult | HelpRepaymentUndetermined {
  const params = config.helpRepayment;
  if (!params) {
    return {
      status: 'UNDETERMINED',
      reason: `HELP/STSL repayment parameters are not configured for FY ${config.financialYear}`,
    };
  }
  if (!Number.isFinite(repaymentIncome)) {
    return { status: 'UNDETERMINED', reason: 'repayment income is not a finite number' };
  }

  // Top band FIRST and as a cliff: strictly above the threshold, the rate
  // applies to the WHOLE repayment income (D42 C2).
  if (repaymentIncome > params.topThreshold) {
    return {
      status: 'COMPUTED',
      amount: params.topRateOfTotal * repaymentIncome,
      band: 'TOP_CLIFF',
      basis: 'TOTAL_INCOME',
    };
  }

  if (repaymentIncome <= params.minThreshold) {
    return { status: 'COMPUTED', amount: 0, band: 'NIL', basis: 'NONE' };
  }

  for (let i = 0; i < params.bands.length; i++) {
    const band = params.bands[i];
    if (repaymentIncome <= band.upTo) {
      return {
        status: 'COMPUTED',
        amount: band.base + band.rate * (repaymentIncome - band.over),
        band: i === 0 ? 'MARGINAL_1' : 'MARGINAL_2',
        basis: 'MARGINAL',
      };
    }
  }

  // Unreachable when config is well-formed (bands cover minThreshold..topThreshold).
  return {
    status: 'UNDETERMINED',
    reason: `helpRepayment config for FY ${config.financialYear} has a band gap at ${repaymentIncome}`,
  };
}

// =============================================================================
// Decimal sibling — same contract, Decimal arithmetic, no mid-rounding.
// =============================================================================

export interface HelpRepaymentResultDecimal {
  status: 'COMPUTED';
  amount: Decimal;
  band: HelpRepaymentBand;
  basis: 'NONE' | 'MARGINAL' | 'TOTAL_INCOME';
}

export function calculateHelpRepaymentDecimal(
  repaymentIncome: number | string | Decimal,
  config: TaxYearConfig,
): HelpRepaymentResultDecimal | HelpRepaymentUndetermined {
  const params = config.helpRepayment;
  if (!params) {
    return {
      status: 'UNDETERMINED',
      reason: `HELP/STSL repayment parameters are not configured for FY ${config.financialYear}`,
    };
  }
  const ri = toDecimal(repaymentIncome);
  if (ri === null || !ri.isFinite()) {
    return { status: 'UNDETERMINED', reason: 'repayment income is not a finite number' };
  }

  if (ri.gt(params.topThreshold)) {
    return {
      status: 'COMPUTED',
      amount: ri.times(params.topRateOfTotal),
      band: 'TOP_CLIFF',
      basis: 'TOTAL_INCOME',
    };
  }

  if (ri.lte(params.minThreshold)) {
    return { status: 'COMPUTED', amount: new Decimal(0), band: 'NIL', basis: 'NONE' };
  }

  for (let i = 0; i < params.bands.length; i++) {
    const band = params.bands[i];
    if (ri.lte(band.upTo)) {
      return {
        status: 'COMPUTED',
        amount: ri.minus(band.over).times(band.rate).plus(band.base),
        band: i === 0 ? 'MARGINAL_1' : 'MARGINAL_2',
        basis: 'MARGINAL',
      };
    }
  }

  return {
    status: 'UNDETERMINED',
    reason: `helpRepayment config for FY ${config.financialYear} has a band gap`,
  };
}
