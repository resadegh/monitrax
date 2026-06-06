/**
 * Phase 44 Part 2c-i — SMSF fund-earnings income tax.
 *
 * The audit (PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md §2.1, §7.2 Q-SMSF)
 * found the tax engine had **no** SMSF fund-earnings income-tax module —
 * it computed contribution caps + Div 293/296 + the SIS-compliance
 * classifier, but not the fund's own income tax. Without this an SMSF
 * entity can never return a real income-tax number. This module fills
 * that gap. It is current law (not reform), and it *completes* the one
 * engine rather than duplicating one — the §8.3 exception Reza approved.
 *
 * AU primary authority:
 *   - ITAA 1997 Div 295 — taxation of complying super funds; a complying
 *     SMSF's taxable income is taxed at the concessional 15% rate.
 *   - ITAA 1997 s295-385 / s295-390 — Exempt Current Pension Income
 *     (ECPI): income from assets supporting retirement-phase income
 *     streams is exempt. The exempt proportion is set by the segregated
 *     method, or a proportionate-method actuary's certificate.
 *   - ITAA 1997 s295-550 — Non-Arm's-Length Income (NALI): taxed at the
 *     top marginal rate. **ECPI does NOT apply to NALI.**
 *   - ECPI also does NOT apply to assessable (concessional)
 *     contributions — they are taxed at 15% regardless.
 *   - A non-complying fund is taxed at the top rate on all assessable
 *     income.
 *
 * Honesty discipline (law-review §13-F9): when the fund is in pension
 * phase and the ECPI proportion has not been supplied, the
 * investment-income tax is **UNCOMPUTED** (`tax: null`) — the exempt
 * proportion is never guessed.
 *
 * Pure function; no DB; no clock reads. Composed by the SMSF dispatch
 * path in `entityTaxRouter`.
 */

import type { TaxYearConfig, AuthorityCitation, UncomputedFlag } from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

export interface SmsfIncomeTaxInput {
  /**
   * The fund's ordinary + statutory investment income for the FY (rent,
   * grossed-up dividends, interest, distributions) — EXCLUDES assessable
   * contributions and NALI, which are handled separately below.
   */
  assessableInvestmentIncome: number;
  /** Deductions against the fund's investment income. */
  deductions: number;
  /**
   * Assessable (concessional) contributions — employer SG + salary
   * sacrifice + personal deductible. Taxed at 15%; ECPI never applies.
   */
  assessableContributions: number;
  /**
   * Non-arm's-length income (NALI) — taxed at the top marginal rate;
   * ECPI never applies (s295-550).
   */
  nonArmsLengthIncome: number;
  /** Complying fund → 15% concessional rate; non-complying → top rate. */
  isComplying: boolean;
  /** Does the fund have retirement-phase (pension) accounts? Drives ECPI. */
  isInPensionPhase: boolean;
  /**
   * The exempt proportion (0..1) of non-NALI investment income — ECPI.
   * From the segregated method (0 or 1) or a proportionate-method
   * actuary's certificate. When the fund is in pension phase and this is
   * absent, the investment-income tax is UNCOMPUTED — never guessed.
   */
  ecpiExemptProportion?: number;
  /**
   * Imputation (franking) credits attached to franked dividends the fund
   * received this FY. A REFUNDABLE tax offset for a complying super fund
   * (ITAA 1997 Div 207 + s67-25) — it reduces the fund's tax and any
   * EXCESS is refunded in cash (the classic pension-phase SMSF benefit:
   * exempt income still attracts a franking refund). The grossed-up
   * dividend should already be inside `assessableInvestmentIncome`; this
   * is the credit that both grosses it up and offsets the tax. Defaults
   * to 0 — callers that omit it get byte-for-byte the prior result.
   */
  frankingCredits?: number;
}

