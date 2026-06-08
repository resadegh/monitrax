/**
 * Phase 45 PR 1 — Salary-sacrifice to super scenario.
 *
 * Composes the existing super-contribution + cap-headroom + Div 293 engines
 * to answer: "If I sacrificed $X/month into super, what would happen to my
 * year-1 take-home pay, my year-1 tax, and (via tenYearProjection.ts) my
 * 10-year trajectory?"
 *
 * ZERO new calc engines per PHASE_45_WHAT_IF_SCENARIOS.md §4 and CLAUDE.md
 * §12.3. All math composes:
 *   - `calculateSuperContributionsDecimal` (SG + sacrifice + Div 293)
 *   - `concessionalCapHeadroomDecimal` (cap + carry-forward arithmetic)
 *   - `taxYearConfig` (cap + commencement-verification flags)
 *
 * The H3 `concessionalCapGuard` is a thin, named wrapper around
 * `concessionalCapHeadroomDecimal` that produces a scenario-shaped result:
 * { capLimit, headroomRemaining, hardStopReason?, regimeStatus }. The slider
 * UI in PR 2 calls this on every change to enforce the hard stop — the
 * function is the AFSL discipline §4 says we never cross silently.
 *
 * H2 reform awareness: per CLAUDE.md §12.14 FW-2, the engine respects the
 * `div296CommencementVerified` flag in `taxYearConfig`. If the user's super
 * balance is above the Div 296 TSB threshold ($3M) AND the high-balance tax
 * has not been Royal-Assent-verified for this FY, the scenario returns
 * UNCOMPUTED + a regimeStatus hint so the UI can render the regime badge +
 * lock the slider. (Same FW-2 pattern the per-asset tax engines already
 * follow — see `lib/tax-engine/divisions/highIncomeSuperTax.ts`.)
 */

import { Decimal, toDecimal } from '@/lib/decimal';
import {
  concessionalCapHeadroomDecimal,
  getConcessionalCap,
} from '@/lib/tax-engine/super/capTracker';
import { calculateSuperContributionsDecimal } from '@/lib/tax-engine/super/contributionCalculator';
import {
  getCurrentTaxYearConfig,
  getMarginalRate,
} from '@/lib/tax-engine/config/taxYearConfig';
import type { TaxYearConfig } from '@/lib/tax-engine/types';
import type {
  ScenarioContext,
  ScenarioImpact,
  ScenarioImpactDecimal,
  ScenarioResult,
  ScenarioResultDecimal,
  SliderSource,
} from './types';

export interface SalarySacrificeToSuperParams {
  /** Dollars/month the user is proposing to sacrifice. Slider range 0..N. */
  monthlySacrifice: number;
  /**
   * Optional explicit gross salary override (annual, AUD). If absent the
   * engine reads `ctx.snapshot.income.primary.grossTotal`.
   */
  grossSalaryAnnual?: number;
  /**
   * Optional YTD concessional contributions already made this FY (SG + any
   * prior sacrifice). If absent, the engine projects from-start-of-FY (i.e.
   * SG is computed as `grossSalary × superGuaranteeRate`; YTD sacrifice = 0).
   * The assumption is surfaced in the result's `assumptions` array.
   */
  ytdConcessional?: number;
  /**
   * Optional current super balance (AUD). If absent, defaults to the sum of
   * `ctx.snapshot.superannuationAccounts`. Used for both the Div 296 H2
   * regime check AND the 10-year composer's super-balance growth.
   */
  currentSuperBalance?: number;
  /** Optional FY override (e.g. '2024-25'). Defaults to the current FY. */
  financialYear?: string;
}

// =============================================================================
// H3 — Concessional cap headroom guard (named exported utility)
// =============================================================================

export interface ConcessionalCapGuardResult {
  capLimit: Decimal;
  carryForwardAvailable: Decimal;
  totalAvailable: Decimal;
  used: Decimal; // YTD concessional including SG
  proposed: Decimal; // YTD + the new sacrifice the user is proposing
  headroomRemaining: Decimal; // totalAvailable − proposed
  isExceeded: boolean;
  hardStopReason?: string; // populated when isExceeded
}

