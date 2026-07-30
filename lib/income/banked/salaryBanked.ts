/**
 * MON-131 Tranche 1 — L1 SALARY banked engine (D17 / D20 / D33 / D35 / D42).
 *
 * Banked salary = cash reaching the account. Resolution hierarchy (D17 —
 * "a payslip's actual net pay is a FACT and wins"):
 *
 *   1. FACT_ACTUAL_NET_PAY — `actualNetPay` set → banked = annualised FACT.
 *   2. FACT_NET_ENTERED   — `salaryType === 'NET'` → the entered amount IS
 *      what lands in the bank; gross reads the stored (entry-time-derived)
 *      `grossAmount`; the withholding wedge is gross − sacrifice − banked BY
 *      CONSTRUCTION — the stored `paygWithholding` column is never read
 *      (VR-042 V3: it disagrees with the applied wedge by $1,196.70/yr; the
 *      identity `gross − banked ≡ withholding` is restored by construction).
 *   3. DERIVED_SCHEDULE   — GROSS-entered (or untyped) → banked = gross −
 *      salary sacrifice − Schedule-1 PAYG withholding − HELP component.
 *      • PAYG comes from the FY's CONFIGURED Schedule 1 coefficients (D35),
 *        resolved from the ROW'S OWN pay period (D33). Scale 2 EMBEDS the
 *        Medicare levy and tax-offset shading — no separate Medicare/LITO
 *        arithmetic (that was the calculateTakeHomePay/calculateNetSalary
 *        divergence this engine retires).
 *      • HELP: only when `helpLoanDeclared === true`, on repayment income
 *        (D42 C2/C3 — top band is 10% of the WHOLE). `helpLoanDeclared ===
 *        null` → component UNDETERMINED and flagged (an employer withholds
 *        only on a declaration, so cash-flow treats it as not withheld — but
 *        it is never asserted as "no loan").
 *
 * PLAUSIBILITY (never a silent fix, §21.5): on FACT paths with a stored
 * gross, the implied wedge is compared to the schedule-derived wedge; a
 * large divergence sets the `WITHHOLDING_IMPLAUSIBLE` flag for surfacing —
 * the FACT still wins.
 *
 * PURE: no DB, no fetch (CLAUDE.md §6.4). Float + Decimal co-located.
 */

import { toAnnual, toAnnualDecimal } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { calculatePAYG, calculatePAYGDecimal } from '@/lib/tax-engine/core/paygCalculator';
import {
  calculateHelpRepayment,
  calculateHelpRepaymentDecimal,
} from '@/lib/tax-engine/core/helpRepaymentCalculator';
import { Decimal, toDecimal } from '@/lib/decimal';
import type { BankedIncomeRow, BankedContext, BankedRowResult } from './types';

/** Map the Prisma `Frequency` enum onto the tax-engine period vocabulary. */
type PaygFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY';
function toPaygFrequency(frequency: string): PaygFrequency {
  return (frequency === 'ANNUAL' ? 'ANNUALLY' : frequency) as PaygFrequency;
}

/** Divergence ratio above which the implied FACT wedge is flagged against the
 *  schedule-derived wedge. A SIGNAL for surfacing/data-quality review — never
 *  an adjustment (the FACT wins regardless). */
const WITHHOLDING_PLAUSIBILITY_TOLERANCE = 0.25;

export interface SalaryPlausibility {
  /** gross − sacrifice − banked, annual (what the stored data implies). */
  impliedWedgeAnnual: number;
  /** Schedule-1 withholding on (gross − sacrifice), annual. */
  scheduleWedgeAnnual: number;
  divergent: boolean;
}

export interface SalaryBankedResult extends BankedRowResult {
  source: 'salary';
  plausibility: SalaryPlausibility | null;
}

/** Schedule-1 withholding for an ANNUAL taxable-earnings figure, resolved at
 *  the row's own pay period (D33). */
