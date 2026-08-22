/**
 * M3 punch list — PURE display helpers for the v1 scoreboard
 * (MON-180 §C-1 · MON-183 §C-4, BRIEF_M3_PUNCHLIST_AND_CLOSEOUT.md).
 *
 * Display logic ONLY: window selection and render ordering. No figure is
 * produced here (§12.2.1) — every number the tiles show still comes from its
 * canonical engine; these functions decide WHICH already-produced figures the
 * tiles lead with, and in what order rows render.
 *
 * Used by: app/dashboard/ScoreboardClient.tsx.
 * Locked by: tests/dashboard/scoreboardDisplay.test.ts.
 */

/** One FY window's readiness slice, as the pack export's reconciliation reports it. */
export interface EofyWindowSlice {
  fyLabel: string;
  notReadyCount: number;
  includedCount: number;
  transactionsTotal: number;
}

export type EofyTileState =
  /** EOFY season lead (MON-180 rule): the just-ended FY drives the tile. */
  | { kind: 'lead-just-ended'; slice: EofyWindowSlice }
  /** Normal display: the current FY has rows. */
  | { kind: 'current'; slice: EofyWindowSlice }
  /** Honest empty — the current FY has no property rows. NEVER a "tax-ready" claim. */
  | { kind: 'no-rows-yet'; fyLabel: string }
  /** The pack feed failed entirely. */
  | { kind: 'unavailable' };

/** AU FY start year for a date: the FY runs 1 July → 30 June (UTC month 6 rolls it). */
export function auFyStartYear(now: Date): number {
  return now.getUTCMonth() < 6 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

/** AU FY label, e.g. 2025 → "FY2025-26" (same shape buildAuFyWindow emits). */
export function auFyLabel(startYear: number): string {
  return `FY${startYear}-${String(startYear + 1).slice(-2)}`;
}

/**
 * MON-180 rule (brief §C-1, stated here as THE rule a test locks):
 * while the CURRENT FY has no included property rows AND we are within
 * 4 months of FY start (July–October — the EOFY work season), the tile
 * ALSO reads the just-ended FY and LEADS with it. Outside the season, or
 * when the just-ended feed is unavailable, an empty current FY renders the
 * honest "no rows yet" state — never a vacuous "all tax-ready".
 */
export function isEofySeason(now: Date): boolean {
  const month = now.getUTCMonth(); // 6=Jul, 7=Aug, 8=Sep, 9=Oct
  return month >= 6 && month <= 9;
}

/** Resolve what the EOFY tile displays from the fetched window slices. */
export function resolveEofyTileState(args: {
  now: Date;
  current: EofyWindowSlice | null;
  justEnded: EofyWindowSlice | null;
}): EofyTileState {
  const { now, current, justEnded } = args;
  if (!current && !justEnded) return { kind: 'unavailable' };
  if (current && current.includedCount > 0) return { kind: 'current', slice: current };
  // Current FY is empty (or its feed failed while the just-ended one landed).
  if (isEofySeason(now) && justEnded && justEnded.includedCount > 0) {
    return { kind: 'lead-just-ended', slice: justEnded };
  }
  return { kind: 'no-rows-yet', fyLabel: current?.fyLabel ?? auFyLabel(auFyStartYear(now)) };
}

/**
 * MON-183 rule (brief §C-4, stated here as THE rule a test locks):
 * the strip renders ALL properties — no silent cap — ordered worst monthly
 * figure first (the biggest drain leads). Ties keep the incoming order
 * (stable sort), so equal rows stay in API order.
 */
export function orderStripWorstFirst<T extends { monthly: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.monthly < b.monthly ? -1 : a.monthly > b.monthly ? 1 : 0));
}