/**
 * Phase 45 PR 1 §4.1 H3 — concessional cap headroom guard.
 *
 * Pure function. Returns the cap math the slider UI needs to enforce a
 * hard stop. Never silently models an illegal contribution.
 *
 * Math:
 *   1. SG = grossSalary × superGuaranteeRate (the employer pays this on top
 *      of salary; counts toward concessional cap).
 *   2. annualSacrifice = monthlySacrifice × 12.
 *   3. projectedTotal = ytdConcessional + remainingSG + annualSacrifice
 *      (When ytdConcessional is absent we assume from-start-of-FY: ytd = 0,
 *       remainingSG = full SG.)
 *   4. headroomRemaining = (cap + carryForwardAvailable) − projectedTotal.
 *   5. If negative, hardStopReason = "$X over the $Y cap — over-cap
 *      contributions attract Division 293 / excess contributions tax. To
 *      increase the cap, your fund needs to confirm carry-forward unused
 *      cap from prior years."
 */
export function concessionalCapGuard(
  ctx: ScenarioContext,
  params: SalarySacrificeToSuperParams,
  config: TaxYearConfig = getCurrentTaxYearConfig(),
): ConcessionalCapGuardResult {
  const grossSalary = toDecimal(
    params.grossSalaryAnnual ?? ctx.snapshot.income.annual.primary.grossTotal,
  ) ?? new Decimal(0);
  const monthlySacrifice = toDecimal(params.monthlySacrifice) ?? new Decimal(0);
  const annualSacrifice = monthlySacrifice.times(12);
  const sg = grossSalary.times(config.superGuaranteeRate);
  const ytd = toDecimal(params.ytdConcessional ?? 0) ?? new Decimal(0);

  // "Proposed total" = YTD concessional already counted + the SG + sacrifice
  // forward from here. When ytd === 0 we assume from-start-of-FY (SG is full
  // year + sacrifice is full year). When ytd > 0, the caller is responsible
  // for the pro-rata math — we accept their ytd as the canonical YTD and just
  // add the remaining SG + remaining sacrifice. For PR 1 simplicity, callers
  // pass either "from start of FY" (ytd = 0) or the full-FY projection where
  // ytd already includes both SG-to-date and sacrifice-to-date.
  const proposedTotal = ytd.eq(0)
    ? sg.plus(annualSacrifice)
    : ytd.plus(annualSacrifice);

  const headroom = concessionalCapHeadroomDecimal(proposedTotal, config);

  const hardStopReason = headroom.isExceeded
    ? `$${headroom.headroomRemaining.neg().toFixed(0)} over the $${headroom.capLimit.toFixed(0)} cap (incl. $${headroom.carryForwardAvailable.toFixed(0)} carry-forward available). Going over the concessional cap attracts Division 293 / excess contributions tax. To increase the cap, your fund needs to confirm carry-forward unused cap from prior years.`
    : undefined;

  return {
    capLimit: headroom.capLimit,
    carryForwardAvailable: headroom.carryForwardAvailable,
    totalAvailable: headroom.totalAvailable,
    used: ytd,
    proposed: proposedTotal,
    headroomRemaining: headroom.headroomRemaining,
    isExceeded: headroom.isExceeded,
    hardStopReason,
  };
}

// =============================================================================
// H1 — SliderSource helpers
// =============================================================================

/**
 * Phase 45 PR 1 §4.1 H1 — produces the per-slider source declarations the
 * UI renders beneath every slider. Snapshot-traced for `grossSalaryAnnual`
 * and `currentSuperBalance` when available; industry-default for
 * `monthlySacrifice` (starts at 0 — there's no "current" sacrifice).
 */
