/**
 * Canonical PER-PROPERTY cashflow (MON-002 + MON-009).
 *
 * ONE source (CLAUDE.md §12.2.1) for a single property's rent / expenses /
 * loan cost / cashflow. Every property surface reads THIS — the property list
 * tile, the detail page, and (server-side) the master snapshot's per-property
 * metrics.
 *
 * The universal rule (Reza 2026-07-03, §19.1, via `monthlyResolver`): each
 * money line is a TRUE MONTHLY figure read from its reconciled transaction
 * dates — correct for any cadence (fortnightly rent, two loan repayments in a
 * month, a quarterly water rate) — with the declared amount×frequency as the
 * fallback only when there aren't enough transactions to read the cadence.
 *
 *   • RENT is resolved at the PROPERTY-STREAM level: ALL of the property's
 *     rental transactions are pooled into one stream, so a rental fragmented
 *     across several Income records (the "4 monthly rows" bug) is counted once
 *     and correctly, regardless of tenancy count.
 *   • EXPENSES and LOANS resolve per record (genuinely distinct lines).
 *
 * Basis (Reza 2026-07-03): the headline "Cashflow / yr" is ACTUALS-FIRST P&I
 * (rent − expenses − repayment). The tax position uses INTEREST-ONLY (principal
 * × rate — the deductible figure). Both are returned. Loan cost is NEVER
 * silently $0: actual repayment → manual minRepayment → interest floor.
 *
 * PURE: no DB, no fetch, no mutation. Modelled in the Neomatrix
 * (engine.propertyCashflow.computePropertyCashflow).
 */

import { toMonthly } from '@/lib/utils/frequencies';
import { resolveMonthly, type ResolverTx, type DetectedFrequency } from '@/lib/calculations/monthlyResolver';

const RENT_TYPES = new Set(['RENT', 'RENTAL']);

export interface CashflowIncome {
  id?: string;
  type: string;
  amount: number;
  frequency: string;
  /**
   * Calc-SSOT Wall B3 (MON-080 cashflow leg): 'MANAGED' marks an
   * agent-disbursed rental stream — its bank actuals are the NET payout
   * (gross − agent costs). The rent resolution grosses those actuals back
   * up by the stream's derived agent-cost run-rate so rent reads GROSS and
   * the fee is subtracted exactly once (in the expense loop), consistent
   * with the tax position. Undefined/null/'DIRECT' = the credit IS gross.
   */
  rentalMode?: string | null;
}
export interface CashflowExpense {
  id?: string;
  amount: number;
  frequency: string;
  /**
   * MON-037: one-off costs (`isRecurring === false` — a battery, a subdivision
   * fee, a paint job) are NOT part of the property's recurring run-rate. They
   * are excluded from the annualised Cashflow/yr (they show as an actual in the
   * month they occur, not ×frequency). Undefined/null/true = recurring (default)
   * — only an explicit `false` excludes; the `=== false` gate is null-safe, so a
   * nullable DB column maps straight in.
   */
  isRecurring?: boolean | null;
  /**
   * Calc-SSOT Wall B3: the managed rental stream this DERIVED agent-cost row
   * was reconciled from (Phase 59). Non-null identifies the fee rows the
   * rent gross-up adds back when rent actuals (net payouts) drove the rent
   * figure — the fee is then subtracted once, here in the expense loop.
   */
  derivedFromIncomeId?: string | null;
}
export interface CashflowLoan {
  id?: string;
  principal: number;
  interestRateAnnual: number; // DECIMAL, e.g. 0.0649 = 6.49%
  minRepayment?: number | null;
  repaymentFrequency?: string | null;
}
/** A reconciled transaction linked to one of the property's income/expense/loan rows. */
export interface CashflowTransaction extends ResolverTx {
  incomeId?: string | null;
  expenseId?: string | null;
  loanId?: string | null;
}

export interface PropertyCashflowInput {
  income?: CashflowIncome[];
  expenses?: CashflowExpense[];
  loans?: CashflowLoan[];
  /** Reconciled transactions for THIS property (actuals win over declared). */
  transactions?: CashflowTransaction[];
}

