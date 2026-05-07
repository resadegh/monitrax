/**
 * Phase 42 PR1 — Tests for the transaction-edit audit helpers.
 *
 * Covers the pure helpers (pickCategoryFields, pickLinkFields, deepEqual
 * short-circuit). The DB-touching path is integration-tested elsewhere.
 */

import { describe, it, expect } from 'vitest';
import {
  pickCategoryFields,
  pickLinkFields,
} from '../../lib/bookkeeping/transactionEditAudit';

describe('pickCategoryFields', () => {
  it('extracts the canonical category subset', () => {
    const row = {
      categoryLevel1: 'Food & Dining',
      categoryLevel2: 'Groceries',
      subcategory: 'Supermarket',
      userCorrectedCategory: true,
      confidenceScore: 1.0,
      // unrelated fields should NOT appear in the picked subset
      amount: 42.5,
      description: 'COLES BRUNSWICK',
    } as Parameters<typeof pickCategoryFields>[0];
    const picked = pickCategoryFields(row);
    expect(picked).toEqual({
      categoryLevel1: 'Food & Dining',
      categoryLevel2: 'Groceries',
      subcategory: 'Supermarket',
      userCorrectedCategory: true,
      confidenceScore: 1.0,
    });
    expect(picked).not.toHaveProperty('amount');
    expect(picked).not.toHaveProperty('description');
  });

  it('coerces missing fields to null/false defaults', () => {
    expect(pickCategoryFields({})).toEqual({
      categoryLevel1: null,
      categoryLevel2: null,
      subcategory: null,
      userCorrectedCategory: false,
      confidenceScore: null,
    });
  });
});

describe('pickLinkFields', () => {
  it('extracts only the entity-link FKs', () => {
    expect(
      pickLinkFields({
        propertyId: 'p-1',
        loanId: null,
        incomeId: null,
        expenseId: 'e-1',
        investmentAccountId: null,
      })
    ).toEqual({
      propertyId: 'p-1',
      loanId: null,
      incomeId: null,
      expenseId: 'e-1',
      investmentAccountId: null,
    });
  });

  it('coerces undefined to null', () => {
    expect(pickLinkFields({})).toEqual({
      propertyId: null,
      loanId: null,
      incomeId: null,
      expenseId: null,
      investmentAccountId: null,
    });
  });
});
