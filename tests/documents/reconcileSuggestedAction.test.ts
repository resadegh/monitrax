/**
 * Phase 50 D.2 — reconcileSuggestedAction unit tests.
 *
 * Pins the record-reconciliation contract without a live DB by mocking the
 * `prisma.<model>.findFirst` calls the reconciler makes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { expenseFindFirst, incomeFindFirst, loanFindFirst } = vi.hoisted(() => ({
  expenseFindFirst: vi.fn(),
  incomeFindFirst: vi.fn(),
  loanFindFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    expense: { findFirst: expenseFindFirst },
    income: { findFirst: incomeFindFirst },
    loan: { findFirst: loanFindFirst },
  },
}));

import { reconcileSuggestedAction } from '@/lib/documents/intelligence/reconcile/reconcileSuggestedAction';

beforeEach(() => {
  expenseFindFirst.mockReset();
  incomeFindFirst.mockReset();
  loanFindFirst.mockReset();
});

describe('reconcileSuggestedAction', () => {
  it('returns no-match when there is nothing to match on (no amount)', async () => {
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', { vendor: 'QBE' });
    expect(r).toEqual({ duplicate: false });
    expect(expenseFindFirst).not.toHaveBeenCalled();
  });

  it('returns no-match when there is no name/vendor', async () => {
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', { amount: 215.59 });
    expect(r).toEqual({ duplicate: false });
    expect(expenseFindFirst).not.toHaveBeenCalled();
  });

  it('flags a duplicate expense on same user + amount + vendor', async () => {
    expenseFindFirst.mockResolvedValue({ id: 'exp-1' });
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', {
      vendor: 'QBE Insurance',
      amount: 215.59,
    });
    expect(r).toEqual({ duplicate: true, existingId: 'exp-1' });
    const where = expenseFindFirst.mock.calls[0][0].where;
    expect(where.userId).toBe('u1');
    expect(where.amount).toBe(215.59);
    expect(where.OR).toEqual([{ vendorName: 'QBE Insurance' }, { name: 'QBE Insurance' }]);
  });

  it('scopes the expense match to the linked asset when provided', async () => {
    expenseFindFirst.mockResolvedValue(null);
    await reconcileSuggestedAction('u1', 'EXPENSE', {
      vendor: 'QBE',
      amount: 100,
      assetId: 'asset-9',
    });
    expect(expenseFindFirst.mock.calls[0][0].where.assetId).toBe('asset-9');
  });

  it('returns no-match for an expense with no existing row', async () => {
    expenseFindFirst.mockResolvedValue(null);
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
