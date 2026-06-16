/**
 * AI Document Router · Phase B — per-user storage quota (canonical SSOT).
 *
 * Drift-free by design: usage is COMPUTED from the canonical `Document.size`
 * column (live documents only — `deletedAt IS NULL`) at check time, never
 * maintained as a running counter that could desync from reality. The limit
 * is on the user's total stored bytes, so it applies identically to every
 * storage backend (Monitrax Postgres bytea AND Google Cloud Storage) — the
 * bytes count the same wherever they physically live.
 *
 * Reza decision (2026-06-16): document storage moves to GCS *with a per-user
 * quota*. This module is the quota half. It enforces today on the DB provider
 * (where bytea bloat is the immediate, real cost) and keeps enforcing
 * unchanged after the GCS cut-over (the storage factory auto-selects GCS once
 * its env vars are set — `lib/documents/storage/factory.ts`).
 *
 * SSOT (CLAUDE.md §12.2): the ONLY place that decides "is this user over their
 * storage limit?". Wired into `DocumentManagementEngine.processUpload` — the
 * single upload chokepoint — so every upload path inherits enforcement:
 * `/api/documents/upload`, in-form `FormDocumentUpload`, and the global scan.
 *
 * @see docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md §Storage track
 */

import { prisma } from '@/lib/db';

/**
 * Default per-user storage allowance: 2 GiB.
 * Generous for a personal finance vault of receipts/statements/PDFs, while
 * still bounding unbounded bytea growth on the DB provider. A per-user
 * override (paid tiers, household pooling) hooks into `resolveQuotaBytes`
 * later without touching call sites.
 */
export const DEFAULT_STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

export interface StorageUsage {
  /** Bytes currently consumed by the user's live (non-deleted) documents. */
  usedBytes: number;
  /** The user's total allowance in bytes. */
  quotaBytes: number;
  /** Remaining headroom in bytes (never negative). */
  availableBytes: number;
  /** Fraction of quota consumed, 0..1 (capped at 1). For UI meters. */
  fraction: number;
}

/** Thrown when an upload would push the user past their storage quota. */
export class StorageQuotaExceededError extends Error {
  readonly code = 'STORAGE_QUOTA_EXCEEDED';
  constructor(
    public readonly usage: StorageUsage,
    public readonly incomingBytes: number,
  ) {
    super(
      `Storage quota exceeded: ${usage.usedBytes} + ${incomingBytes} bytes ` +
        `would exceed the ${usage.quotaBytes}-byte limit.`,
    );
    this.name = 'StorageQuotaExceededError';
  }
}

/**
 * Resolve the user's quota limit. Constant for v1; the per-user override hook
 * (paid tiers / household pooling) slots in here later without changing the
 * computation or any call site.
 */
function resolveQuotaBytes(_userId: string): number {
  return DEFAULT_STORAGE_QUOTA_BYTES;
}

/**
 * Compute the user's current storage usage from their live documents.
 * Source of truth = `SUM(Document.size) WHERE userId AND deletedAt IS NULL`.
 */
export async function getStorageUsage(userId: string): Promise<StorageUsage> {
  const agg = await prisma.document.aggregate({
    where: { userId, deletedAt: null },
    _sum: { size: true },
  });
  const usedBytes = agg._sum.size ?? 0;
  const quotaBytes = resolveQuotaBytes(userId);
  const availableBytes = Math.max(0, quotaBytes - usedBytes);
  return {
    usedBytes,
    quotaBytes,
    availableBytes,
    fraction: quotaBytes > 0 ? Math.min(1, usedBytes / quotaBytes) : 1,
  };
}

/**
 * Throw `StorageQuotaExceededError` if storing `incomingBytes` more would push
 * the user past their quota. Returns the pre-upload usage when within limit
 * (handy for callers that want to surface "X% used" after a successful upload).
 */
export async function assertWithinQuota(
  userId: string,
  incomingBytes: number,
): Promise<StorageUsage> {
  const usage = await getStorageUsage(userId);
  if (usage.usedBytes + incomingBytes > usage.quotaBytes) {
    throw new StorageQuotaExceededError(usage, incomingBytes);
  }
  return usage;
}
