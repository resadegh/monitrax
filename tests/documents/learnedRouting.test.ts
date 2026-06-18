/**
 * Phase 50 D.4 — learnedRouting unit tests.
 *
 * Pins the suggest-only routing-memory contract: normalization, routable-type
 * gating, the record/read DB interactions, and the autonomy guarantee that a
 * non-routable type or empty vendor never writes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { hintUpsert, hintFindFirst, analysisFindUnique } = vi.hoisted(() => ({
  hintUpsert: vi.fn(),
  hintFindFirst: vi.fn(),
  analysisFindUnique: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    vendorEntityHint: { upsert: hintUpsert, findFirst: hintFindFirst },
    documentAnalysis: { findUnique: analysisFindUnique },
  },
}));

import {
  normalizeVendorKey,
  isRoutableEntityType,
  recordVendorEntityHint,
  getVendorEntityHint,
  recordHintFromDocument,
} from '@/lib/documents/intelligence/learnedRouting';

beforeEach(() => {
  hintUpsert.mockReset();
  hintFindFirst.mockReset();
  analysisFindUnique.mockReset();
});

describe('normalizeVendorKey', () => {
  it('collapses case, spaces, punctuation and store numbers', () => {
    expect(normalizeVendorKey('Bunnings Warehouse')).toBe('bunningswarehouse');
    expect(normalizeVendorKey('BUNNINGS WAREHOUSE #4012')).toBe('bunningswarehouse4012');
    expect(normalizeVendorKey('bunnings  warehouse')).toBe('bunningswarehouse');
  });

  it('returns empty string for non-strings / empties', () => {
    expect(normalizeVendorKey(null)).toBe('');
    expect(normalizeVendorKey(undefined)).toBe('');
    expect(normalizeVendorKey(123)).toBe('');
    expect(normalizeVendorKey('   ')).toBe('');
  });
});

describe('isRoutableEntityType', () => {
  it('routes assets/properties/loans/accounts, not generic expense/income', () => {
    expect(isRoutableEntityType('ASSET')).toBe(true);
    expect(isRoutableEntityType('PROPERTY')).toBe(true);
    expect(isRoutableEntityType('LOAN')).toBe(true);
    expect(isRoutableEntityType('INVESTMENT_ACCOUNT')).toBe(true);
    expect(isRoutableEntityType('EXPENSE')).toBe(false);
    expect(isRoutableEntityType('INCOME')).toBe(false);
  });
});

describe('recordVendorEntityHint', () => {
  it('upserts a routable hint keyed by the unique tuple', async () => {
    hintUpsert.mockResolvedValue({});
    await recordVendorEntityHint('u1', 'Bunnings', 'PROPERTY', 'prop-1');
    expect(hintUpsert).toHaveBeenCalledTimes(1);
    const arg = hintUpsert.mock.calls[0][0];
    expect(arg.where.userId_vendorKey_entityType_entityId).toMatchObject({
      userId: 'u1',
      vendorKey: 'bunnings',
      entityType: 'PROPERTY',
      entityId: 'prop-1',
    });
    expect(arg.update.count).toEqual({ increment: 1 });
  });

  it('is a no-op for a non-routable entity type (never auto-learns expenses)', async () => {
    await recordVendorEntityHint('u1', 'Bunnings', 'EXPENSE', 'exp-1');
    expect(hintUpsert).not.toHaveBeenCalled();
  });

  it('is a no-op when the vendor is empty', async () => {
    await recordVendorEntityHint('u1', '   ', 'PROPERTY', 'prop-1');
    expect(hintUpsert).not.toHaveBeenCalled();
  });

  it('swallows DB errors (a routing memory is never load-bearing)', async () => {
    hintUpsert.mockRejectedValue(new Error('db down'));
    await expect(recordVendorEntityHint('u1', 'Bunnings', 'ASSET', 'a-1')).resolves.toBeUndefined();
  });
});

describe('getVendorEntityHint', () => {
  it('returns the most-chosen routing for the vendor', async () => {
    hintFindFirst.mockResolvedValue({ entityType: 'PROPERTY', entityId: 'prop-1', count: 3 });
    const hint = await getVendorEntityHint('u1', 'BUNNINGS #12');
    expect(hint).toEqual({ entityType: 'PROPERTY', entityId: 'prop-1', count: 3 });
    expect(hintFindFirst.mock.calls[0][0].where).toMatchObject({
      userId: 'u1',
      vendorKey: 'bunnings12',
    });
    expect(hintFindFirst.mock.calls[0][0].orderBy).toEqual([
      { count: 'desc' },
      { lastUsedAt: 'desc' },
    ]);
  });

  it('returns null for an empty vendor without hitting the DB', async () => {
    const hint = await getVendorEntityHint('u1', '');
    expect(hint).toBeNull();
    expect(hintFindFirst).not.toHaveBeenCalled();
  });

  it('returns null when there is no memory', async () => {
    hintFindFirst.mockResolvedValue(null);
    expect(await getVendorEntityHint('u1', 'NewVendor')).toBeNull();
  });
});

describe('recordHintFromDocument', () => {
  it('reads the vendor off the analysis (unwrapping ExtractedField) and records it', async () => {
    analysisFindUnique.mockResolvedValue({
      verifiedData: null,
      extractedData: { vendor: { value: 'QBE Insurance', confidence: 0.93 } },
    });
    hintUpsert.mockResolvedValue({});
    await recordHintFromDocument('u1', 'doc-1', 'PROPERTY', 'prop-1');
    expect(hintUpsert).toHaveBeenCalledTimes(1);
    expect(hintUpsert.mock.calls[0][0].create.vendorKey).toBe('qbeinsurance');
  });

  it('prefers verifiedData (user-corrected) over extractedData', async () => {
    analysisFindUnique.mockResolvedValue({
      verifiedData: { vendor: 'Corrected Vendor' },
      extractedData: { vendor: 'Raw Vendor' },
    });
    hintUpsert.mockResolvedValue({});
    await recordHintFromDocument('u1', 'doc-1', 'ASSET', 'a-1');
    expect(hintUpsert.mock.calls[0][0].create.vendorKey).toBe('correctedvendor');
  });

  it('is a no-op for non-routable types without touching the DB', async () => {
    await recordHintFromDocument('u1', 'doc-1', 'EXPENSE', 'exp-1');
    expect(analysisFindUnique).not.toHaveBeenCalled();
    expect(hintUpsert).not.toHaveBeenCalled();
  });

  it('is a no-op when the analysis has no vendor', async () => {
    analysisFindUnique.mockResolvedValue({ verifiedData: null, extractedData: { amount: 10 } });
    await recordHintFromDocument('u1', 'doc-1', 'PROPERTY', 'prop-1');
    expect(hintUpsert).not.toHaveBeenCalled();
  });
});
