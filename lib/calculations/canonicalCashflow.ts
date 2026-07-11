/**
 * Canonical monthly cashflow accessor — the ONE place that decides
 * "money in / out / net for this month" for every surface in the app.
 *
 * WHY THIS EXISTS (CLAUDE.md §6.1 / §12.2 / §12.3 / §19.1)
 * --------------------------------------------------------
 * SSOT was documented but never *enforced*. Multiple routes each chose
 * their own basis for cashflow: some read DECLARED records (Income /
 * Expense / Loan × frequency), some read ACTUAL transactions, and some
 * mixed the two within a single tile. The result: two cashflow tiles on
 * the same page showed different — and, for declared surfaces, falsely
 * optimistic — numbers (declared drops uncategorised/unlinked OUT
 * transactions; see actualCashflow.ts).
 *
 * THE RULE (CLAUDE.md §19.1)
 * --------------------------
 * When the user has actual transactions in the window, EVERY flow figure
 * derives from them (`hasActualData === true` → basis 'actual'). Declared
 * records are the fallback ONLY when no transactions exist (basis
 * 'declared'). Transfers are already excluded and uncategorised OUT is
 * already included upstream in computeActualCashflow().
 *
 * Every cashflow-emitting route MUST call getCanonicalMonthlyCashflow()
 * and MUST NOT re-derive in/out/net from records. The drift guard at
 * tests/calculations/canonicalCashflow.test.ts pins the contract.
 *
 * @see lib/calculations/actualCashflow.ts  — produces the actual figures
 * @see lib/services/masterFinancialService.ts — surfaces them on quickMetrics
 */
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

/** The basis a canonical figure was computed from. */
export type CashflowBasis = 'actual' | 'declared';

export interface CanonicalMonthlyCashflow {
  /** Money IN this month (net pay landing in accounts when actual). */
  inflow: number;
  /** Money OUT this month — expenses + loan repayments + uncategorised. */
  outflow: number;
  /** inflow − outflow. Can be negative (a real deficit). */
  net: number;
  /** net / inflow × 100. 0 when there is no inflow. */
  savingsRate: number;
  /**
   * Smoothed monthly OUT for rate / runway / emergency-fund tiles.
   * Actual trailing-average when present; declared outflow otherwise.
   */
  avgMonthlyOutflow: number;
  /** Where these numbers came from — surface this so the UI never lies. */
  basis: CashflowBasis;
}

/** Actual-transaction inputs (from computeActualCashflow). */
export interface ActualCashflowInputs {
  hasActualData: boolean;
  inflow: number;
  outflow: number;
  net: number;
  /** Trailing-average OUT for rate/runway tiles. */
  avgOutflow: number;
}

/** Declared-record inputs (the plan side — fallback only). */
export interface DeclaredCashflowInputs {
  inflow: number;
  /** Total monthly OUT = expenses + loan repayments. */
  outflow: number;
  net: number;
}

/**
 * The ONE rule (CLAUDE.md §19.1): actuals win when present, declared
 * fallback otherwise. This is the only place the rule is implemented —
 * both the snapshot convenience accessor and any route that computes
 * actuals locally (e.g. portfolio/snapshot) call through here so the
 * answer can never drift between surfaces.
 */
export function resolveCanonicalCashflow(
  actual: ActualCashflowInputs,
  declared: DeclaredCashflowInputs
): CanonicalMonthlyCashflow {
  if (actual.hasActualData) {
    return {
      inflow: actual.inflow,
      outflow: actual.outflow,
      net: actual.net,
      savingsRate: actual.inflow > 0 ? (actual.net / actual.inflow) * 100 : 0,
      // Trailing average for rate/runway; fall to the current-month outflow if
      // the average is empty (sparse history) so we never report a false 0.
      avgMonthlyOutflow: actual.avgOutflow > 0 ? actual.avgOutflow : actual.outflow,
      basis: 'actual',
    };
  }
  return {
    inflow: declared.inflow,
    outflow: declared.outflow,
    net: declared.net,
    savingsRate: declared.inflow > 0 ? (declared.net / declared.inflow) * 100 : 0,
    avgMonthlyOutflow: declared.outflow,
    basis: 'declared',
  };
}

