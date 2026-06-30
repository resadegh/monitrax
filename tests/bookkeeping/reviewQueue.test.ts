/**
 * Phase 56.3 — the review-queue SSOT (`lib/bank/bulkConfirm.ts`).
 *
 * Guards the canonical "needs your review" predicate (Reza 2026-06-30:
 * "anything the user hasn't confirmed, all-time"). If these fields drift, the
 * Home hero, the Activity bands, and the card-deck silently disagree again —
 * the exact SSOT violation this module was created to kill.
 */

import { describe, it, expect } from 'vitest';
import { REVIEW_QUEUE_FIELDS, reviewQueueWhere } from '../../lib/bank/bulkConfirm';

describe('REVIEW_QUEUE_FIELDS (the canonical "needs review" predicate)', () => {
  it('requires no income / expense / loan link', () => {
    expect(REVIEW_QUEUE_FIELDS.incomeId).toBeNull();
    expect(REVIEW_QUEUE_FIELDS.expenseId).toBeNull();
    expect(REVIEW_QUEUE_FIELDS.loanId).toBeNull();
  });

  it('excludes transfers and investment contributions (false OR legacy null)', () => {
    expect(REVIEW_QUEUE_FIELDS.isTransfer).toEqual({ not: true });
    expect(REVIEW_QUEUE_FIELDS.isInvestmentContribution).toEqual({ not: true });
  });

  it('is "user has not confirmed yet" — NOT a categoryLevel1 check', () => {
    // The load-bearing rule: AI-auto-classified rows (which HAVE a
    // categoryLevel1) still count until the user confirms them.
    expect(REVIEW_QUEUE_FIELDS.userCorrectedCategory).toEqual({ not: true });
    expect('categoryLevel1' in REVIEW_QUEUE_FIELDS).toBe(false);
  });

  it('carries NO date window — the count is all-time (Reza 2026-06-30)', () => {
    expect('date' in REVIEW_QUEUE_FIELDS).toBe(false);
  });

  it('reviewQueueWhere scopes the canonical fields to a userId', () => {
    const where = reviewQueueWhere('user-123');
    expect(where.userId).toBe('user-123');
    expect(where.userCorrectedCategory).toEqual({ not: true });
    expect(where.incomeId).toBeNull();
  });
});