function scheduleWithholdingAnnual(
  annualEarnings: number,
  rowFrequency: string,
  ctx: BankedContext,
): number {
  const freq = toPaygFrequency(rowFrequency);
  // Convert the annual figure to the row's own period so the ATO's
  // per-period floor + whole-dollar rounding behave as they do in payroll.
  const periodsPerYearMap: Record<PaygFrequency, number> = {
    WEEKLY: 52, FORTNIGHTLY: 26, MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, ANNUALLY: 1,
  };
  const periods = periodsPerYearMap[freq];
  const perPeriod = annualEarnings / periods;
  const result = calculatePAYG(
    { grossIncome: perPeriod, frequency: freq, hasTaxFreeThreshold: true },
    ctx.config,
  );
  return result.annualWithholding;
}

export function computeSalaryBanked(row: BankedIncomeRow, ctx: BankedContext): SalaryBankedResult {
  const undetermined: string[] = [];
  const flags: string[] = [];
  const salarySacrifice = row.salarySacrifice ?? 0; // already-annual (schema)
  const oneOff = row.isRecurring === false;

  // ---- establish annual banked + gross by basis ---------------------------
  let basis: SalaryBankedResult['basis'];
  let bankedAnnual: number;
  let grossAnnual: number | null;
  let payg: number | null = null;
  let help: number | null = null;

  if (row.actualNetPay != null) {
    basis = 'FACT_ACTUAL_NET_PAY';
    bankedAnnual = toAnnual(row.actualNetPay, row.frequency as Frequency); // @source-lock-allowed: THE canonical L1 salary producer — FACT annualisation; one-off gate applied at the return
    grossAnnual = row.grossAmount ?? (row.salaryType === 'GROSS' ? toAnnual(row.amount, row.frequency as Frequency) : null); // @source-lock-allowed: canonical producer gross resolution
    if (grossAnnual === null) undetermined.push('gross');
  } else if (row.salaryType === 'NET') {
    basis = 'FACT_NET_ENTERED';
    bankedAnnual = toAnnual(row.amount, row.frequency as Frequency); // @source-lock-allowed: THE canonical L1 salary producer — NET-entered FACT; one-off gate applied at the return
    grossAnnual = row.grossAmount ?? null; // stored, entry-time-derived, already-annual
    if (grossAnnual === null) undetermined.push('gross');
  } else {
    // GROSS-entered, or legacy untyped SALARY (treated as gross — the
    // pre-existing convention across every legacy producer).
    basis = 'DERIVED_SCHEDULE';
    grossAnnual = toAnnual(row.amount, row.frequency as Frequency); // @source-lock-allowed: THE canonical L1 salary producer — gross basis for schedule derivation
    const taxableEarnings = Math.max(0, grossAnnual - salarySacrifice);
    payg = scheduleWithholdingAnnual(taxableEarnings, row.frequency, ctx);

    if (row.helpLoanDeclared === true) {
      if (ctx.repaymentIncome === null) {
        undetermined.push('helpWithholding');
        flags.push('HELP_DECLARED_BUT_REPAYMENT_INCOME_UNAVAILABLE');
        help = null;
      } else {
        const helpResult = calculateHelpRepayment(ctx.repaymentIncome, ctx.config);
        if (helpResult.status === 'COMPUTED') {
          help = helpResult.amount;
        } else {
          undetermined.push('helpWithholding');
          flags.push('HELP_PARAMETERS_UNAVAILABLE');
          help = null;
        }
      }
    } else if (row.helpLoanDeclared === false) {
      help = 0;
    } else {
      // null — absence of the flag is NOT evidence of absence of a loan.
      // Cash-basis: an employer withholds nothing without a declaration, so
      // banked treats the component as 0 — but it is UNDETERMINED, not "no
      // loan", and surfaces must say so.
      undetermined.push('helpLoanDeclared');
      flags.push('HELP_LOAN_UNDETERMINED');
      help = 0;
    }
    bankedAnnual = Math.max(0, grossAnnual - salarySacrifice - payg - (help ?? 0));
  }

  // ---- FACT-path wedge + plausibility --------------------------------------
  let plausibility: SalaryPlausibility | null = null;
  if (basis !== 'DERIVED_SCHEDULE' && grossAnnual !== null) {
    // Withholding is the identity wedge — restores gross − banked ≡ withholding
    // exactly (the stored paygWithholding column is retired as a read source).
    payg = Math.max(0, grossAnnual - salarySacrifice - bankedAnnual);
    const scheduleWedge = scheduleWithholdingAnnual(
      Math.max(0, grossAnnual - salarySacrifice),
      row.frequency,
      ctx,
    );
    const divergent =
      scheduleWedge > 0 &&
      Math.abs(payg - scheduleWedge) / scheduleWedge > WITHHOLDING_PLAUSIBILITY_TOLERANCE;
    if (divergent) flags.push('WITHHOLDING_IMPLAUSIBLE');
    plausibility = {
      impliedWedgeAnnual: payg,
      scheduleWedgeAnnual: scheduleWedge,
      divergent,
    };
  }

  // A one-off receipt is counted ONCE at FACE value — never annualised
  // (the MON-053 lesson: a lone deposit must not become ×frequency phantom
  // income). Face = the cash that arrived: actualNetPay > amount as entered.
  // A GROSS-entered one-off's withholding is NOT derived (per-period
  // schedules don't apply to a lump sum) — flagged undetermined instead.
  let oneOffAmount = 0;
  if (oneOff) {
    oneOffAmount = row.actualNetPay ?? row.amount;
    if (basis === 'DERIVED_SCHEDULE' && row.actualNetPay == null) {
      undetermined.push('oneOffWithholding');
      flags.push('ONE_OFF_GROSS_UNDERIVED');
    }
  }

  return {
    id: row.id,
    source: 'salary',
    bankedAnnual: oneOff ? 0 : bankedAnnual,
    grossAnnual: oneOff ? 0 : grossAnnual,
    components: { payg: oneOff ? 0 : payg, help: oneOff ? 0 : help, salarySacrifice: oneOff ? 0 : salarySacrifice },
    basis,
    oneOffAmount,
    undetermined,
    flags,
    plausibility,
  };
}

