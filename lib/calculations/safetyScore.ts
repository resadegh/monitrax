/**
 * Safety Net score — the 0-100 "financial anchor" score for TRAIL Stage A.
 *
 * MON-017: extracted from the inline `/api/safety-net` handler, which produced a
 * FICTION score on real data:
 *   - awarded "Positive Cashflow 15/15" from a MIXED source (declared income −
 *     actual outflow) that read positive while the canonical cashflow was
 *     negative;
 *   - awarded "Bills on time 30/30" for ZERO tracked bills (full marks for
 *     missing data);
 *   - measured emergency-fund coverage against a hardcoded 3-month target while
 *     the canonical master snapshot uses 6 months (two sources of truth).
 *
 * This pure engine takes CANONICAL inputs only (emergency-fund coverage from the
 * master snapshot, and the actuals-aware monthly cashflow) so every safety score
 * is honest and traceable. Grade thresholds unchanged.
 *
 * Known remaining placeholder (NOT fabricated by this PR — pre-existing, no data
 * source yet): `noNewDebt` is an optimistic 15/15 "assume no new consumer debt"
 * until transaction-based new-debt detection ships. Tracked separately; flagged
 * so it isn't mistaken for a measured value.
 */

export type SafetyGrade = 'STRONG' | 'BUILDING' | 'FRAGILE' | 'AT RISK';

export interface SafetyScoreInput {
  /** Emergency-fund months covered — from `snapshot.emergencyFund.monthsCovered`. */
  monthsCovered: number;
  /** Emergency-fund target months — from `snapshot.emergencyFund.targetMonths` (canonical = 6). */
  targetMonths: number;
  /** Count of active (non-paused) tracked recurring bills. */
  billsOnTime: number;
  /** Total tracked recurring bills. 0 → the bills dimension scores 0 (earn it by tracking bills). */
  totalBills: number;
  /**
   * CANONICAL actuals-aware monthly net cashflow — `getCanonicalMonthlyCashflow(snapshot).net`
   * (MON-017 residual, VR-001: `quickMetrics.monthlyCashflow` is the DECLARED figure and
   * read positive while actual cashflow was −$6,073/mo — never wire that in here).
   * Drives the "positive cashflow" dimension AND recovery honesty. Negative when
   * the user is spending more than they earn (the score must reflect that).
   */
  monthlyCashflow: number;
}

export interface SafetyDimension {
  score: number;
  max: number;
}

export interface SafetyScoreResult {
  emergencyFund: SafetyDimension;
  billsOnTime: SafetyDimension;
  noNewDebt: SafetyDimension;
  positiveCashflow: SafetyDimension;
  total: number;
  grade: SafetyGrade;
}

export function computeSafetyScore(input: SafetyScoreInput): SafetyScoreResult {
  // Emergency fund (max 40): linear to the canonical target, capped.
  const emergencyFundScore =
    input.targetMonths > 0 ? Math.min((input.monthsCovered / input.targetMonths) * 40, 40) : 0;

  // Bills on time (max 30): MON-017 — ZERO tracked bills is NOT full marks. No
  // tracked bills → no evidence of on-time payment → 0 (earn it by tracking bills).
  const billsScore = input.totalBills > 0 ? (input.billsOnTime / input.totalBills) * 30 : 0;

  // No new debt (max 15): optimistic default — new-consumer-debt detection isn't
  // built yet (no data source). Flagged as a known placeholder, not a measured value.
  const noNewDebtScore = 15;

  // Positive cashflow (max 15): MON-017 — reads the CANONICAL actuals-aware net
  // cashflow, so a real deficit scores 0 (was a mixed-source surplus that read
  // positive while the real cashflow was negative).
  const cashflowScore = input.monthlyCashflow > 0 ? 15 : input.monthlyCashflow > -200 ? 8 : 0;

  const total = Math.round(emergencyFundScore + billsScore + noNewDebtScore + cashflowScore);

  const grade: SafetyGrade =
    total >= 80 ? 'STRONG' : total >= 60 ? 'BUILDING' : total >= 40 ? 'FRAGILE' : 'AT RISK';

  return {
    emergencyFund: { score: Math.round(emergencyFundScore), max: 40 },
    billsOnTime: { score: Math.round(billsScore), max: 30 },
    noNewDebt: { score: noNewDebtScore, max: 15 },
    positiveCashflow: { score: cashflowScore, max: 15 },
    total,
    grade,
  };
}