export function salarySacrificeSliderSources(
  ctx: ScenarioContext,
  params: SalarySacrificeToSuperParams,
): Record<string, SliderSource> {
  const asOf = ctx.snapshot.calculatedAt instanceof Date
    ? ctx.snapshot.calculatedAt.toISOString()
    : new Date(ctx.snapshot.calculatedAt).toISOString();
  return {
    monthlySacrifice: {
      kind: 'default',
      value: params.monthlySacrifice,
      rationale:
        'Sacrifice slider starts at $0. Move it to see the year-1 cashflow + 10-year impact.',
    },
    grossSalaryAnnual: params.grossSalaryAnnual !== undefined
      ? {
          kind: 'default',
          value: params.grossSalaryAnnual,
          rationale: 'Override supplied by caller (e.g. AI advisor tool).',
        }
      : {
          kind: 'snapshot',
          path: 'income.annual.primary.grossTotal',
          asOf,
        },
    currentSuperBalance: params.currentSuperBalance !== undefined
      ? {
          kind: 'default',
          value: params.currentSuperBalance,
          rationale: 'Override supplied by caller.',
        }
      : {
          kind: 'snapshot',
          path: 'netWorth.assets.superannuation',
          asOf,
        },
  };
}

// =============================================================================
// H2 — Regime status check
// =============================================================================

export type SalarySacrificeRegimeStatus =
  | { kind: 'UNAFFECTED'; label: 'Current rules' }
  | {
      kind: 'DIV296_UNCOMPUTED';
      label: 'High-balance super tax — pending Royal Assent';
      reason: string;
    }
  | {
      kind: 'DIV296_VERIFIED';
      label: 'High-balance super tax — applies above $3M TSB';
      reason: string;
    };

/**
 * Phase 45 PR 1 §4.1 H2 — reform-awareness check per CLAUDE.md §12.14 FW-2.
 *
 * The only reform measure that affects salary-sacrifice math is Div 296
 * (high-balance super tax — 15% on earnings attributable to the TSB share
 * above $3M). If the user's super balance is below the threshold, the
 * regime is unaffected. If above and `commencementVerified === true`,
 * the scenario continues with the post-reform branch. If above and
 * `commencementVerified === false`, the slider locks with UNCOMPUTED.
 */
export function getRegimeStatus(
  superBalance: Decimal,
  config: TaxYearConfig,
): SalarySacrificeRegimeStatus {
  if (superBalance.lt(config.div296TsbThreshold)) {
    return { kind: 'UNAFFECTED', label: 'Current rules' };
  }
  if (config.div296CommencementVerified) {
    return {
      kind: 'DIV296_VERIFIED',
      label: 'High-balance super tax — applies above $3M TSB',
      reason: `Your TSB ($${superBalance.toFixed(0)}) is above the $3,000,000 Div 296 threshold. An additional ${(config.div296Rate * 100).toFixed(0)}% applies to earnings on the share above $3M (Phase 41e.3 in effect for ${config.label}).`,
    };
  }
  return {
    kind: 'DIV296_UNCOMPUTED',
    label: 'High-balance super tax — pending Royal Assent',
    reason: `Your TSB ($${superBalance.toFixed(0)}) is above the $3,000,000 Div 296 threshold but the high-balance tax has NOT been Royal-Assent-verified for ${config.label}. Projection locked until the measure commences and is verified per CLAUDE.md §12.14 FW-2.`,
  };
}

// =============================================================================
// Scenario — Decimal implementation
// =============================================================================