/** Minimal slice of the snapshot this accessor needs. */
type CashflowSource = Pick<MasterFinancialSnapshot, 'cashflow' | 'quickMetrics'>;

/**
 * The canonical monthly cashflow for a master snapshot.
 *
 * Actual when `quickMetrics.hasActualData` is true; declared fallback
 * otherwise. Declared outflow = expenses + loan repayments (loan
 * repayments are real money out, counted in the actual OUT total too).
 */
export function getCanonicalMonthlyCashflow(
  snapshot: CashflowSource
): CanonicalMonthlyCashflow {
  const qm = snapshot.quickMetrics;
  const cf = snapshot.cashflow;
  return resolveCanonicalCashflow(
    {
      hasActualData: qm.hasActualData,
      inflow: qm.actualMonthlyInflow,
      outflow: qm.actualMonthlyOutflow,
      net: qm.actualNetCashflow,
      avgOutflow: qm.actualAvgMonthlyOutflow,
    },
    {
      inflow: cf.monthlyNetIncome,
      outflow: cf.monthlyExpenses + cf.monthlyLoanRepayments,
      net: cf.monthlyCashflow,
    }
  );
}

/** Minimal slice of the money-story trend the savings-rate accessor needs. */
export interface TrailingSavingsSource {
  trailingMonthsWithData: number;
  annualIncome: number;
  annualOutgoings: number;
  savingsRateTrailing: number;
}

/**
 * THE canonical savings rate (MON-029) — ONE selection rule for every surface.
 *
 * VR-001 (2026-07-11) found THREE contradictory savings rates on screen at
 * once: 75.4% (CFO — declared `quickMetrics.savingsRate`), −30.5% (Home KPI —
 * trailing-12-month actuals), 0.0% (Home "Low Savings Rate" insight —
 * current-in-progress-month actuals). Three producers, three bases.
 *
 * This accessor encodes the Phase 57 headline rule ONCE: trailing-12-month
 * ACTUALS when transaction history exists (the honest, stable figure), else the
 * declared plan (net-income basis). Every surface that says "savings rate"
 * reads THIS — the CFO monthly-progress card, the Home KPI tile, and the Home
 * insight — so they can never diverge again.
 */
export function getCanonicalSavingsRate(
  snapshot: CashflowSource,
  trend?: TrailingSavingsSource | null
): { rate: number; basis: 'actual-ttm' | 'declared' } {
  const hasTrailing =
    !!trend &&
    trend.trailingMonthsWithData > 0 &&
    (trend.annualIncome > 0 || trend.annualOutgoings > 0);
  if (hasTrailing && trend) {
    return { rate: trend.savingsRateTrailing, basis: 'actual-ttm' };
  }
  const inM = snapshot.quickMetrics.monthlyIncome;
  const outM = snapshot.quickMetrics.monthlyExpenses + snapshot.quickMetrics.monthlyLoanRepayments;
  return { rate: inM > 0 ? ((inM - outM) / inM) * 100 : 0, basis: 'declared' };
}

/**
 * Project a balance forward `days` days using a canonical monthly net (MON-021).
 *
 * The ONE forward-projection formula (CLAUDE.md §12.2.1): a linear roll-forward
 * of the current balance by the canonical monthly net (`getCanonicalMonthlyCashflow`),
 * spread evenly across a 30-day month. Every forecast SUMMARY tile — the /cashflow
 * "30-Day Forecast" and My Guide's "Month-End Balance" — projects through here off
 * the SAME `net`, so the two can only ever differ by their (labelled) horizon, never
 * by method. Before MON-021 My Guide used a crude expenses-only, declared, income-
 * blind burn (`totalLiquid − dailyBurn × daysRemaining`) that contradicted the
 * canonical /cashflow forecast by tens of thousands of dollars.
 *
 * @param currentBalance start balance (the account base)
 * @param monthlyNet     canonical monthly net inflow−outflow (actuals-aware)
 * @param days           horizon in days (e.g. 30, or days remaining to month-end)
 */
export function projectBalanceForward(
  currentBalance: number,
  monthlyNet: number,
  days: number
): number {
  return currentBalance + (monthlyNet / 30) * days;
}
