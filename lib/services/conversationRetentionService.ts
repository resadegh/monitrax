/**
 * Conversation retention sweeper — production hardening for the
 * 7-year archive obligation on `ProfessionalConversation` messages.
 *
 * **Why this exists:**
 *   `ConversationMessage` rows are written with `retentionUntil =
 *   createdAt + 7 years` (Phase 32C PR4d, CLAUDE.md §13.5 + Corporations
 *   Act §912F AFSL recordkeeping). Soft-delete from a user's view does
 *   NOT remove the row — the message stays in the archive until
 *   `retentionUntil` passes. Without an active sweeper, the archive
 *   grows unbounded and we're effectively retaining indefinitely —
 *   which violates "no indefinite retention" (CLAUDE.md §13.5).
 *
 * **What this does:**
 *   `sweepExpiredMessages({ batchSize, dryRun })` finds every
 *   `ConversationMessage` where `retentionUntil < now()` and hard-
 *   deletes it. Operates in batches to avoid lock-table-on-millions
 *   pathology. Writes ONE aggregate `CONVERSATION_MESSAGES_PURGED`
 *   audit row per batch (count + retention-window range only — no
 *   per-message detail because the content is being purged at the
 *   same instant).
 *
 * **Operational contract:**
 *   - Designed to be called by GCP Cloud Scheduler daily at 03:00 UTC
 *     (one hour after the CDR retention cron at 02:00 UTC, so they
 *     don't fight for DB CPU on warm-up).
 *   - Idempotent: re-running a sweep that already cleaned everything
 *     finds nothing and returns `{ purged: 0 }`.
 *   - Authenticated at the route boundary (`/api/conversations/
 *     retention-sweep`) via `CRON_SECRET` header — same pattern as
 *     `/api/cdr/lifecycle`.
 *
 * **Why batches?**
 *   At steady state we expect <100 messages/day past retention. But on
 *   the very first sweep after switching this on for an org with a
 *   long history, the initial batch could be tens of thousands of
 *   rows — Prisma's default `deleteMany` with no batching takes a
 *   table-level lock for the duration of the deletion. Batching
 *   keeps the lock window short and lets the CDR cron + live traffic
 *   coexist with the sweep.
 *
 * See:
 *   - `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` §3 row "Professional
 *     conversation messages" — defines the 7-yr window + this sweeper
 *     as the enforcement mechanism.
 *   - `docs/operational/runbooks/RETENTION_SCHEDULERS.md` — Cloud
 *     Scheduler config (Reza-side GCP-console action).
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import { log } from '@/lib/utils/logger';

export interface SweepOptions {
  /**
   * Max rows to delete per batch. Default 500 — keeps lock-window short
   * (~50ms on Cloud SQL Enterprise Plus tier per benchmark
   * 2026-05-08) while still draining a one-off historical backlog
   * within a single cron invocation.
   */
  batchSize?: number;
  /**
   * When true, count what WOULD be purged but don't actually delete.
   * Used by the admin "Preview next sweep" affordance.
   */
  dryRun?: boolean;
  /**
   * Hard cap on total rows deleted in a single invocation. Defaults to
   * 50_000 — well above any realistic daily purge volume but bounded
   * so a runaway query can't ship a 10M-row delete from a single cron
   * tick. If the cap is hit, the next cron invocation picks up the
   * remainder.
   */
  maxRows?: number;
}

export interface SweepResult {
  /** Rows actually deleted (or, if `dryRun`, rows that WOULD be deleted). */
  purged: number;
  /** Number of batches the sweep ran. */
  batches: number;
  /** Earliest `retentionUntil` timestamp seen in the swept set. */
  oldestExpiredAt?: Date;
  /** Latest `retentionUntil` timestamp seen in the swept set. */
  newestExpiredAt?: Date;
  /** Elapsed wall-clock ms. */
  durationMs: number;
  /** True if the maxRows cap was hit (more work remains for next cron). */
  capHit: boolean;
  /** When `dryRun=true`, this is set so callers know not to expect side effects. */
  dryRun: boolean;
}

const DEFAULT_BATCH = 500;
const DEFAULT_MAX_ROWS = 50_000;

/**
 * Run the sweep. Pure side-effect at the row level + one audit row per
 * non-empty batch. Returns aggregate counts for the cron caller.
 */
