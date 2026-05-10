/**
 * alertEngine — Phase 32B PR3 #9a
 *
 * The pure, deterministic core of the Practice "needs attention today"
 * alert stream. Given a client's current financial snapshot (projected
 * into the small `AlertEngineSnapshot` shape — NOT the full
 * `MasterFinancialSnapshot`, to keep this module decoupled + testable)
 * plus optional prior-sweep state for the delta-based triggers, returns
 * the list of triggered alerts.
 *
 * Five v1 triggers:
 *   • CASHFLOW_NEGATIVE      — stateless: monthly net cashflow < 0
 *   • EMERGENCY_FUND_LOW     — stateless: emergency-fund coverage < 1 month
 *   • LVR_REFINANCE_WINDOW   — stateless: 0 < portfolio LVR < 80% AND
 *                              usable equity ≥ a meaningful floor
 *   • HEALTH_DROP            — stateful: prior health score − current ≥ 10
 *   • TRAIL_ADVANCED         — stateful: current TRAIL stage is later
 *                              than the prior stage
 *
 * The two stateful triggers gracefully no-op when `prior` is null /
 * absent (first-ever sweep for a client, or v1a where the
 * ClientSnapshotMarker hasn't been populated yet) — they need a
 * baseline to compare against, and "advanced from nothing" / "dropped
 * from nothing" aren't meaningful.
 *
 * `enabledTriggers` gates which trigger kinds run — each profession
 * surfaces a different default set (see `lib/portal/practice/professionConfig.ts`).
 *
 * Pure. No DB, no fetch, no Date.now() side effects (the caller passes
 * any timestamps it needs into the persistence layer). All numeric
 * thresholds are constants in this file — single source of truth.
 *
 * Privacy: `payload` carries only AGGREGATE context numbers (health
 * delta, monthly cashflow, LVR, usable equity, stage letters). No raw
 * CDR transactions, no per-account balances (CLAUDE.md §13.3).
 *
 * @see app/api/portal/alerts/sweep/route.ts (the runner)
 * @see lib/portal/practice/professionConfig.ts (per-profession trigger sets)
 * @see docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md (PR3 #9)
 */

export type AlertSeverity = 'critical' | 'opportunity' | 'milestone';

/** TRAIL stage letters, in journey order. */
export type TrailStageLetter = 'T' | 'R' | 'A' | 'I' | 'L';
export const TRAIL_STAGE_ORDER: readonly TrailStageLetter[] = ['T', 'R', 'A', 'I', 'L'];

/**
 * The v1 trigger kinds this engine computes. A subset of the broader
 * `AlertTriggerKind` union in `lib/portal/practice/lighthouseDataset.ts`
 * (which also has fixture-only kinds like PROPERTY_ADDED / BAS_DUE that
 * v1 doesn't compute yet).
 */
export type AlertTriggerKind =
  | 'CASHFLOW_NEGATIVE'
  | 'EMERGENCY_FUND_LOW'
  | 'LVR_REFINANCE_WINDOW'
  | 'HEALTH_DROP'
  | 'TRAIL_ADVANCED';

/** Every kind this engine knows how to compute (for validation/iteration). */
export const ALL_ENGINE_TRIGGER_KINDS: readonly AlertTriggerKind[] = [
  'CASHFLOW_NEGATIVE',
  'EMERGENCY_FUND_LOW',
  'LVR_REFINANCE_WINDOW',
  'HEALTH_DROP',
  'TRAIL_ADVANCED',
];

/** The minimal projection of a client's financial state this engine needs. */
export interface AlertEngineSnapshot {
  /** monthly net cashflow (income − expenses − loan repayments) */
  monthlyCashflow: number;
  /** monthly net income (after PAYG) */
  monthlyIncome: number;
  /** monthly total expenses */
  monthlyExpenses: number;
  /** emergency-fund coverage in months (liquid cash ÷ monthly expenses) */
  emergencyFundMonths: number;
  /** total current value of the property portfolio */
  propertyPortfolioValue: number;
  /** total equity across the property portfolio (value − loan balances) */
  propertyPortfolioEquity: number;
  /** total mortgage balance secured against the property portfolio */
  mortgageBalance: number;
  /** financial health score 0–100 */
  healthScore: number;
  /** current TRAIL stage */
  trailStage: TrailStageLetter;
}

/** Prior-sweep state for the delta-based triggers. */
export interface AlertEnginePriorState {
  /** healthScore at the last sweep, or null if never recorded */
  healthScore: number | null;
  /** TRAIL stage at the last sweep, or null if never recorded */
  trailStage: TrailStageLetter | null;
}

export interface AlertEngineInput {
  snapshot: AlertEngineSnapshot;
  prior?: AlertEnginePriorState | null;
  /** Trigger kinds this org's profession surfaces. Others are skipped. */
  enabledTriggers: readonly AlertTriggerKind[];
}

export interface ComputedAlert {
  triggerKind: AlertTriggerKind;
  severity: AlertSeverity;
  headline: string;
  body: string;
  /** one-line "Health 42 ↓18 · cashflow -$340/mo" style context */
  context: string;
  primaryActionLabel: string;
  /** aggregate context numbers the UI may render — never raw CDR data */
  payload: Record<string, number | string>;
}

