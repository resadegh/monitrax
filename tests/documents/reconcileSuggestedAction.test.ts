/**
 * Phase 50 D.2 — reconcileSuggestedAction unit tests.
 *
 * Pins the record-reconciliation contract without a live DB by mocking the
 * `prisma.<model>.findFirst` calls the reconciler makes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { expenseFindMany, incomeFindMany, loanFindFirst } = vi.hoisted(() => ({
  expenseFindMany: vi.fn(),
  incomeFindMany: vi.fn(),
  loanFindFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    expense: { findMany: expenseFindMany },
    income: { findMany: incomeFindMany },
    loan: { findFirst: loanFindFirst },
  },
}));

import { reconcileSuggestedAction } from '@/lib/documents/intelligence/reconcile/reconcileSuggestedAction';

beforeEach(() => {
  expenseFindMany.mockReset();
  expenseFindMany.mockResolvedValue([]);
  incomeFindMany.mockReset();
  incomeFindMany.mockResolvedValue([]);
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

  it('Mechanism A (MON-085): candidates are fetched ACROSS scopes; scope compatibility is decided by the classifier', async () => {
    // A scoped candidate (asset-9) vs a row on a DIFFERENT scope (asset-1):
    // fetched user-wide, but the classifier's scope rule blocks convergence.
    expenseFindMany.mockResolvedValue([
      { id: 'exp-other-asset', name: 'QBE', vendorName: null, amount: 100, propertyId: null, loanId: null, assetId: 'asset-1' },
    ]);
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', {
      vendor: 'QBE',
      amount: 100,
      assetId: 'asset-9',
    });
    expect(r).toEqual({ duplicate: false }); // two different scopes never converge
    const where = expenseFindMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: 'u1' }); // user-wide fetch — no scope filter
  });

  it('Mechanism A (MON-085): a scopeless row DOES converge with a scoped candidate (the battery class)', async () => {
    expenseFindMany.mockResolvedValue([
      { id: 'exp-gen', name: 'Battery System', vendorName: null, amount: 11385, propertyId: null, loanId: null, assetId: null },
    ]);
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', {
      name: 'Battery',
      amount: 11385,
      propertyId: 'prop-home',
    });
    expect(r).toEqual({ duplicate: true, existingId: 'exp-gen' });
  });

  it('returns no-match for an expense with no existing row', async () => {
    expenseFindMany.mockResolvedValue([]);
    const r = await reconcileSuggestedAction('u1', 'EXPENSE', { vendor: 'New', amount: 50 });
    expect(r).toEqual({ duplicate: false });
  });

  it('Mechanism A (MON-084/076): income matches on the SIGNATURE (type + normalised name) — a declared row and its reconciled twin converge across amount drift', async () => {
    incomeFindMany.mockResolvedValue([
      { id: 'inc-1', name: 'Acme Payroll Pty Ltd', amount: 8500, propertyId: null, investmentAccountId: null },
    ]);
    const r = await reconcileSuggestedAction('u1', 'INCOME', {
      name: 'Acme Payroll',
      amount: 5000, // far from 8500 — the old exact-amount match never caught this
      type: 'salary',
    });
    expect(r).toEqual({ duplicate: true, existingId: 'inc-1' });
    const where = incomeFindMany.mock.calls[0][0].where;
    expect(where.type).toBe('SALARY'); // type stays in the signature
    expect(where.name).toBeUndefined(); // name matching is normalised, not SQL-exact
  });

  it('Mechanism A: income on two DIFFERENT property scopes never converges (Lot 1 vs Lot 2)', async () => {
    incomeFindMany.mockResolvedValue([
      { id: 'inc-lot1', name: 'Cienna PM Trust', amount: 2600, propertyId: 'p-lot1', investmentAccountId: null },
    ]);
    const r = await reconcileSuggestedAction('u1', 'INCOME', {
      name: 'Cienna PM Trust',
      amount: 2600,
      type: 'RENTAL',
      propertyId: 'p-lot2',
    });
    expect(r).toEqual({ duplicate: false });
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