/**
 * One resolved expense line — the per-record intermediate the expense loop
 * already computes. Exposed (MON-005) so a UI surface can render each expense
 * row AND the header total from the SAME engine call: Σ expenseLines[].annual
 * === annualExpenses BY CONSTRUCTION (same loop, same `resolveMonthly`). This
 * is what keeps the per-property Expenses card reconciled with the canonical
 * total — no second producer (§12.2.1), no row-sum-vs-total drift (§19.4).
 */
export interface CashflowExpenseLine {
  id?: string;
  /** Actuals-first monthly figure for this record (reconciled when txns exist). */
  monthly: number;
  /** monthly × 12. */
  annual: number;
  /** True when reconciled transactions drove this line (vs the declared amount). */
  usedActuals: boolean;
}

/**
 * One resolved loan line (MON-032) — the engine's actual per-loan monthly cost
 * (actuals → declared minRepayment → interest floor). UI rows render THIS, never
 * the raw `minRepayment` (which prints "-$0" when unset while the engine charges
 * interest). Σ loanLines[].monthly === monthlyLoanRepayment by construction.
 */
export interface CashflowLoanLine {
  id?: string;
  /** The monthly loan cost the engine actually used (never silently $0). */
  monthly: number;
  usedActuals: boolean;
  /** True when neither actuals nor a manual repayment existed → interest floor. */
  flooredToInterest: boolean;
}

export interface PropertyCashflow {
  annualRent: number;
  annualExpenses: number;
  /** Per-record expense breakdown (MON-005) — sums to annualExpenses. */
  expenseLines: CashflowExpenseLine[];
  /** Per-loan resolved cost (MON-032) — sums to monthlyLoanRepayment. */
  loanLines: CashflowLoanLine[];
  /** P&I cash outflow — actuals-first, never $0 when a loan exists. */
  annualLoanRepayment: number;
  /** Interest only (principal × rate) — the deductible figure for tax. */
  annualLoanInterest: number;
  /** Headline: rent − expenses − repayment (cash basis). */
  annualCashflow: number;
  /** Tax: rent − expenses − interest. */
  annualTaxCashflow: number;
  // Monthly mirrors (everything is shown monthly — Reza 2026-07-03).
  monthlyRent: number;
  monthlyExpenses: number;
  monthlyLoanRepayment: number;
  monthlyCashflow: number;
  basis: 'actual' | 'declared' | 'mixed';
  usedActuals: { income: boolean; expenses: boolean; loans: boolean };
  /** Cadence detected from the rental transactions, for display ("fortnightly"). */
  detectedRentFrequency: DetectedFrequency | null;
  /**
   * MON-093 plausibility guard: the rental payments' observed rhythm
   * contradicts the row's DECLARED frequency (the Broadbeach class — a
   * monthly-magnitude amount declared WEEKLY). A mis-declared cadence is
   * SURFACED, never silently annualised. Null when no contradiction (or no
   * evidence).
   */
  rentCadenceSuspect: { declared: string; detected: DetectedFrequency } | null;
}

const txFor = (txs: CashflowTransaction[], pick: (t: CashflowTransaction) => string | null | undefined, id?: string) =>
  id == null ? [] : txs.filter((t) => pick(t) === id);

/** The resolved cost of carrying ONE loan for a month — the Wall's single
 *  producer (Mechanism B / MON-032 drift). */
export interface ResolvedLoanCost {
  /** actuals → declared minRepayment → INTEREST FLOOR. Never silently $0. */
  monthly: number;
  /** principal × rate ÷ 12 (the floor; also the interest component). */
  monthlyInterest: number;
  usedActuals: boolean;
  /** True when neither actuals nor a manual repayment existed → interest floor. */
  flooredToInterest: boolean;
}

