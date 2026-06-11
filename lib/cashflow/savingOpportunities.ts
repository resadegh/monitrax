/**
 * Saving Opportunities Detector — Phase 45.8
 *
 * Pure function: takes a master financial snapshot and surfaces the top
 * cross-account / cross-property savings opportunities the user could act on
 * this month. Solves Reza's stated pain point (2026-06-11): "due to having
 * multiple accounts and properties it is very hard for me to pinpoint where
 * my money is going and if there are any saving opportunities available".
 *
 * The detector covers three high-impact opportunity types in v1 — each is a
 * conservative, evidence-based estimate, never a manufactured promise:
 *
 *   1. HISA upgrade — cash sitting in low-yield savings accounts that could
 *      earn more in a market-leading high-interest account.
 *   2. Offset link — surplus liquid cash that could be redirected into a
 *      home loan offset account to reduce non-deductible interest.
 *   3. Salary sacrifice — under-utilised concessional super cap (the wedge
 *      between current concessional contributions and the FY27 $30k cap).
 *
 * Each opportunity returns an estimated annual benefit, the rationale, and
 * the canonical CTA route. Numbers are conservative estimates with the
 * assumptions documented inline — this is decision support, not a guarantee.
 *
 * Per CLAUDE.md §0 financial-adviser lens: every number must be traceable
 * to canonical engine data; never invent a number, never imply a specific
 * product, never use false-precision urgency framing.
 */

import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

export type OpportunityKind = 'HISA_UPGRADE' | 'OFFSET_LINK' | 'SALARY_SACRIFICE';

export interface SavingOpportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  rationale: string;
  estimatedAnnualBenefit: number;
  cta: string;
  ctaUrl: string;
}

export interface SavingOpportunitiesResult {
  opportunities: SavingOpportunity[];
  totalEstimatedAnnualBenefit: number;
}

// Conservative v1 assumptions — documented so a reviewer can audit them.
// All rates are illustrative comparisons against the user's apparent
// position; the UI must never imply a guaranteed return or a specific
// product.
const HISA_OPPORTUNITY_RATE_GAP = 0.025; // 2.5pp uplift vs low-yield account
const HISA_OPPORTUNITY_MIN_BALANCE = 5_000; // below this, the benefit is too small to surface
const OFFSET_OPPORTUNITY_MIN_LOAN_RATE = 0.055; // assume non-deductible rate ≥5.5% to surface
const OFFSET_OPPORTUNITY_MIN_BENEFIT = 200; // suppress sub-$200/yr nudges
const SUPER_CONCESSIONAL_CAP_FY27 = 30_000; // canonical cap (taxYearConfig.ts)
const SUPER_CONCESSIONAL_MIN_WEDGE = 2_000; // suppress sub-$2k/yr wedges (noise)
const ASSUMED_MARGINAL_RATE_FOR_SUPER_SAVING = 0.30; // conservative: 32.5% bracket minus 15% super tax ≈ 17.5pp; use 0.30 as marginal proxy and net the 15% super tax separately below

/**
 * Detect a HISA upgrade opportunity.
 *
 * Heuristic: if the user holds ≥$5k in SAVINGS-type accounts AND the implied
 * yield (interest income / average balance) suggests sub-3% rates, flag a
 * potential 2.5pp uplift. v1 uses balance only as a proxy for "could be
 * earning more" — a future pass can read actual interest income per account
 * once the canonical income aggregator surfaces per-account interest.
 */
function detectHisaUpgrade(snapshot: MasterFinancialSnapshot): SavingOpportunity | null {
  // The Net Worth result already classifies savings balances. Use liquid cash
  // as the conservative proxy — never investments or transactional accounts.
  const liquidCash = snapshot.quickMetrics.liquidCash;
  if (liquidCash < HISA_OPPORTUNITY_MIN_BALANCE) return null;

  const annualBenefit = Math.round(liquidCash * HISA_OPPORTUNITY_RATE_GAP);
  if (annualBenefit < HISA_OPPORTUNITY_MIN_BALANCE * HISA_OPPORTUNITY_RATE_GAP) return null;

  return {
    id: 'hisa-upgrade',
    kind: 'HISA_UPGRADE',
    title: 'High-interest savings upgrade',
    rationale: `You're holding ${formatCurrencyShort(liquidCash)} in liquid cash. Moving it to a market-leading high-interest savings account could earn ~${(HISA_OPPORTUNITY_RATE_GAP * 100).toFixed(1)}pp more per year.`,
    estimatedAnnualBenefit: annualBenefit,
    cta: 'Compare HISA rates',
    ctaUrl: '/dashboard/accounts',
  };
}

/**
 * Detect an offset-link opportunity.
 *
 * Heuristic: if the user has a non-investment loan (typically home loan) AND
 * surplus liquid cash above a reasonable emergency-fund buffer (3 months
 * essentials), flag the potential interest saving from redirecting that
 * surplus to the offset. The "non-investment loan" filter is critical — we
 * never recommend offsetting an investment loan because that converts
 * deductible interest into a non-deductible position.
 */
