/**
 * Document rename (Phase 50).
 *
 * Pins the rename contract:
 *   - empty/whitespace names are rejected (no DB write),
 *   - rename verifies ownership (findFirst scoped to id + userId + not-deleted)
 *     BEFORE updating — §12.11: only the user's own document is mutated,
 *   - a missing/other-user document returns not-found (no update),
 *   - the new name is trimmed and applied to originalFilename.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findFirst, update } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  prisma: { document: { findFirst, update } },
}));
// documentService pulls in storage providers transitively; stub the heavy bits.
vi.mock('@/lib/documents/storage', () => ({
  getStorageProvider: vi.fn(),
  assertWithinQuota: vi.fn(),
  StorageQuotaExceededError: class extends Error {},
  getDocumentReadUrl: vi.fn(),
}));

import { renameDocument } from '@/lib/documents/documentService';

beforeEach(() => {
  findFirst.mockReset();
  update.mockReset();
});

describe('renameDocument', () => {
  it('rejects an empty / whitespace-only name without touching the DB', async () => {
    const r = await renameDocument('doc-1', 'user-1', '   ');
    expect(r.success).toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('verifies ownership scoped to id + userId + not-deleted before updating', async () => {
    findFirst.mockResolvedValue({ id: 'doc-1' });
    update.mockResolvedValue({});

    const r = await renameDocument('doc-1', 'user-1', '  Rego 2026.pdf  ');

    expect(r.success).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'doc-1', userId: 'user-1', deletedAt: null },
      select: { id: true },
    });
    // trimmed name applied to originalFilename, keyed by id
    expect(update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: { originalFilename: 'Rego 2026.pdf' },
    });
  });

  it('returns not-found (and does NOT update) when the doc is not the user\'s', async () => {
    findFirst.mockResolvedValue(null);
    const r = await renameDocument('doc-x', 'user-1', 'Hijack.pdf');
    expect(r.success).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