export interface SmsfIncomeTaxResult {
  /** Total fund income tax for the FY (gross, before franking offset). `null` ⇒ UNCOMPUTED (see `uncomputed`). */
  tax: number | null;
  /** Tax on the assessable (non-NALI, non-ECPI-exempt) investment income. `null` ⇒ UNCOMPUTED. */
  investmentIncomeTax: number | null;
  /** Tax on assessable contributions @ 15% (ECPI never applies). */
  contributionsTax: number;
  /** Tax on NALI @ the top rate (ECPI never applies — s295-550). */
  naliTax: number;
  /** The 0%-taxed ECPI amount. `null` when the ECPI proportion is unknown. */
  ecpiExemptAmount: number | null;
  /** Refundable franking (imputation) credits applied as an offset (Div 207 + s67-25). */
  frankingCredits: number;
  /**
   * Net tax position after the refundable franking offset:
   * `tax - frankingCredits`. POSITIVE ⇒ payable; NEGATIVE ⇒ refundable.
   * `null` when gross `tax` is UNCOMPUTED.
   */
  netTaxPayable: number | null;
  /** The cash franking refund when credits exceed gross tax (`max(0, frankingCredits - tax)`). `null` when `tax` is UNCOMPUTED. */
  frankingRefund: number | null;
  isComplying: boolean;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const REVIEWED = '2026-05-22';

/** Clamp a proportion into the 0..1 range. */
function clampProportion(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Apply franking (imputation) credits as a tax offset.
 *
 * Complying funds: refundable (ITAA 1997 s67-25) — net can go negative
 * (a cash refund), and `frankingRefund` is the excess over gross tax.
 * Non-complying funds: non-refundable — credits floor the tax at 0, no
 * cash refund.
 *
 * Reform-neutral: franking refundability is NOT one of the 2026-27 reform
 * measures, so this branch produces the same number under every regime.
 */
function applyFranking(
  grossTax: number | null,
  frankingCredits: number,
  refundable: boolean,
): { netTaxPayable: number | null; frankingRefund: number | null } {
  if (grossTax === null) return { netTaxPayable: null, frankingRefund: null };
  if (refundable) {
    return {
      netTaxPayable: grossTax - frankingCredits, // negative ⇒ cash refund
      frankingRefund: Math.max(0, frankingCredits - grossTax),
    };
  }
  return {
    netTaxPayable: Math.max(0, grossTax - frankingCredits),
    frankingRefund: 0,
  };
}

/**
 * Compute a self-managed super fund's income tax for the FY. Pure;
 * deterministic. Returns a structurally-complete result — when the ECPI
 * proportion is unknown for a pension-phase fund, `tax` /
 * `investmentIncomeTax` are `null` and `UC-SMSF-ECPI-PROPORTION` is
 * surfaced (never a false number).
 */
export function calculateSmsfIncomeTax(
  input: SmsfIncomeTaxInput,
  config: TaxYearConfig,
): SmsfIncomeTaxResult {
  const concessionalRate = config.superContributionsTaxRate; // 15% — ITAA 1997 Div 295
  const topRate =
    config.brackets[config.brackets.length - 1]?.rate ?? 0.45; // NALI + non-complying

  const citations: AuthorityCitation[] = [
    { kind: 'ITAA_1997', reference: 'Div 295', lastReviewed: REVIEWED },
  ];
  const uncomputed: UncomputedFlag[] = [];

  const netInvestmentIncome = Math.max(
    0,
    input.assessableInvestmentIncome - input.deductions,
  );
  const nali = Math.max(0, input.nonArmsLengthIncome);
  const contributions = Math.max(0, input.assessableContributions);
  // Refundable franking offset (Div 207 + s67-25 for complying funds).
  const frankingCredits = Math.max(0, input.frankingCredits ?? 0);
  if (frankingCredits > 0) {
    citations.push(
      { kind: 'ITAA_1997', reference: 'Div 207', lastReviewed: REVIEWED },
      { kind: 'ITAA_1997', reference: 's67-25', lastReviewed: REVIEWED },
    );
  }

  // --- Non-complying fund — top rate on all assessable income ----------
  if (!input.isComplying) {
    const investmentIncomeTax = netInvestmentIncome * topRate;
    const contributionsTax = contributions * topRate;
    const naliTax = nali * topRate;
    const grossTax = investmentIncomeTax + contributionsTax + naliTax;
    // Non-complying fund — franking credits are non-refundable here.
    const { netTaxPayable, frankingRefund } = applyFranking(grossTax, frankingCredits, false);
    return {
      tax: grossTax,
      investmentIncomeTax,
      contributionsTax,
      naliTax,
      ecpiExemptAmount: 0,
      frankingCredits,
      netTaxPayable,
      frankingRefund,
      isComplying: false,
      citations: [
        ...citations,
        { kind: 'ITAA_1997', reference: 's295-605', lastReviewed: REVIEWED },
      ],
      uncomputed,
    };
  }

  // --- Complying fund --------------------------------------------------
  // NALI — top rate; ECPI never applies (s295-550).
  const naliTax = nali * topRate;
  if (nali > 0) {
    citations.push({ kind: 'ITAA_1997', reference: 's295-550', lastReviewed: REVIEWED });
  }
  // Assessable contributions — 15%; ECPI never applies.
  const contributionsTax = contributions * concessionalRate;

  // ECPI on non-NALI investment income. When the fund is in pension
  // phase and the exempt proportion is unknown, the investment-income
  // tax is UNCOMPUTED — never guessed (law-review §13-F9).
  if (input.isInPensionPhase && input.ecpiExemptProportion === undefined) {
    uncomputed.push({
      id: 'UC-SMSF-ECPI-PROPORTION',
      rationale:
        'This fund has retirement-phase (pension) accounts, but the exempt-current-pension-income proportion has not been supplied — the segregated method, or a proportionate-method actuary’s certificate. The fund’s investment-income tax cannot be computed without it; ECPI is never estimated. Contributions tax and NALI tax (where ECPI does not apply) are still shown.',
      citation: { kind: 'ITAA_1997', reference: 's295-385', lastReviewed: REVIEWED },
    });
    // Gross tax is UNCOMPUTED → net + refund are too (never guessed).
    return {
      tax: null,
      investmentIncomeTax: null,
      contributionsTax,
      naliTax,
      ecpiExemptAmount: null,
      frankingCredits,
      netTaxPayable: null,
      frankingRefund: null,
      isComplying: true,
      citations,
      uncomputed,
    };
  }

  const exemptProportion = input.isInPensionPhase
    ? clampProportion(input.ecpiExemptProportion ?? 0)
    : 0;
  const ecpiExemptAmount = netInvestmentIncome * exemptProportion;
  const assessableInvestmentIncome = netInvestmentIncome - ecpiExemptAmount;
  const investmentIncomeTax = assessableInvestmentIncome * concessionalRate;

  if (exemptProportion > 0) {
    citations.push({ kind: 'ITAA_1997', reference: 's295-385', lastReviewed: REVIEWED });
  }

  const grossTax = investmentIncomeTax + contributionsTax + naliTax;
  // Complying fund — franking credits are refundable (s67-25). In pension
  // phase, the exempt pool's franking credits still refund in cash.
  const { netTaxPayable, frankingRefund } = applyFranking(grossTax, frankingCredits, true);

  return {
    tax: grossTax,
    investmentIncomeTax,
    contributionsTax,
    naliTax,
    ecpiExemptAmount,
    frankingCredits,
    netTaxPayable,
    frankingRefund,
    isComplying: true,
    citations,
    uncomputed,
  };
}

// =============================================================================
// Q-DEC PR 2.D.3d — Decimal sibling path
// =============================================================================

export interface SmsfIncomeTaxInputDecimal {
  assessableInvestmentIncome: number | string | Decimal;
  deductions: number | string | Decimal;
  assessableContributions: number | string | Decimal;
  nonArmsLengthIncome: number | string | Decimal;
  isComplying: boolean;
  isInPensionPhase: boolean;
  ecpiExemptProportion?: number | string | Decimal;
  frankingCredits?: number | string | Decimal;
}

export interface SmsfIncomeTaxResultDecimal {
  tax: Decimal | null;
  investmentIncomeTax: Decimal | null;
  contributionsTax: Decimal;
  naliTax: Decimal;
  ecpiExemptAmount: Decimal | null;
  frankingCredits: Decimal;
  netTaxPayable: Decimal | null;
  frankingRefund: Decimal | null;
  isComplying: boolean;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

function clampProportionDecimal(value: Decimal): Decimal {
  if (value.isNaN()) return new Decimal(0);
  return Decimal.min(new Decimal(1), Decimal.max(new Decimal(0), value));
}

function applyFrankingDecimal(
  grossTax: Decimal | null,
  frankingCredits: Decimal,
  refundable: boolean,
): { netTaxPayable: Decimal | null; frankingRefund: Decimal | null } {
  if (grossTax === null) return { netTaxPayable: null, frankingRefund: null };
  if (refundable) {
    return {
      netTaxPayable: grossTax.minus(frankingCredits),
      frankingRefund: Decimal.max(new Decimal(0), frankingCredits.minus(grossTax)),
    };
  }
  return {
    netTaxPayable: Decimal.max(new Decimal(0), grossTax.minus(frankingCredits)),
    frankingRefund: new Decimal(0),
  };
}

/**
 * Decimal sibling of `calculateSmsfIncomeTax`. Preserves the
 * UC-SMSF-ECPI-PROPORTION honesty discipline — pension phase with
 * undefined ecpiExemptProportion returns `tax: null` etc., never a
 * guessed number.
 */
export function calculateSmsfIncomeTaxDecimal(
  input: SmsfIncomeTaxInputDecimal,
  config: TaxYearConfig,
): SmsfIncomeTaxResultDecimal {
  const zero = new Decimal(0);
  const concessionalRate = new Decimal(config.superContributionsTaxRate);
  const topRate = new Decimal(config.brackets[config.brackets.length - 1]?.rate ?? 0.45);

  const citations: AuthorityCitation[] = [
    { kind: 'ITAA_1997', reference: 'Div 295', lastReviewed: REVIEWED },
  ];
  const uncomputed: UncomputedFlag[] = [];

  const assessableInvestmentIncome = toDecimal(input.assessableInvestmentIncome) ?? zero;
  const deductions = toDecimal(input.deductions) ?? zero;
  const netInvestmentIncome = Decimal.max(zero, assessableInvestmentIncome.minus(deductions));
  const nali = Decimal.max(zero, toDecimal(input.nonArmsLengthIncome) ?? zero);
  const contributions = Decimal.max(zero, toDecimal(input.assessableContributions) ?? zero);
  const frankingCredits = Decimal.max(zero, toDecimal(input.frankingCredits ?? 0) ?? zero);
  if (frankingCredits.gt(0)) {
    citations.push(
      { kind: 'ITAA_1997', reference: 'Div 207', lastReviewed: REVIEWED },
      { kind: 'ITAA_1997', reference: 's67-25', lastReviewed: REVIEWED },
    );
  }

  // Non-complying fund — top rate on all assessable income.
  if (!input.isComplying) {
    const investmentIncomeTax = netInvestmentIncome.times(topRate);
    const contributionsTax = contributions.times(topRate);
    const naliTax = nali.times(topRate);
    const grossTax = investmentIncomeTax.plus(contributionsTax).plus(naliTax);
    const { netTaxPayable, frankingRefund } = applyFrankingDecimal(grossTax, frankingCredits, false);
    return {
      tax: grossTax,
      investmentIncomeTax,
      contributionsTax,
      naliTax,
      ecpiExemptAmount: zero,
      frankingCredits,
      netTaxPayable,
      frankingRefund,
      isComplying: false,
      citations: [...citations, { kind: 'ITAA_1997', reference: 's295-605', lastReviewed: REVIEWED }],
      uncomputed,
    };
  }

  // Complying fund.
  const naliTax = nali.times(topRate);
  if (nali.gt(0)) {
    citations.push({ kind: 'ITAA_1997', reference: 's295-550', lastReviewed: REVIEWED });
  }
  const contributionsTax = contributions.times(concessionalRate);

  // ECPI honesty discipline preserved.
  if (input.isInPensionPhase && input.ecpiExemptProportion === undefined) {
    uncomputed.push({
      id: 'UC-SMSF-ECPI-PROPORTION',
      rationale:
        'This fund has retirement-phase (pension) accounts, but the exempt-current-pension-income proportion has not been supplied — the segregated method, or a proportionate-method actuary’s certificate. The fund’s investment-income tax cannot be computed without it; ECPI is never estimated. Contributions tax and NALI tax (where ECPI does not apply) are still shown.',
      citation: { kind: 'ITAA_1997', reference: 's295-385', lastReviewed: REVIEWED },
    });
    return {
      tax: null,
      investmentIncomeTax: null,
      contributionsTax,
      naliTax,
      ecpiExemptAmount: null,
      frankingCredits,
      netTaxPayable: null,
      frankingRefund: null,
      isComplying: true,
      citations,
      uncomputed,
    };
  }

  const exemptProportion = input.isInPensionPhase
    ? clampProportionDecimal(toDecimal(input.ecpiExemptProportion ?? 0) ?? zero)
    : zero;
  const ecpiExemptAmount = netInvestmentIncome.times(exemptProportion);
  const assessableInvestmentIncomeAfterEcpi = netInvestmentIncome.minus(ecpiExemptAmount);
  const investmentIncomeTax = assessableInvestmentIncomeAfterEcpi.times(concessionalRate);

  if (exemptProportion.gt(0)) {
    citations.push({ kind: 'ITAA_1997', reference: 's295-385', lastReviewed: REVIEWED });
  }

  const grossTax = investmentIncomeTax.plus(contributionsTax).plus(naliTax);
  const { netTaxPayable, frankingRefund } = applyFrankingDecimal(grossTax, frankingCredits, true);

  return {
    tax: grossTax,
    investmentIncomeTax,
    contributionsTax,
    naliTax,
    ecpiExemptAmount,
    frankingCredits,
    netTaxPayable,
    frankingRefund,
    isComplying: true,
    citations,
    uncomputed,
  };
}
