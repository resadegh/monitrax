/**
 * AI Document Router · Phase B — per-user storage quota.
 *
 * Pins the quota contract without a live DB by mocking `prisma.document.aggregate`:
 *   - usage is computed from SUM(Document.size) over LIVE docs (deletedAt: null),
 *   - assertWithinQuota throws StorageQuotaExceededError only when usage + incoming
 *     would EXCEED the limit (equal-to-limit is allowed),
 *   - the usage shape (available, fraction) is correct and clamped.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { aggregate } = vi.hoisted(() => ({ aggregate: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: { document: { aggregate } },
}));

import {
  getStorageUsage,
  assertWithinQuota,
  StorageQuotaExceededError,
  DEFAULT_STORAGE_QUOTA_BYTES,
} from '@/lib/documents/storage/storageQuota';

const QUOTA = DEFAULT_STORAGE_QUOTA_BYTES; // 2 GiB

beforeEach(() => {
  aggregate.mockReset();
});

/** Make the mocked aggregate report `used` bytes for the user's live docs. */
function withUsage(used: number | null) {
  aggregate.mockResolvedValue({ _sum: { size: used } });
}

describe('getStorageUsage', () => {
  it('computes usage from SUM(size) over live (non-deleted) documents', async () => {
    withUsage(500);
    const usage = await getStorageUsage('user-1');

    expect(usage.usedBytes).toBe(500);
    expect(usage.quotaBytes).toBe(QUOTA);
    expect(usage.availableBytes).toBe(QUOTA - 500);
    expect(usage.fraction).toBeCloseTo(500 / QUOTA, 10);

    // Only live documents count.
    expect(aggregate).toHaveBeenCalledWith({
      where: { userId: 'user-1', deletedAt: null },
      _sum: { size: true },
    });
  });

  it('treats a null SUM (no documents) as zero usage', async () => {
    withUsage(null);
    const usage = await getStorageUsage('user-1');
    expect(usage.usedBytes).toBe(0);
    expect(usage.availableBytes).toBe(QUOTA);
    expect(usage.fraction).toBe(0);
  });

  it('clamps availableBytes at 0 and fraction at 1 when over quota', async () => {
    withUsage(QUOTA + 10_000);
    const usage = await getStorageUsage('user-1');
    expect(usage.availableBytes).toBe(0);
    expect(usage.fraction).toBe(1);
  });
});

describe('assertWithinQuota', () => {
  it('allows an upload that fits within the remaining headroom', async () => {
    withUsage(QUOTA - 1_000);
    await expect(assertWithinQuota('user-1', 1_000)).resolves.toMatchObject({
      usedBytes: QUOTA - 1_000,
    });
  });

  it('allows an upload that exactly reaches the limit (boundary)', async () => {
    withUsage(QUOTA - 1_000);
    await expect(assertWithinQuota('user-1', 1_000)).resolves.toBeTruthy();
  });

  it('throws StorageQuotaExceededError when the upload would exceed the limit', async () => {
    withUsage(QUOTA - 1_000);
    await expect(assertWithinQuota('user-1', 1_001)).rejects.toBeInstanceOf(
      StorageQuotaExceededError,
    );
  });

  it('carries the usage + incoming bytes + machine code on the error', async () => {
    withUsage(QUOTA);
    try {
      await assertWithinQuota('user-1', 1);
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(StorageQuotaExceededError);
      const err = e as StorageQuotaExceededError;
      expect(err.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(err.incomingBytes).toBe(1);
      expect(err.usage.usedBytes).toBe(QUOTA);
    }
  });
});
