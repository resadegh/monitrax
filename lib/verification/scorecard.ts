/**
 * NEOAUDIT RELEASE SCORECARD — the publish-gate summary (NEOAUDIT.md §6).
 *
 * Aggregates the publish-readiness signals THIS APP can self-verify from the
 * issue registry, and names the ones it can't (they're verified on CI). Per
 * §22.2.4 the Scorecard states gate OUTPUT, never a bare "safe to publish"
 * claim — the caller renders the honest verdict.
 *
 * The load-bearing signal: a number-changing issue that has NOT reached
 * VERIFIED/CLOSED means a user-facing number is still unverified — a publish
 * blocker (§19.5). Everything below is pure over the registry array so it is
 * unit-testable.
 */

export interface RegistryIssue {
  id: string;
  title: string;
  status: string;
  changesNumbers: boolean;
}

export interface OpenNumberIssue {
  id: string;
  title: string;
  status: string;
}

export interface ScorecardSummary {
  /** Number-changing issues not yet VERIFIED/CLOSED — each is an unverified user number. */
  openNumberIssues: OpenNumberIssue[];
  openNumberIssueCount: number;
  /** All still-open issues (any kind) — context, not a hard publish blocker. */
  totalOpenCount: number;
  /** True when the registry half of the publish gate is clean. */
  registryClean: boolean;
  /** Publish signals this app CANNOT self-verify — verified on CI, stated honestly. */
  externalChecks: string[];
}

/** Statuses that mean the issue is NOT yet proven-resolved. */
const UNVERIFIED = new Set(['OPEN', 'DIAGNOSED', 'FIXING']);

export function summarizeScorecard(issues: RegistryIssue[]): ScorecardSummary {
  const openNumberIssues = issues
    .filter((i) => i.changesNumbers === true && UNVERIFIED.has(i.status))
    .map((i) => ({ id: i.id, title: i.title, status: i.status }));
  const totalOpenCount = issues.filter((i) => UNVERIFIED.has(i.status)).length;

  return {
    openNumberIssues,
    openNumberIssueCount: openNumberIssues.length,
    totalOpenCount,
    registryClean: openNumberIssues.length === 0,
    // Honest scope: these are proven on CI (Rings 0-2 + Stryker), not re-computed
    // in-app. The panel shows them as "verify on CI", never as self-reported green.
    externalChecks: ['Rings 0–2 green on CI', 'Stryker mutation testing (weekly)'],
  };
}