/**
 * Calc-SSOT Wall B1 — THE canonical per-loan monthly cost
 * (docs/architecture/CALC_SSOT_WALL.md Mechanism B; MATRIX_FIX_DISCIPLINE
 * gate 1). Every surface that shows or sums a loan's monthly cost calls THIS
 * — never raw `minRepayment` (which prints $0 for an interest-only loan while
 * the borrower is charged interest every month). Resolution order:
 * reconciled actuals → declared minRepayment (cadence-normalised) →
 * interest floor (principal × rate ÷ 12 — the minimum true cost of carrying
 * the loan). Callers without transaction history pass none and get the
 * declared→floor path, which is already strictly more truthful than raw
 * minRepayment. The property cashflow loop consumes this same function —
 * one formula, one home (§12.2.1).
 */
export function resolveLoanMonthlyCost(
  l: CashflowLoan,
  transactions: CashflowTransaction[] = [],
): ResolvedLoanCost {
  const monthlyInterest = Math.max(0, (l.principal ?? 0) * (l.interestRateAnnual ?? 0)) / 12;
  const declaredRepayMonthly = (l.minRepayment ?? 0) > 0
    ? toMonthly(l.minRepayment as number, (l.repaymentFrequency ?? 'MONTHLY') as never)
    : 0;
  const r = resolveMonthly({
    declaredMonthly: declaredRepayMonthly,
    cadenceHintFrequency: l.repaymentFrequency ?? 'MONTHLY',
    transactions,
  });
  // Never silently $0: if neither actuals nor a manual repayment exist, floor
  // to interest (the minimum true cost of carrying the loan).
  const flooredToInterest = !(r.monthly > 0);
  return {
    monthly: flooredToInterest ? monthlyInterest : r.monthly,
    monthlyInterest,
    usedActuals: r.usedActuals,
    flooredToInterest,
  };
}

