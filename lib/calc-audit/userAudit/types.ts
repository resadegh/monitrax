/**
 * Phase 41i.3b — Per-user "Audit this user" types.
 *
 * Each engine that wants to be auditable for a specific user
 * registers a `UserAuditAdapter`. The adapter knows:
 *   1. How to fetch the user's data from the DB and shape it into
 *      the engine's input.
 *   2. (Optional) How to sanity-validate the engine's output.
 *
 * The harness (`runUserAudit`) iterates registered adapters, for each:
 *   - Calls `fetchInput(userId)` (skip if returns null — user has
 *     no data for this engine).
 *   - Runs the engine via the registered `CalcEngine.execute`.
 *   - Validates output via `validateOutput` (if provided).
 *   - Persists `CalcAuditFinding` (source: `L3_ON_DEMAND`) on any
 *     failure: throw at fetch, throw at engine, sanity invariant
 *     violation.
 *
 * Per spec doc + IMPLEMENTATION_PLAN Up Next #41 — admin clicks
 * "Audit this user" → re-runs every adapted engine for that user
 * with their stored data → diffs vs stored → renders findings.
 *
 * Per HR-3 (CLAUDE.md / Phase 41 §1 invariant 11) — admin-only
 * surface; never user-facing. Same lifecycle as L1/L2/L4 — feeds
 * the existing CalcAuditFinding queue.
 */

import 'server-only';

/**
 * Returned by `validateOutput` — a sanity-invariant check on the
 * engine's output. When `ok: false`, the harness records a finding.
 */
export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string; severity?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' };

/**
 * Adapter for one calc engine. Stable contract: implementations live
 * under `lib/calc-audit/userAudit/adapters/`.
 */
export interface UserAuditAdapter<TInput = unknown, TOutput = unknown> {
  /**
   * Stable identifier — must match the corresponding `CalcEngine.name`
   * in the engine registry. The harness uses this to look up the
   * engine's `execute` function.
   */
  engineName: string;

  /**
   * Fetch the user's data and shape it into the engine's input.
   * Returns `null` when the user has no relevant data (e.g. user has
   * no Div 7A loans → skip the Div 7A audit). Returning `null` is
   * NOT a failure; it's "this engine doesn't apply to this user."
   *
   * If fetchInput throws, the harness records a HIGH-severity finding
   * (the adapter itself broke for this user).
   */
  fetchInput: (userId: string) => Promise<TInput | null>;

  /**
   * Optional sanity-invariant validator. Receives the engine's output;
   * returns `{ ok: true }` for OK or `{ ok: false, reason }` to fire
   * a finding.
   *
   * Use this to encode "this output should never be physically
   * impossible for any user" invariants (e.g. netWorth = assets -
   * liabilities; income aggregator total >= 0; LVR in [0, 5]).
   *
   * Default behaviour when omitted: harness only fires a finding if
   * the engine throws.
   */
  validateOutput?: (output: TOutput) => ValidationResult;
}

/**
 * Per-engine outcome from running the audit for one user.
 */
export interface UserAuditOutcome {
  engineName: string;
  userId: string;
  outcome: 'OK' | 'FINDING' | 'SKIPPED';
  /** When `FINDING` — the persisted CalcAuditFinding's id. */
  findingId?: string;
  /** Why the engine was skipped — usually `NO_DATA` (fetchInput returned null). */
  skipReason?: 'NO_DATA' | 'NO_ADAPTER';
  /** Severity of the persisted finding. */
  severity?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** Free-text summary persisted on the finding. */
  summary?: string;
  /** Free-text error from fetcher / engine if it threw. */
  errorMessage?: string;
}

/**
 * Aggregate report for one user audit run.
 */
export interface UserAuditReport {
  userId: string;
  startedAt: string;
  completedAt: string;
  outcomes: UserAuditOutcome[];
  totals: {
    enginesScanned: number;
    findingsCreated: number;
    findingsRefreshed: number;
    skipped: number;
    errors: number;
  };
}