/**
 * Total Super Balance (TSB) for the Div 296 H2 regime check.
 *
 * **The ATO TSB definition** (PR 2.A.1 audit 2026-06-08) — Div 296
 * high-balance super tax measures the individual's interest across
 * ALL super funds (APRA + SMSF). The TSB threshold is $3M; if the
 * user's total is above and `div296CommencementVerified === false`
 * for the FY, the scenario MUST return UNCOMPUTED per CLAUDE.md
 * §12.14 FW-2.
 *
 * **Why this differs from the snapshot's `netWorth.assets.superannuation`**:
 * the net-worth aggregation EXCLUDES SMSF member balances per Phase 39.5
 * (`lib/calculations/netWorthCalculator.ts:74`) because the SMSF's owned
 * assets — property, investments, cash — are already summed via the
 * SMSF LegalEntity, and counting the member balance too would double-
 * count the fund. That's correct for net-worth. It's WRONG for TSB:
 * the ATO doesn't care that you've already counted the SMSF's
 * underlying assets in your personal net worth — Div 296 reads the
 * member-account-level balance as your "interest in super," full stop.
 *
 * **Resolution**: prefer `ctx.superAccounts` (un-deduplicated, sums
 * every super account regardless of fundType) when callers supply it.
 * Fall back to the snapshot field for back-compat — that fallback is
 * correct for users with no SMSF, undercount for users with one.
 *
 * Pre-PR-2.A.1 bug: a user with $1.5M AustralianSuper + $2M SMSF
 * member balance read as $1.5M TSB, so the Div 296 regime check
 * never triggered even though the real TSB is $3.5M.
 */
function sumSuperBalance(ctx: ScenarioContext): Decimal {
  if (ctx.superAccounts && ctx.superAccounts.length > 0) {
    return ctx.superAccounts.reduce<Decimal>(
      (acc, a) => acc.plus(toDecimal(a.currentBalance) ?? new Decimal(0)),
      new Decimal(0),
    );
  }
  return toDecimal(ctx.snapshot.netWorth.assets.superannuation) ?? new Decimal(0);
}