// =============================================================================
// Decimal sibling — same hierarchy, Decimal arithmetic. The Schedule-1
// whole-dollar rounding is regulatory (NAT 1004), so Float ≡ Decimal on the
// withholding value by design.
// =============================================================================

export interface SalaryBankedResultDecimal {
  id?: string;
  source: 'salary';
  bankedAnnual: Decimal;
  grossAnnual: Decimal | null;
  components: { payg: Decimal | null; help: Decimal | null; salarySacrifice: Decimal };
  basis: SalaryBankedResult['basis'];
  oneOffAmount: Decimal;
  undetermined: string[];
  flags: string[];
}

export function computeSalaryBankedDecimal(
  row: BankedIncomeRow,
  ctx: BankedContext,
): SalaryBankedResultDecimal {
  const undetermined: string[] = [];
  const flags: string[] = [];
  const ZERO = new Decimal(0);
  const salarySacrifice = toDecimal(row.salarySacrifice ?? 0) ?? ZERO;
  const oneOff = row.isRecurring === false;

  const annualise = (amount: number | Decimal) =>
    toAnnualDecimal(toDecimal(amount) ?? ZERO, row.frequency as Frequency);

  const scheduleWedge = (annualEarnings: Decimal): Decimal => {
    const freq = toPaygFrequency(row.frequency);
    const periodsPerYearMap: Record<PaygFrequency, number> = {
      WEEKLY: 52, FORTNIGHTLY: 26, MONTHLY: 12, QUARTERLY: 4, HALF_YEARLY: 2, ANNUALLY: 1,
    };
    const perPeriod = annualEarnings.div(periodsPerYearMap[freq]);
    return calculatePAYGDecimal(
      { grossIncome: perPeriod, frequency: freq, hasTaxFreeThreshold: true },
      ctx.config,
    ).annualWithholding;
  };

  let basis: SalaryBankedResult['basis'];
  let bankedAnnual: Decimal;
  let grossAnnual: Decimal | null;
  let payg: Decimal | null = null;
  let help: Decimal | null = null;

  if (row.actualNetPay != null) {
    basis = 'FACT_ACTUAL_NET_PAY';
    bankedAnnual = annualise(row.actualNetPay);
    grossAnnual =
      row.grossAmount != null
        ? toDecimal(row.grossAmount) ?? ZERO
        : row.salaryType === 'GROSS'
          ? annualise(row.amount)
          : null;
    if (grossAnnual === null) undetermined.push('gross');
  } else if (row.salaryType === 'NET') {
    basis = 'FACT_NET_ENTERED';
    bankedAnnual = annualise(row.amount);
    grossAnnual = row.grossAmount != null ? toDecimal(row.grossAmount) ?? ZERO : null;
    if (grossAnnual === null) undetermined.push('gross');
  } else {
    basis = 'DERIVED_SCHEDULE';
    grossAnnual = annualise(row.amount);
    const taxableEarnings = Decimal.max(ZERO, grossAnnual.minus(salarySacrifice));
    payg = scheduleWedge(taxableEarnings);

    if (row.helpLoanDeclared === true) {
      if (ctx.repaymentIncome === null) {
        undetermined.push('helpWithholding');
        flags.push('HELP_DECLARED_BUT_REPAYMENT_INCOME_UNAVAILABLE');
      } else {
        const helpResult = calculateHelpRepaymentDecimal(ctx.repaymentIncome, ctx.config);
        if (helpResult.status === 'COMPUTED') {
          help = helpResult.amount;
        } else {
          undetermined.push('helpWithholding');
          flags.push('HELP_PARAMETERS_UNAVAILABLE');
        }
      }
    } else if (row.helpLoanDeclared === false) {
      help = ZERO;
    } else {
      undetermined.push('helpLoanDeclared');
      flags.push('HELP_LOAN_UNDETERMINED');
      help = ZERO;
    }
    bankedAnnual = Decimal.max(
      ZERO,
      grossAnnual.minus(salarySacrifice).minus(payg).minus(help ?? ZERO),
    );
  }

  if (basis !== 'DERIVED_SCHEDULE' && grossAnnual !== null) {
    payg = Decimal.max(ZERO, grossAnnual.minus(salarySacrifice).minus(bankedAnnual));
    const schedule = scheduleWedge(Decimal.max(ZERO, grossAnnual.minus(salarySacrifice)));
    if (
      schedule.gt(0) &&
      payg.minus(schedule).abs().div(schedule).gt(WITHHOLDING_PLAUSIBILITY_TOLERANCE)
    ) {
      flags.push('WITHHOLDING_IMPLAUSIBLE');
    }
  }

  // One-off = FACE value, never annualised (mirrors the Float path exactly).
  let oneOffAmount = ZERO;
  if (oneOff) {
    oneOffAmount = toDecimal(row.actualNetPay ?? row.amount) ?? ZERO;
    if (basis === 'DERIVED_SCHEDULE' && row.actualNetPay == null) {
      undetermined.push('oneOffWithholding');
      flags.push('ONE_OFF_GROSS_UNDERIVED');
    }
  }

  return {
    id: row.id,
    source: 'salary',
    bankedAnnual: oneOff ? ZERO : bankedAnnual,
    grossAnnual: oneOff ? ZERO : grossAnnual,
    components: {
      payg: oneOff ? ZERO : payg,
      help: oneOff ? ZERO : help,
      salarySacrifice: oneOff ? ZERO : salarySacrifice,
    },
    basis,
    oneOffAmount,
    undetermined,
    flags,
  };
}
