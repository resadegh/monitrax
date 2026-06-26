import { describe, it, expect } from 'vitest';
import { deriveRowStatus, summariseRowStates } from '@/lib/bookkeeping/transactionStatus';

/**
 * Phase 55 — the Activity row's single derived status. Each case maps to one of
 * the contradictions Reza reported on 2026-06-26 (the five-overlapping-signals bug).
 */
describe('deriveRowStatus — one clear status per row (Phase 55)', () => {
  it('transfer → "Transfer", done, no action — even with a null category (stale-row display fix, issue #4)', () => {
    const s = deriveRowStatus({ categoryLevel1: null, isTransfer: true, userCorrectedCategory: false });
    expect(s).toEqual({ state: 'done', label: 'Transfer', actionLabel: null, done: true });
  });

  it('linked to income but categoryLevel1="Other" → label "Income", done (issue #2: no more "OTHER" on a salary)', () => {
    const s = deriveRowStatus({ categoryLevel1: 'Other', isTransfer: false, incomeId: 'inc_1', userCorrectedCategory: true });
    expect(s.label).toBe('Income');
    expect(s.state).toBe('done');
    expect(s.actionLabel).toBeNull();
  });

  it('AI-categorised, not yet confirmed → suggested + single "Confirm" (issue #3: not three competing chips)', () => {
    const s = deriveRowStatus({ categoryLevel1: 'Groceries', isTransfer: false, userCorrectedCategory: false });
    expect(s).toEqual({ state: 'suggested', label: 'Groceries', actionLabel: 'Confirm', done: false });
  });

  it('genuinely uncategorised → needs-category + "Add category"', () => {
    const s = deriveRowStatus({ categoryLevel1: null, isTransfer: false, userCorrectedCategory: false });
    expect(s).toEqual({ state: 'needs-category', label: 'Uncategorised', actionLabel: 'Add category', done: false });
  });

  it('user-confirmed category → done, shows the category, no action', () => {
    const s = deriveRowStatus({ categoryLevel1: 'Utilities', isTransfer: false, userCorrectedCategory: true });
    expect(s).toEqual({ state: 'done', label: 'Utilities', actionLabel: null, done: true });
  });

  it('expense link keeps its category as the label', () => {
    const s = deriveRowStatus({ categoryLevel1: 'Insurance', isTransfer: false, expenseId: 'exp_1', userCorrectedCategory: false });
    expect(s.label).toBe('Insurance');
    expect(s.state).toBe('done');
  });

  it('transfer wins over a stale category string', () => {
    expect(deriveRowStatus({ categoryLevel1: 'Groceries', isTransfer: true }).label).toBe('Transfer');
  });

  it('summary tallies the three action-states (header reframe, issue #1)', () => {
    const rows = [
      { categoryLevel1: 'Utilities', isTransfer: false, userCorrectedCategory: true },   // done
      { categoryLevel1: null, isTransfer: true },                                         // done (transfer)
      { categoryLevel1: 'Groceries', isTransfer: false, userCorrectedCategory: false },   // suggested
      { categoryLevel1: null, isTransfer: false },                                        // needs-category
    ];
    expect(summariseRowStates(rows)).toEqual({ done: 2, suggested: 1, needsCategory: 1, total: 4 });
  });
});