export function salarySacrificeToSuperScenarioDecimal(
  ctx: ScenarioContext,
  params: SalarySacrificeToSuperParams,
): ScenarioResultDecimal {
  const config = params.financialYear
    ? getCurrentTaxYearConfig() // simplified PR 1; PR 2 wires explicit FY pick
    : getCurrentTaxYearConfig();

  const grossSalary = toDecimal(
    params.grossSalaryAnnual ?? ctx.snapshot.income.annual.primary.grossTotal,
  ) ?? new Decimal(0);
  const monthlySacrifice = toDecimal(params.monthlySacrifice) ?? new Decimal(0);
  const annualSacrifice = monthlySacrifice.times(12);
  const superBalance = params.currentSuperBalance !== undefined
    ? (toDecimal(params.currentSuperBalance) ?? new Decimal(0))
    : sumSuperBalance(ctx);
  const computedAt = new Date().toISOString();
  const title = `Salary-sacrifice $${monthlySacrifice.toFixed(0)}/mo to super`;

  // ---------- Empty / zero-salary handling ----------
  if (grossSalary.lte(0)) {
    return {
      type: 'salarySacrificeToSuper',
      title,
      summary:
        'No primary salary income on your snapshot — add a salary income to use the salary-sacrifice lever.',
      impacts: [],
      warnings: [
        {
          severity: 'critical',
          message: 'Primary salary income is $0 — cannot model salary-sacrifice impact.',
        },
      ],
      assumptions: [],
      computedAt,
    };
  }

  // ---------- H2 regime check ----------
  const regime = getRegimeStatus(superBalance, config);
  if (regime.kind === 'DIV296_UNCOMPUTED') {
    return {
      type: 'salarySacrificeToSuper',
      title,
      summary: regime.label,
      impacts: [],
      warnings: [{ severity: 'critical', message: regime.reason }],
      assumptions: [
        `Regime: ${regime.label}. Slider locked until the Div 296 measure has \`commencementVerified === true\` for the current FY.`,
      ],
      computedAt,
    };
  }

  // ---------- H3 concessional cap guard ----------
  const guard = concessionalCapGuard(ctx, params, config);
  if (guard.isExceeded) {
    return {
      type: 'salarySacrificeToSuper',
      title,
      summary: `Over concessional cap — sacrifice would exceed the $${config.concessionalCap.toLocaleString()} limit for ${config.label}.`,
      impacts: [],
      warnings: [
        {
          severity: 'critical',
          message: guard.hardStopReason ?? 'Concessional cap exceeded.',
        },
      ],
      assumptions: [
        `${config.label} concessional cap = $${guard.capLimit.toFixed(0)}.`,
        guard.carryForwardAvailable.gt(0)
          ? `Carry-forward available (if your fund confirms eligibility): $${guard.carryForwardAvailable.toFixed(0)}.`
          : 'No carry-forward available (or not configured on your snapshot).',
        `Current proposed total: $${guard.proposed.toFixed(0)} / $${guard.totalAvailable.toFixed(0)} cap incl. carry-forward.`,
      ],
      computedAt,
    };
  }

  // ---------- Compose the contribution math ----------
  const marginalRate = getMarginalRate(grossSalary.toNumber(), config);

  const contribs = calculateSuperContributionsDecimal(
    {
      grossSalary,
      salarySacrifice: annualSacrifice,
    },
    marginalRate,
    config,
  );

  // ---------- Build impacts ----------
  const grossSalaryAnnual = grossSalary;
  const taxableIncomeBefore = grossSalaryAnnual;
  const taxableIncomeAfter = grossSalaryAnnual.minus(annualSacrifice);

  const sg = contribs.superGuarantee;
  const totalConcessional = contribs.totalConcessional;
  const contributionsTax = contribs.contributionsTax;
  const div293Tax = contribs.division293Tax;
  const taxSavings = contribs.taxSavingsFromSalarySacrifice;

  // Year-1 take-home delta = -sacrifice + marginal-tax-saved.
  // The user "loses" the sacrifice from take-home pay but "gains" the
  // marginal-tax they would have paid on it. The contributions-tax + Div 293
  // are paid out of super, not take-home — so they reduce the super balance
  // not the cashflow.
  const takeHomeAnnualDelta = annualSacrifice.neg().plus(taxSavings);
  const takeHomeMonthlyDelta = takeHomeAnnualDelta.div(12);

  const monthlyCashflowBefore = toDecimal(ctx.snapshot.quickMetrics.monthlyCashflow) ?? new Decimal(0);
  const monthlyCashflowAfter = monthlyCashflowBefore.plus(takeHomeMonthlyDelta);

  // Effective year-1 super contribution (net of contributions tax + Div 293
  // — these reduce the super balance).
  const netToSuperYearOne = annualSacrifice.plus(sg)
    .minus(contributionsTax)
    .minus(div293Tax);

  const superBalanceAfterYearOne = superBalance.plus(netToSuperYearOne);

  const impacts: ScenarioImpactDecimal[] = [
    {
      label: 'Annual taxable income',
      before: taxableIncomeBefore,
      after: taxableIncomeAfter,
      delta: taxableIncomeAfter.minus(taxableIncomeBefore),
      format: 'currency',
      direction: 'positive', // lower taxable income is the goal of this lever
    },
    {
      label: 'Year-1 tax savings (marginal − 15%)',
      before: new Decimal(0),
      after: taxSavings,
      delta: taxSavings,
      format: 'currency',
      direction: taxSavings.gt(0) ? 'positive' : 'neutral',
    },
    {
      label: 'Monthly take-home pay',
      before: monthlyCashflowBefore,
      after: monthlyCashflowAfter,
      delta: takeHomeMonthlyDelta,
      format: 'currency',
      direction: takeHomeMonthlyDelta.gte(0) ? 'positive' : 'negative',
    },
    {
      label: 'Year-1 net added to super (after contributions tax + Div 293)',
      before: new Decimal(0),
      after: netToSuperYearOne,
      delta: netToSuperYearOne,
      format: 'currency',
      direction: 'positive',
    },
    {
      label: 'Total concessional this FY (SG + sacrifice)',
      before: sg,
      after: totalConcessional,
      delta: annualSacrifice,
      format: 'currency',
      direction: 'neutral',
    },
  ];

  // ---------- Warnings + assumptions ----------
  const warnings = [];
  if (takeHomeMonthlyDelta.lt(0)) {
    warnings.push({
      severity: 'caution' as const,
      message: `Sacrificing $${monthlySacrifice.toFixed(0)}/mo reduces your monthly take-home by $${takeHomeMonthlyDelta.neg().toFixed(0)}. Check this fits your cashflow before committing — you can stop sacrificing anytime by speaking to payroll, but the FY contribution itself cannot be reversed.`,
    });
  }
  if (regime.kind === 'DIV296_VERIFIED') {
    warnings.push({
      severity: 'info' as const,
      message: regime.reason,
    });
  }
  if (div293Tax.gt(0)) {
    warnings.push({
      severity: 'info' as const,
      message: `Division 293 tax of $${div293Tax.toFixed(0)} applies because your income + concessional contributions exceeds $${config.division293Threshold.toLocaleString()}. This is an additional 15% tax on the share of concessional contributions over the threshold.`,
    });
  }
  // `guard.headroomRemaining` is already the after-state (cap − proposed).
  if (guard.headroomRemaining.gt(0) && guard.headroomRemaining.lt(2000)) {
    warnings.push({
      severity: 'info' as const,
      message: `Only $${guard.headroomRemaining.toFixed(0)} of headroom left after this sacrifice. A bonus or back-pay event later this FY could push you over the cap.`,
    });
  }

  const assumptions: string[] = [
    `${config.label} concessional cap = $${config.concessionalCap.toLocaleString()}; SG rate = ${(config.superGuaranteeRate * 100).toFixed(1)}%.`,
    `Sacrifice assumed paid evenly across the FY. Marginal rate = ${(marginalRate * 100).toFixed(0)}% based on your gross salary ($${grossSalary.toFixed(0)}).`,
    `Contributions tax = 15% on concessional contributions, deducted from super (not take-home).`,
    'Year-1 projection only. The 10-year trajectory is rendered by the tenYearProjection composer (see PR 2 UI).',
    regime.kind === 'UNAFFECTED'
      ? `Regime: current rules (TSB $${superBalance.toFixed(0)} below the $3M Div 296 threshold).`
      : `Regime: ${regime.label}.`,
    params.ytdConcessional === undefined
      ? 'YTD concessional contributions not supplied — assumes from-start-of-FY (full SG + full sacrifice for the year).'
      : `YTD concessional contributions: $${(params.ytdConcessional ?? 0).toLocaleString()} (supplied).`,
  ];

  return {
    type: 'salarySacrificeToSuper',
    title,
    summary: takeHomeMonthlyDelta.lt(0)
      ? `Sacrificing $${monthlySacrifice.toFixed(0)}/mo would lower your take-home by $${takeHomeMonthlyDelta.neg().toFixed(0)}/mo, save $${taxSavings.toFixed(0)} of year-1 tax, and add $${netToSuperYearOne.toFixed(0)} to super after contributions tax.`
      : `At $${monthlySacrifice.toFixed(0)}/mo sacrifice, your take-home is unchanged and your super grows.`,
    impacts,
    warnings,
    assumptions,
    computedAt,
  };
}