export function computePropertyCashflow(input: PropertyCashflowInput): PropertyCashflow {
  const income = input.income ?? [];
  const expenses = input.expenses ?? [];
  const loans = input.loans ?? [];
  const txs = input.transactions ?? [];

  let contributing = 0;
  let actualContributing = 0;
  const bump = (usedActuals: boolean) => {
    contributing++;
    if (usedActuals) actualContributing++;
  };

  // ── RENT — resolved at the property-STREAM level (all rental tx pooled) ──
  const rentalRows = income.filter((i) => RENT_TYPES.has(i.type));
  const rentalIds = new Set(rentalRows.map((r) => r.id).filter(Boolean) as string[]);
  const rentalTx = txs.filter((t) => t.incomeId != null && rentalIds.has(t.incomeId));
  const declaredRentalMonthly = rentalRows.reduce((s, r) => s + toMonthly(r.amount, r.frequency as never), 0);
  const rent = resolveMonthly({
    declaredMonthly: declaredRentalMonthly,
    cadenceHintFrequency: rentalRows[0]?.frequency ?? 'MONTHLY',
    transactions: rentalTx,
    isAdvance: true, // rent is paid in advance
  });

  // Calc-SSOT Wall B3 (MON-080 cashflow leg — kill the agent-fee DOUBLE-COUNT):
  // a MANAGED stream's bank actuals are the NET payout (gross − agent costs),
  // but the derived agent-cost expense is ALSO subtracted in the expense loop
  // below — pre-fix, the fee was subtracted twice on every cashflow surface.
  // When rent ACTUALS drove the figure, gross the actuals back up by the
  // stream's derived recurring fee run-rate: rent reads GROSS (net + fee),
  // the fee subtracts ONCE, and cashflow agrees with tax (declared gross −
  // derived deduction) by construction. When the DECLARED amount drove the
  // figure it already IS gross — no add-back. One-off anomaly excesses
  // (isRecurring === false) never enter the run-rate on either side.
  const managedStreamIds = new Set(
    rentalRows
      .filter((r) => r.rentalMode === 'MANAGED' && r.id)
      .map((r) => r.id as string),
  );
  const managedFeeAddBack = rent.usedActuals
    ? expenses.reduce(
        (s, e) =>
          e.derivedFromIncomeId != null &&
          managedStreamIds.has(e.derivedFromIncomeId) &&
          e.isRecurring !== false
            ? s + toMonthly(e.amount, e.frequency as never)
            : s,
        0,
      )
    : 0;

  const monthlyRent = rent.monthly + managedFeeAddBack;
  const incomeUsedActuals = rent.usedActuals;
  if (rentalRows.length > 0) bump(rent.usedActuals);

  // ── EXPENSES — per record ──
  let monthlyExpenses = 0;
  let expensesUsedActuals = false;
  const expenseLines: CashflowExpenseLine[] = [];
  for (const e of expenses) {
    // MON-037: a one-off is not a recurring monthly cost — it never enters the
    // run-rate total (it appears as an actual in its month, not ×frequency).
    if (e.isRecurring === false) continue;
    const r = resolveMonthly({
      declaredMonthly: toMonthly(e.amount, e.frequency as never),
      cadenceHintFrequency: e.frequency,
      transactions: txFor(txs, (t) => t.expenseId, e.id),
    });
    monthlyExpenses += r.monthly;
    // Same loop, same resolver → the per-record breakdown is the total,
    // decomposed. Σ expenseLines[].annual === annualExpenses by construction.
    expenseLines.push({ id: e.id, monthly: r.monthly, annual: r.monthly * 12, usedActuals: r.usedActuals });
    if (r.usedActuals) expensesUsedActuals = true;
    bump(r.usedActuals);
  }

  // ── LOANS — per record; repayment never silently $0 (the ONE producer) ──
  let monthlyLoanRepayment = 0;
  let annualLoanInterest = 0;
  let loansUsedActuals = false;
  const loanLines: CashflowLoanLine[] = [];
  for (const l of loans) {
    const loanTx = txFor(txs, (t) => t.loanId, l.id);
    const rc = resolveLoanMonthlyCost(l, loanTx);
    annualLoanInterest += rc.monthlyInterest * 12;
    monthlyLoanRepayment += rc.monthly;
    // MON-032: expose the resolved per-loan cost so UI rows mirror the engine
    // (never render raw minRepayment — it prints "-$0" while we charge interest).
    loanLines.push({ id: l.id, monthly: rc.monthly, usedActuals: rc.usedActuals, flooredToInterest: rc.flooredToInterest });
    if (rc.usedActuals) loansUsedActuals = true;
    bump(rc.usedActuals);
  }

  const monthlyCashflow = monthlyRent - monthlyExpenses - monthlyLoanRepayment;
  const annualRent = monthlyRent * 12;
  const annualExpenses = monthlyExpenses * 12;
  const annualLoanRepayment = monthlyLoanRepayment * 12;

  const basis: PropertyCashflow['basis'] =
    actualContributing === 0 ? 'declared' : actualContributing === contributing ? 'actual' : 'mixed';

  // MON-093: cadence plausibility — when the payments' observed rhythm and
  // the declared frequency disagree, flag it (nudge; nothing auto-changes).
  const declaredRentFrequency = rentalRows[0]?.frequency ?? null;
  const rentCadenceSuspect =
    rent.usedActuals &&
    rent.detectedFrequency &&
    rent.detectedFrequency !== 'IRREGULAR' &&
    declaredRentFrequency &&
    String(declaredRentFrequency).toUpperCase() !== rent.detectedFrequency
      ? { declared: String(declaredRentFrequency), detected: rent.detectedFrequency }
      : null;

  return {
    annualRent,
    annualExpenses,
    expenseLines,
    loanLines,
    annualLoanRepayment,
    annualLoanInterest,
    annualCashflow: annualRent - annualExpenses - annualLoanRepayment,
    annualTaxCashflow: annualRent - annualExpenses - annualLoanInterest,
    monthlyRent,
    monthlyExpenses,
    monthlyLoanRepayment,
    monthlyCashflow,
    basis,
    usedActuals: { income: incomeUsedActuals, expenses: expensesUsedActuals, loans: loansUsedActuals },
    detectedRentFrequency: rent.detectedFrequency,
    rentCadenceSuspect,
  };
}