// =============================================================================
// THRESHOLDS — single source of truth
// =============================================================================

/** A health-score drop of this many points (or more) since the last sweep fires HEALTH_DROP. */
export const HEALTH_DROP_THRESHOLD = 10;
/** Portfolio LVR strictly below this percentage is "in the refinance window". */
export const LVR_REFINANCE_CEILING = 80;
/** Below this much usable equity, a refinance isn't worth flagging. */
export const LVR_MIN_USABLE_EQUITY_AUD = 20_000;

// =============================================================================
// HELPERS
// =============================================================================

/** Round to a whole dollar for context strings. */
function aud(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toLocaleString('en-AU')}`;
}

/** Round to 1 decimal place. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Index of a TRAIL stage in journey order; −1 if unknown. */
function stageRank(stage: TrailStageLetter | null | undefined): number {
  if (!stage) return -1;
  return TRAIL_STAGE_ORDER.indexOf(stage);
}

const STAGE_NAME: Record<TrailStageLetter, string> = {
  T: 'TRACK',
  R: 'REDUCE',
  A: 'ANCHOR',
  I: 'INVEST',
  L: 'LIVE',
};

// =============================================================================
// TRIGGER DETECTORS — each returns a ComputedAlert or null
// =============================================================================

function detectCashflowNegative(s: AlertEngineSnapshot): ComputedAlert | null {
  if (s.monthlyCashflow >= 0) return null;
  const deficit = Math.abs(s.monthlyCashflow);
  return {
    triggerKind: 'CASHFLOW_NEGATIVE',
    severity: 'critical',
    headline: 'Monthly cashflow turned negative',
    body: `Net ${aud(s.monthlyCashflow)}/mo on the latest snapshot. Spending and repayments are outrunning income.`,
    context: `Income ${aud(s.monthlyIncome)}  ·  expenses ${aud(s.monthlyExpenses)}  ·  shortfall ${aud(deficit)}/mo`,
    primaryActionLabel: 'Review budget',
    payload: {
      monthlyCashflow: Math.round(s.monthlyCashflow),
      monthlyIncome: Math.round(s.monthlyIncome),
      monthlyExpenses: Math.round(s.monthlyExpenses),
    },
  };
}

function detectEmergencyFundLow(s: AlertEngineSnapshot): ComputedAlert | null {
  if (s.emergencyFundMonths >= 1) return null;
  const months = round1(s.emergencyFundMonths);
  return {
    triggerKind: 'EMERGENCY_FUND_LOW',
    severity: 'critical',
    headline: 'Emergency fund dropped below 1 month',
    body: `Buffer at ${months} month${months === 1 ? '' : 's'} of expenses. One unexpected bill puts this client into debt.`,
    context: `Buffer ${months}mo  ·  monthly expenses ${aud(s.monthlyExpenses)}  ·  3-month target ${aud(s.monthlyExpenses * 3)}`,
    primaryActionLabel: 'Schedule call',
    payload: {
      emergencyFundMonths: months,
      monthlyExpenses: Math.round(s.monthlyExpenses),
    },
  };
}

function detectLvrRefinanceWindow(s: AlertEngineSnapshot): ComputedAlert | null {
  if (s.propertyPortfolioValue <= 0) return null;
  if (s.mortgageBalance <= 0) return null; // nothing to refinance
  const lvr = (s.mortgageBalance / s.propertyPortfolioValue) * 100;
  if (lvr <= 0 || lvr >= LVR_REFINANCE_CEILING) return null;
  if (s.propertyPortfolioEquity < LVR_MIN_USABLE_EQUITY_AUD) return null;
  const lvrPct = Math.round(lvr);
  return {
    triggerKind: 'LVR_REFINANCE_WINDOW',
    severity: 'opportunity',
    headline: `LVR below ${LVR_REFINANCE_CEILING}% — refinance window open`,
    body: `Portfolio LVR at ${lvrPct}% with ${aud(s.propertyPortfolioEquity)} equity. Worth modelling a rate review.`,
    context: `LVR ${lvrPct}%  ·  equity ${aud(s.propertyPortfolioEquity)}  ·  mortgage balance ${aud(s.mortgageBalance)}`,
    primaryActionLabel: 'Model refinance',
    payload: {
      lvr: lvrPct,
      propertyPortfolioEquity: Math.round(s.propertyPortfolioEquity),
      mortgageBalance: Math.round(s.mortgageBalance),
      propertyPortfolioValue: Math.round(s.propertyPortfolioValue),
    },
  };
}

function detectHealthDrop(
  s: AlertEngineSnapshot,
  prior: AlertEnginePriorState | null | undefined,
): ComputedAlert | null {
  if (!prior || prior.healthScore == null) return null; // need a baseline
  const drop = prior.healthScore - s.healthScore;
  if (drop < HEALTH_DROP_THRESHOLD) return null;
  return {
    triggerKind: 'HEALTH_DROP',
    severity: 'critical',
    headline: `Financial health dropped ${drop} points`,
    body: `Health score ${s.healthScore} (was ${prior.healthScore}). Something material changed since the last review.`,
    context: `Health ${s.healthScore} ↓${drop}  ·  cashflow ${aud(s.monthlyCashflow)}/mo  ·  buffer ${round1(s.emergencyFundMonths)}mo`,
    primaryActionLabel: 'Review position',
    payload: {
      healthScore: s.healthScore,
      priorHealthScore: prior.healthScore,
      healthDrop: drop,
    },
  };
}

function detectTrailAdvanced(
  s: AlertEngineSnapshot,
  prior: AlertEnginePriorState | null | undefined,
): ComputedAlert | null {
  if (!prior || !prior.trailStage) return null; // need a baseline
  const prevRank = stageRank(prior.trailStage);
  const currRank = stageRank(s.trailStage);
  if (prevRank < 0 || currRank < 0) return null;
  if (currRank <= prevRank) return null; // not an advancement
  return {
    triggerKind: 'TRAIL_ADVANCED',
    severity: 'milestone',
    headline: `TRAIL stage advanced ${STAGE_NAME[prior.trailStage]} → ${STAGE_NAME[s.trailStage]}`,
    body: 'A behavioural milestone — the kind of moment worth acknowledging with the client.',
    context: `${STAGE_NAME[prior.trailStage]} → ${STAGE_NAME[s.trailStage]}  ·  Health ${s.healthScore}  ·  cashflow ${aud(s.monthlyCashflow)}/mo`,
    primaryActionLabel: 'Send congratulations',
    payload: {
      fromStage: prior.trailStage,
      toStage: s.trailStage,
      healthScore: s.healthScore,
    },
  };
}

// =============================================================================
// ENGINE ENTRY POINT
// =============================================================================

/**
 * Which trigger kinds a client's granted CDR data scopes permit. Used
 * by the sweep to gate the per-profession trigger set down to "only
 * what this client actually shared". `FULL` permits everything.
 *
 * Scope→trigger mapping:
 *   - CASHFLOW_NEGATIVE / EMERGENCY_FUND_LOW  ⇐ FINANCIAL or TRANSACTIONS
 *   - LVR_REFINANCE_WINDOW                    ⇐ PROPERTIES or LOANS
 *   - HEALTH_DROP                             ⇐ FINANCIAL (health is a
 *                                                financial-position derivative)
 *   - TRAIL_ADVANCED                          ⇐ FINANCIAL (TRAIL stage is
 *                                                computed from cashflow +
 *                                                emergency fund + health)
 *
 * Takes the scope strings as plain strings so this module stays free of
 * a Prisma import (it's a pure lib). The caller passes
 * `client.accessScopes` (a `DataAccessScope[]`) — assignable to
 * `readonly string[]`.
 */
export function scopeAllowedTriggers(
  grantedScopes: readonly string[],
): Set<AlertTriggerKind> {
  const g = new Set(grantedScopes);
  if (g.has('FULL')) return new Set(ALL_ENGINE_TRIGGER_KINDS);
  const out = new Set<AlertTriggerKind>();
  const hasFinancial = g.has('FINANCIAL') || g.has('TRANSACTIONS');
  if (hasFinancial) {
    out.add('CASHFLOW_NEGATIVE');
    out.add('EMERGENCY_FUND_LOW');
    out.add('HEALTH_DROP');
    out.add('TRAIL_ADVANCED');
  }
  if (g.has('PROPERTIES') || g.has('LOANS')) {
    out.add('LVR_REFINANCE_WINDOW');
  }
  return out;
}

/**
 * Compute the alerts that should currently be ACTIVE for a client,
 * given their snapshot, optional prior-sweep state, and the trigger
 * kinds their org's profession surfaces.
 *
 * Returns at most one alert per trigger kind (the kinds are mutually
 * independent). Order is the iteration order of `ALL_ENGINE_TRIGGER_KINDS`
 * filtered by `enabledTriggers`, so callers get a stable sequence.
 */
export function computeAlerts(input: AlertEngineInput): ComputedAlert[] {
  const { snapshot, prior, enabledTriggers } = input;
  const enabled = new Set(enabledTriggers);
  const out: ComputedAlert[] = [];

  for (const kind of ALL_ENGINE_TRIGGER_KINDS) {
    if (!enabled.has(kind)) continue;
    let alert: ComputedAlert | null = null;
    switch (kind) {
      case 'CASHFLOW_NEGATIVE':
        alert = detectCashflowNegative(snapshot);
        break;
      case 'EMERGENCY_FUND_LOW':
        alert = detectEmergencyFundLow(snapshot);
        break;
      case 'LVR_REFINANCE_WINDOW':
        alert = detectLvrRefinanceWindow(snapshot);
        break;
      case 'HEALTH_DROP':
        alert = detectHealthDrop(snapshot, prior);
        break;
      case 'TRAIL_ADVANCED':
        alert = detectTrailAdvanced(snapshot, prior);
        break;
    }
    if (alert) out.push(alert);
  }

  return out;
}