// =============================================================================
// Scenario — Float wrapper (for ScenarioResult shape parity)
// =============================================================================

/**
 * Float wrapper around the Decimal scenario. Provided for `runScenario`
 * dispatcher parity — the canonical path is Decimal (per Q-DEC). This
 * wrapper exists so callers still consuming `ScenarioResult` (number)
 * continue to work without a separate Float code path.
 */
export function salarySacrificeToSuperScenario(
  ctx: ScenarioContext,
  params: SalarySacrificeToSuperParams,
): ScenarioResult {
  const dec = salarySacrificeToSuperScenarioDecimal(ctx, params);
  const impacts: ScenarioImpact[] = dec.impacts.map((i) => ({
    label: i.label,
    before: i.before.toNumber(),
    after: i.after.toNumber(),
    delta: i.delta.toNumber(),
    format: i.format,
    direction: i.direction,
  }));
  return {
    type: 'salarySacrificeToSuper',
    title: dec.title,
    summary: dec.summary,
    impacts,
    warnings: dec.warnings,
    assumptions: dec.assumptions,
    computedAt: dec.computedAt,
  };
}

// Suppress unused-import lint for `getConcessionalCap` — re-exported so PR 2's
// UI slider-cap helper can import from this file (single import source for
// the salary-sacrifice surface).
export { getConcessionalCap };
