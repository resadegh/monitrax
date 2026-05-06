/**
 * Phase 41i — Calculation Audit System types.
 *
 * Per Reza brief 2026-05-06 (HR-3): "User-visible calc errors are
 * unacceptable. The Calculation Audit System is a silent admin-side
 * safety net — never a user-facing surface."
 *
 * Cross-app scope. Every deterministic calc engine in the app
 * (tax / core / health / property / etc.) registers against
 * `calcEngineRegistry`. A single registration shape, a single
 * fixture format, a single audit pipeline. Industry pattern:
 * Stripe reconciliation, Wise invariants, banking shadow ledger.
 *
 * **Three layers** (see Phase 41 doc §11.2):
 *   - **L1** Deterministic regression — every engine has reference
 *     fixtures; CI fails on drift. No AI. (This PR.)
 *   - **L2** Anomaly detection — Cloud Scheduler daily; AI surfaces
 *     outliers across users. (Deferred — needs Cloud Scheduler.)
 *   - **L3** On-demand audit — admin clicks "Audit this user"; system
 *     re-runs every engine; diffs vs stored. (This PR — minimal v1.)
 */

/**
 * Categories help the admin portal group + filter findings. Add
 * a new category only when an engine genuinely doesn't fit one of
 * the existing buckets (rare).
 */
export type CalcCategory =
  | 'TAX'           // anything in lib/tax-engine/
  | 'CORE'          // lib/calculations/, lib/services/masterFinancialService
  | 'HEALTH'        // lib/health/, financial-health calcs
  | 'PROPERTY'      // LVR, equity, rental yield
  | 'CASHFLOW'      // dedicated cashflow engines
  | 'OTHER';

/**
 * Severity ranks findings for the admin queue. Reviewers reject
 * any change that promotes a recoverable drift (e.g. rounding) to
 * `CRITICAL` — keeps the admin signal-to-noise high.
 */
export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Lifecycle of an `AuditFinding`. Mirrors the standard incident
 * workflow used elsewhere in Monitrax (security audit log, support
 * tickets).
 */
export type Resolution =
  | 'OPEN'          // freshly detected, not yet triaged
  | 'INVESTIGATING' // admin is looking at it
  | 'FALSE_POSITIVE'
  | 'FIX_REQUIRED'  // confirmed bug, code fix needed
  | 'FIXED';        // bug resolved, finding closed

/**
 * A single test scenario for a calc engine. **Assertions, not deep
 * equality** — each fixture defines small, concrete invariants
 * captured from source authority (ATO worked examples, the
 * legislation itself, hand-verified canonical scenarios).
 *
 * Why assertions instead of `expectedOutput: <full object>`:
 *   - Hardcoded invariants catch real drift (a constant changing
 *     from $30k to $25k fails the assertion).
 *   - Full-object expected outputs are tempting to "snapshot" via
 *     `expectedOutput: engine(input)` — which is self-referential
 *     and never fails. Reviewers historically miss this trap.
 *   - Granular assertions document *which* property of the result
 *     matters and *why*. "Concessional cap is $30k for FY24-25"
 *     beats a 200-line JSON blob.
 *
 * Each assertion is independently evaluated. Fixture passes iff
 * every assertion passes.
 */
export interface CalcAssertion<TOutput> {
  /** Plain-English description. Surfaces in the admin portal drift display. */
  description: string;
  /** Pure predicate over the actual output. */
  check: (actual: TOutput) => boolean;
}

export interface CalcFixture<TInput, TOutput> {
  /** Stable name within the engine, e.g. "FY24-25 individual at $30k cap". */
  name: string;
  /** Plain-English description for the admin portal UI. */
  description: string;
  /** Input passed to the engine's `execute()`. */
  input: TInput;
  /** One or more assertions. Fixture passes iff every assertion passes. */
  assertions: ReadonlyArray<CalcAssertion<TOutput>>;
  /**
   * Authority reference for the fixture, e.g. "ATO QC 22168 (FY24-25
   * concessional cap example)". Lifted from the source — never
   * authored by the engineer (per Phase 41 §1.1 + §1.4).
   */
  authoritySource?: string;
}

/**
 * A registered calc engine. The shape is intentionally loose —
 * `TInput` and `TOutput` are type parameters so any calc function
 * in the app can be wrapped without refactoring its signature.
 */
export interface CalcEngine<TInput = unknown, TOutput = unknown> {
  /** Stable identifier, e.g. `"tax.capTracker"`. */
  name: string;
  /** Plain-English description for the admin portal. */
  description: string;
  /** Category for grouping in the admin portal. */
  category: CalcCategory;
  /** Source file path (for the admin "view code" link). */
  sourcePath: string;
  /**
   * The pure function under audit. MUST be deterministic — same
   * input → same output. If the engine has side effects (DB calls,
   * network), wrap a pure version for registration.
   */
  execute: (input: TInput) => TOutput | Promise<TOutput>;
  /**
   * Reference fixtures. v1 requires at least one. Adding more
   * fixtures over time is the way to grow audit coverage.
   */
  fixtures: ReadonlyArray<CalcFixture<TInput, TOutput>>;
}

/**
 * Outcome of running one fixture against its engine. The
 * differential runner produces an array of these.
 */
export interface FixtureRunResult {
  engineName: string;
  fixtureName: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  /** Error message when `status === 'ERROR'` (engine threw). */
  errorMessage?: string;
  /** Failed-assertion descriptions when `status === 'FAIL'`. */
  failedAssertions?: string[];
  durationMs: number;
}

/**
 * Aggregated report from a differential run. The admin portal
 * renders this directly.
 */
export interface DifferentialReport {
  startedAt: string;
  completedAt: string;
  totalEngines: number;
  totalFixtures: number;
  passed: number;
  failed: number;
  errored: number;
  results: FixtureRunResult[];
}

/**
 * A single audit finding — produced by L1 differential runs and
 * L3 on-demand audits. Persisted to the DB for the admin queue.
 */
export interface AuditFinding {
  id: string;
  detectedAt: string;
  source: 'L1_DIFFERENTIAL' | 'L3_ON_DEMAND' | 'L2_ANOMALY';
  engineName: string;
  fixtureName?: string;
  /** User scope, when the finding was triggered by a per-user audit (L3). */
  userId?: string;
  severity: Severity;
  resolution: Resolution;
  /** Plain-English summary for the admin queue. */
  summary: string;
  /** Failed-assertion descriptions when the finding is from a failed fixture. */
  failedAssertions?: string[];
  /** Free-form admin notes during triage. */
  adminNotes?: string;
}
