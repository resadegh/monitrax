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
}

export interface SmsfIncomeTaxResult {
  /** Total fund income tax for the FY. `null` ⇒ UNCOMPUTED (see `uncomputed`). */
  tax: number | null;
  /** Tax on the assessable (non-NALI, non-ECPI-exempt) investment income. `null` ⇒ UNCOMPUTED. */
  investmentIncomeTax: number | null;
  /** Tax on assessable contributions @ 15% (ECPI never applies). */
  contributionsTax: number;
  /** Tax on NALI @ the top rate (ECPI never applies — s295-550). */
  naliTax: number;
  /** The 0%-taxed ECPI amount. `null` when the ECPI proportion is unknown. */
  ecpiExemptAmount: number | null;
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

  // --- Non-complying fund — top rate on all assessable income ----------
  if (!input.isComplying) {
    const investmentIncomeTax = netInvestmentIncome * topRate;
    const contributionsTax = contributions * topRate;
    const naliTax = nali * topRate;
    return {
      tax: investmentIncomeTax + contributionsTax + naliTax,
      investmentIncomeTax,
      contributionsTax,
      naliTax,
      ecpiExemptAmount: 0,
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
    return {
      tax: null,
      investmentIncomeTax: null,
      contributionsTax,
      naliTax,
      ecpiExemptAmount: null,
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

  return {
    tax: investmentIncomeTax + contributionsTax + naliTax,
    investmentIncomeTax,
    contributionsTax,
    naliTax,
    ecpiExemptAmount,
    isComplying: true,
    citations,
    uncomputed,
  };
}
