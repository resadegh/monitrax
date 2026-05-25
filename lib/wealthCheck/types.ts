/**
 * Phase 46 — Shared types for the /wealth-check calc + lever surfaces.
 *
 * Pure types, no I/O. Reused by `lib/wealthCheck/calculator.ts`,
 * `lib/wealthCheck/lever.ts`, and `app/wealth-check/page.tsx`.
 */

export type NetWorthBand =
  | 'under-50k'
  | '50k-200k'
  | '200k-500k'
  | '500k-1m'
  | '1m-2m'
  | '2m-plus';

export type AgeBand = '25-34' | '35-44' | '45-54' | '55-64' | '65+';

export type HouseholdShape = 'single' | 'couple';

export interface WealthCheckInput {
  /** 25–65 inclusive. */
  age: number;
  /** Annual gross household income in AUD. Slider range $40k–$400k+. */
  householdIncome: number;
  /** Net-worth quick-pick band. */
  netWorthBand: NetWorthBand;
}

export interface WealthCheckResult {
  // Inputs echoed for traceability + sharing
  input: WealthCheckInput;
  // Derived shape inputs
  ageBand: AgeBand;
  householdShape: HouseholdShape;
  yearsToRetirement: number;
  // Snapshot estimates
  currentNetWorthMidpoint: number;
  currentSuperEstimate: number;
  // Projection (in today's dollars, real terms)
  projectedSuperAt67: number;
  projectedNonSuperAt67: number;
  projectedTotalAt67: number;
  // Targets — both shown on result page for context
  asfaTarget: number;
  /**
   * 70% income-replacement target (4% safe-withdrawal rule).
   * = householdIncome × 0.7 × 25. The "wealth-builder" anchor — what it
   * actually takes to maintain something close to current lifestyle.
   * For most users this is meaningfully higher than ASFA comfortable.
   */
  lifestyleTarget: number;
  /** Gap = max(0, lifestyleTarget − projectedTotal). The headline gap. */
  gap: number;
  /**
   * Did the projection beat the ASFA comfortable baseline? Drives the
   * result-page framing ("comfortable is in the bag — here's the real target").
   */
  beatsAsfaTarget: boolean;
  /** 0–100, where the user sits within their age band's net-worth distribution. */
  percentile: number;
  // Surfaced assumptions (for the assumptions panel)
  assumptions: {
    realReturnRate: number;
    sgRate: number;
    estimatedSavingsRate: number;
    asfaTargetSource: string;
    asfaTargetDate: string;
  };
}

export type LeverKind =
  | 'salary-sacrifice-young' // age < 40
  | 'super-and-debt-mid' // 40-54
  | 'catch-up-late' // 55+
  | 'already-on-track'; // gap <= 0

export interface LeverRecommendation {
  kind: LeverKind;
  /** Short headline, e.g. "Salary-sacrifice $250/mo to super". */
  title: string;
  /** Monthly $ amount the lever requires from the user. */
  monthlyAmount: number;
  /** Estimated $ of the gap this lever closes over the remaining years. */
  gapCloseEstimate: number;
  /**
   * Honest body copy — names the mechanism, the math, and the timeframe.
   * Never says "you should". Never names a product. AFSL-safe.
   */
  body: string;
  /**
   * If true, the result framing softens (Klontz-avoidance — the gap is too
   * large for any single lever to close on its own).
   */
  softFraming: boolean;
}
