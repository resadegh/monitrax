/**
 * Health Score Snapshot Recorder (MON-134 / D15) — persists ONE monthly
 * write-once row of the canonical health score so the trend can be derived
 * from real stored history instead of the deleted Math.random fabrication.
 *
 * Design contract (mirrors netWorthSnapshotRecorder with ONE deliberate,
 * documented divergence):
 *   - One row per (userId, month-anchor). `snapshotDate` is the first day of
 *     the calendar month, UTC — `currentMonthAnchor()` is imported from the
 *     net-worth recorder (the single SSOT for month-anchor logic).
 *   - WRITE-ONCE, not upsert (MON-134 brief §4.2, stricter than the net-worth
 *     recorder's current-month refresh): re-running in the same month must not
 *     create a second row OR change the existing one. The first capture of a
 *     month freezes it. Implemented as `create` + P2002 no-op — there is no
 *     update branch at all.
 *   - Fire-and-forget at the route layer (`.catch(() => {})`) — a recorder
 *     hiccup never blocks the health response (CLAUDE.md §12.10).
 *
 * §12.11: NOT a destructive write — pure `create`; a unique-violation is
 * swallowed as the intended no-op. No existing row is ever mutated.
 */

import { prisma } from '@/lib/db';
import { currentMonthAnchor } from './netWorthSnapshotRecorder';
import { HEALTH_FORMULA_VERSION } from '@/lib/health/aggregateEngine';

export interface HealthScoreSnapshotInput {
  userId: string;
  /** The canonical score from generateHealthReport().healthScore.score. */
  score: number;
  riskBand: string;
}

/**
 * Record this month's snapshot if — and only if — none exists yet.
 * Returns true when a row was written, false when the month was already
 * frozen (the write-once no-op).
 */
export async function recordHealthScoreSnapshot(
  input: HealthScoreSnapshotInput,
): Promise<boolean> {
  const anchor = currentMonthAnchor();
  try {
    await prisma.healthScoreSnapshot.create({
      data: {
        userId: input.userId,
        snapshotDate: anchor,
        score: input.score,
        riskBand: input.riskBand,
        formulaVersion: HEALTH_FORMULA_VERSION,
      },
    });
    return true;
  } catch (e) {
    // P2002 = unique violation on (userId, snapshotDate): the month is already
    // frozen — the intended write-once no-op, never an error.
    if ((e as { code?: string })?.code === 'P2002') return false;
    throw e;
  }
}