function detectOffsetLink(snapshot: MasterFinancialSnapshot): SavingOpportunity | null {
  // Use the master debt aggregation. v1 derives non-investment loan balance
  // by summing `byType` rows that DON'T include "INVESTMENT" — never offset
  // an investment loan (converts deductible interest into a non-deductible
  // position). If the aggregator surfaces per-loan deductibility later,
  // switch to that.
  const debtSummary = snapshot.debt.summary;
  let nonInvestmentLoanBalance = 0;
  for (const [type, agg] of Object.entries(debtSummary.byType ?? {})) {
    if (!type.toUpperCase().includes('INVESTMENT')) {
      nonInvestmentLoanBalance += Number(agg.principal ?? 0);
    }
  }
  if (nonInvestmentLoanBalance < 50_000) return null; // small home-loan tail isn't worth surfacing

  // Conservative buffer: 3 months of essential monthly expenses must stay
  // liquid before we suggest moving any cash to offset.
  const monthlyEssentials = snapshot.expenses.monthly.essential.total;
  const safetyBuffer = monthlyEssentials * 3;
  const liquidCash = snapshot.quickMetrics.liquidCash;
  const surplusForOffset = Math.max(0, liquidCash - safetyBuffer);
  if (surplusForOffset < 5_000) return null;

  // Interest saved = surplus × assumed loan rate. v1 uses the conservative
  // OFFSET_OPPORTUNITY_MIN_LOAN_RATE (5.5%) regardless of actual rate
  // because the master debt summary doesn't expose a weighted-avg rate.
  // Cap surplusForOffset at the loan balance — you can't offset more than
  // you owe.
  const offsettableAmount = Math.min(surplusForOffset, nonInvestmentLoanBalance);
  const annualBenefit = Math.round(offsettableAmount * OFFSET_OPPORTUNITY_MIN_LOAN_RATE);
  if (annualBenefit < OFFSET_OPPORTUNITY_MIN_BENEFIT) return null;

  return {
    id: 'offset-link',
    kind: 'OFFSET_LINK',
    title: 'Home loan offset top-up',
    rationale: `${formatCurrencyShort(offsettableAmount)} of your liquid cash sits beyond a 3-month safety buffer. Parking it in your home loan offset would reduce non-deductible interest at ~${(OFFSET_OPPORTUNITY_MIN_LOAN_RATE * 100).toFixed(1)}% — without locking up the cash.`,
    estimatedAnnualBenefit: annualBenefit,
    cta: 'Review offset accounts',
    ctaUrl: '/dashboard/loans',
  };
}

/**
 * Detect a salary-sacrifice opportunity.
 *
 * Heuristic: if the user's annual gross income > $90k (32.5% bracket+) AND
 * their estimated concessional contributions for the year are below the
 * $30k FY27 cap, surface the wedge as a salary-sacrifice opportunity. v1
 * uses an income-based proxy because the master snapshot doesn't currently
 * surface per-employer SG + concessional contributions. A future pass can
 * read the actual super module data.
 *
 * Tax saving = wedge × (marginal rate − 15% super tax).
 */
function detectSalarySacrifice(snapshot: MasterFinancialSnapshot): SavingOpportunity | null {
  const annualGrossIncome = snapshot.income.annual.all.grossTotal;
  if (annualGrossIncome < 90_000) return null;

  // Conservative SG-only proxy: assume current concessional ≈ 11.5% SG of
  // gross income (capped at the income tax cap). If the master snapshot
  // adds a `concessionalYTD` field later, swap this proxy for the real
  // figure.
  const sgRate = 0.115;
  const estimatedConcessional = Math.min(annualGrossIncome * sgRate, SUPER_CONCESSIONAL_CAP_FY27);
  const wedge = SUPER_CONCESSIONAL_CAP_FY27 - estimatedConcessional;
  if (wedge < SUPER_CONCESSIONAL_MIN_WEDGE) return null;

  // Net tax saving = wedge × (marginal − super tax). v1 uses an assumed 30%
  // marginal as a conservative proxy across the 32.5%/37% brackets.
  const taxSavingPerDollar = Math.max(0, ASSUMED_MARGINAL_RATE_FOR_SUPER_SAVING - 0.15);
  const annualBenefit = Math.round(wedge * taxSavingPerDollar);
  if (annualBenefit < SUPER_CONCESSIONAL_MIN_WEDGE * taxSavingPerDollar) return null;

  return {
    id: 'salary-sacrifice',
    kind: 'SALARY_SACRIFICE',
    title: 'Salary-sacrifice to super',
    rationale: `Your concessional super contributions look ~${formatCurrencyShort(wedge)} below the ${formatCurrencyShort(SUPER_CONCESSIONAL_CAP_FY27)}/yr cap. Topping up could save ~${(taxSavingPerDollar * 100).toFixed(0)}c per dollar in tax.`,
    estimatedAnnualBenefit: annualBenefit,
    cta: 'Explore salary sacrifice',
    ctaUrl: '/dashboard/income',
  };
}

function formatCurrencyShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${Math.round(amount / 1_000)}k`;
  }
  return `$${Math.round(amount).toLocaleString('en-AU')}`;
}

/**
 * Public entry point — pure function. Pass a master snapshot; receive a
 * stable, deterministic list of opportunities sorted by estimated annual
 * benefit. Empty array is a valid (and celebrated) state.
 */
export function detectSavingOpportunities(snapshot: MasterFinancialSnapshot): SavingOpportunitiesResult {
  const opportunities: SavingOpportunity[] = [];
  const hisa = detectHisaUpgrade(snapshot);
  if (hisa) opportunities.push(hisa);
  const offset = detectOffsetLink(snapshot);
  if (offset) opportunities.push(offset);
  const salarySac = detectSalarySacrifice(snapshot);
  if (salarySac) opportunities.push(salarySac);

  opportunities.sort((a, b) => b.estimatedAnnualBenefit - a.estimatedAnnualBenefit);

  const totalEstimatedAnnualBenefit = opportunities.reduce(
    (sum, opp) => sum + opp.estimatedAnnualBenefit,
    0,
  );

  return { opportunities, totalEstimatedAnnualBenefit };
}
