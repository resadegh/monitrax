/**
 * Phase 50 D.2 — reconcileSuggestedAction unit tests.
 *
 * Pins the record-reconciliation contract without a live DB by mocking the
 * `prisma.<model>.findFirst` calls the reconciler makes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { expenseFindMany, incomeFindFirst, loanFindFirst } = vi.hoisted(() => ({
  expenseFindMany: vi.fn(),
  incomeFindFirst: vi.fn(),
  loanFindFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    expense: { findMany: expenseFindMany },
    income: { findFirst: incomeFindFirst },
    loan: { findFirst: loanFindFirst },
  },
}));

import { reconcileSuggestedAction } from '@/lib/documents/intelligence/reconcile/reconcileSuggestedAction';

beforeEach(() => {
  expenseFindMany.mockReset();
  expenseFindMany.mockResolvedValue([]);
  incomeFindFirst.mockReset();
  loanFindFirst.mockReset();
});

describe('reconcileSuggestedAction', () => {
  it('returns no-match when there is nothing to match on (no amount)', async () => {
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', { vendor: 'QBE' });
    expect(r).toEqual({ duplicate: false });
    expect(expenseFindMany).not.toHaveBeenCalled();
  });

  it('returns no-match when there is no name/vendor', async () => {
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', { amount: 215.59 });
    expect(r).toEqual({ duplicate: false });
    expect(expenseFindMany).not.toHaveBeenCalled();
  });

  it('flags a duplicate expense on same user + amount + vendor', async () => {
    expenseFindMany.mockResolvedValue([
      { id: 'exp-1', name: 'QBE Insurance', vendorName: null, amount: 215.59 },
    ]);
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', {
      vendor: 'QBE Insurance',
      amount: 215.59,
    });
    expect(r).toEqual({ duplicate: true, existingId: 'exp-1' });
    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
  });

  it('MON-037 RC-B: flags a NAME-VARIANT duplicate ("Battery System" estimate vs "Battery" import)', async () => {
    expenseFindMany.mockResolvedValue([
      { id: 'exp-bat', name: 'Battery System', vendorName: null, amount: 11385 },
    ]);
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', {
      name: 'Battery',
      amount: 11385,
      propertyId: 'prop-home',
    });
    expect(r).toEqual({ duplicate: true, existingId: 'exp-bat' });
  });

  it('MON-037 RC-B: same name but far amount is NOT a duplicate (two real costs)', async () => {
    expenseFindMany.mockResolvedValue([
      { id: 'exp-bat', name: 'Battery', vendorName: null, amount: 11385 },
    ]);
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', { name: 'Battery', amount: 2500 });
    expect(r).toEqual({ duplicate: false });
  });

  it('scopes the expense match to the linked asset when provided', async () => {
    expenseFindMany.mockResolvedValue([]);
    await reconcileSuggestedAction('u1', 'EXPENSE', {
      vendor: 'QBE',
      amount: 100,
      assetId: 'asset-9',
    });
    expect(expenseFindMany.mock.calls[0][0].where.assetId).toBe('asset-9');
  });

  it('returns no-match for an expense with no existing row', async () => {
    expenseFindMany.mockResolvedValue([]);
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', { vendor: 'New', amount: 50 });
    expect(r).toEqual({ duplicate: false });
  });

  it('matches income on user + amount + name + type', async () => {
    incomeFindFirst.mockResolvedValue({ id: 'inc-1' });
    const r = await reconcileSuggestedAction('u1', 'INCOME', {
      name: 'Acme Payroll',
      amount: 5000,
      type: 'salary',
    });
    expect(r).toEqual({ duplicate: true, existingId: 'inc-1' });
    const where = incomeFindFirst.mock.calls[0][0].where;
    expect(where.name).toBe('Acme Payroll');
    expect(where.type).toBe('SALARY');
  });

  it('matches loan on user + name + principal (falls back to amount)', async () => {
    loanFindFirst.mockResolvedValue({ id: 'loan-1' });
    const r = await reconcileSuggestedAction('u1', 'LOAN', {
      name: 'CBA Home Loan',
      amount: 400000,
    });
    expect(r).toEqual({ duplicate: true, existingId: 'loan-1' });
    expect(loanFindFirst.mock.calls[0][0].where.principal).toBe(400000);
  });
});