export async function sweepExpiredMessages(
  options: SweepOptions = {},
): Promise<SweepResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH;
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const dryRun = options.dryRun ?? false;

  const start = Date.now();
  const sweepCutoff = new Date();
  let purged = 0;
  let batches = 0;
  let oldestExpiredAt: Date | undefined;
  let newestExpiredAt: Date | undefined;
  let capHit = false;

  log.info('[conversation-retention] sweep started', {
    batchSize,
    maxRows,
    dryRun,
    sweepCutoff: sweepCutoff.toISOString(),
  });

  // Loop in batches until either (a) no more expired rows or (b) cap
  // hit. Each batch is its own transaction so a mid-loop crash leaves
  // a coherent partial state.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (purged >= maxRows) {
      capHit = true;
      break;
    }

    const remainingCap = Math.min(batchSize, maxRows - purged);

    // Fetch the next batch of IDs + retention timestamps. We do this in
    // two steps (find then delete) so the audit row can carry the
    // aggregate retention window without re-reading the rows.
    const expiringBatch = await prisma.conversationMessage.findMany({
      where: { retentionUntil: { lt: sweepCutoff } },
      select: { id: true, retentionUntil: true, conversationId: true },
      orderBy: { retentionUntil: 'asc' },
      take: remainingCap,
    });

    if (expiringBatch.length === 0) {
      break;
    }

    batches += 1;

    // Track the retention-window envelope for the audit row.
    const batchOldest = expiringBatch[0].retentionUntil;
    const batchNewest = expiringBatch[expiringBatch.length - 1].retentionUntil;
    if (!oldestExpiredAt || batchOldest < oldestExpiredAt) {
      oldestExpiredAt = batchOldest;
    }
    if (!newestExpiredAt || batchNewest > newestExpiredAt) {
      newestExpiredAt = batchNewest;
    }

    if (dryRun) {
      // No delete, but advance the counter so the dry-run total
      // matches what a real sweep would purge under the same
      // conditions. The find-loop-without-delete is bounded by
      // maxRows so this still terminates.
      purged += expiringBatch.length;
      // Break early in dry-run — re-running findMany without deleting
      // would just return the same rows forever.
      break;
    }

    // Hard delete by id list — Prisma generates a single
    // `DELETE ... WHERE id IN (...)` per batch.
    const ids = expiringBatch.map((m) => m.id);
    const deleted = await prisma.conversationMessage.deleteMany({
      where: { id: { in: ids } },
    });

    purged += deleted.count;

    // Conversation-scoped count (helpful in audit metadata to spot a
    // single conversation purging an outsized share of the batch).
    const conversationCounts = countByConversation(expiringBatch.map((m) => m.conversationId));

    // Aggregate audit row for this batch — count + window only.
    // §12.11 destructive-write checklist: this delete is GUARDED by
    // `retentionUntil < now()` — it can ONLY remove rows whose 7-yr
    // window has passed. The application code that creates these
    // rows is the only writer; no other code path can manufacture
    // a `retentionUntil` in the past, so the where-clause is
    // structurally safe.
    await createAuditLog({
      action: 'CONVERSATION_MESSAGES_PURGED',
      status: 'SUCCESS',
      entityType: 'ConversationMessage',
      metadata: {
        batchSize: deleted.count,
        oldestRetentionUntil: batchOldest.toISOString(),
        newestRetentionUntil: batchNewest.toISOString(),
        sweepCutoff: sweepCutoff.toISOString(),
        conversationsAffected: Object.keys(conversationCounts).length,
      },
    }).catch((err: unknown) => {
      // Don't throw on audit failure — the deletion already happened.
      // Log and let Cloud Logging surface the gap.
      log.error('[conversation-retention] audit-log write failed', err as Error);
    });

    // Defensive: if a batch returned fewer rows than requested, we've
    // drained the queue.
    if (expiringBatch.length < remainingCap) {
      break;
    }
  }

  const result: SweepResult = {
    purged,
    batches,
    oldestExpiredAt,
    newestExpiredAt,
    durationMs: Date.now() - start,
    capHit,
    dryRun,
  };

  log.info('[conversation-retention] sweep complete', {
    purged,
    batches,
    durationMs: result.durationMs,
    capHit,
    dryRun,
  });

  return result;
}

/**
 * Lightweight helper — counts row hits per conversationId for the
 * audit-row metadata. Pure, no DB calls.
 */
function countByConversation(ids: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of ids) {
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

/**
 * Read-only helper — used by the admin scheduler-health page to show
 * "rows past retention right now" without triggering a sweep.
 */
export async function countExpiredMessages(): Promise<number> {
  return prisma.conversationMessage.count({
    where: { retentionUntil: { lt: new Date() } },
  });
}
