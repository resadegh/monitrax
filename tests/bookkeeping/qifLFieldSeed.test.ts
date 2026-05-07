/**
 * Phase 42 PR4 — Tests for the QIF `L` field categorisation seed.
 *
 * The L field is a strong (but not authoritative) signal that the
 * bank itself categorised this transaction. Per spec §4 PR4 we
 * apply it as a +0.15 confidence boost over the base rate (= 0.75
 * total), which positions it BELOW user/system rules (0.9) but
 * ABOVE the AI fallback.
 *
 * The mapping function lives inside lib/bank/categorisation.ts as
 * an internal helper. We test it via the public `categoriseTransactions`
 * entry point — the seed only fires when no rule matched.
 */

import { describe, it, expect } from 'vitest';
import { categoriseTransactions } from '../../lib/bank/categorisation';
import type { NormalisedTransaction } from '../../lib/bank/types';

function tx(over: Partial<NormalisedTransaction>): NormalisedTransaction {
  return {
    id: 't',
    date: new Date('2026-10-22'),
    description: 'Random unmatched description xyz',
    rawDescription: 'Random unmatched description xyz',
    amount: 50,
    direction: 'OUT',
    sourceFileId: 'sf-1',
    hash: 'h',
    ...over,
  };
}

describe('QIF L-field seed (categoriseTransaction)', () => {
  it('routes unrecognised description with bankSuppliedCategory="Groceries" → Food & Dining / Groceries @ 0.75', () => {
    const r = categoriseTransactions([
      tx({ bankSuppliedCategory: 'Groceries' }),
    ]);
    const cat = r.transactions[0];
    expect(cat.categoryLevel1).toBe('Food & Dining');
    expect(cat.categoryLevel2).toBe('Groceries');
    expect(cat.confidenceScore).toBeCloseTo(0.75, 2);
  });

  it('treats QIF transfer brackets [Account] as Transfer / Internal', () => {
    const r = categoriseTransactions([
      tx({ bankSuppliedCategory: '[Savings Acct]', description: 'TFR' }),
    ]);
    expect(r.transactions[0].categoryLevel1).toBe('Transfer');
    expect(r.transactions[0].categoryLevel2).toBe('Internal');
  });

  it('routes "salary" L-field to Income / Salary', () => {
    const r = categoriseTransactions([
      tx({ bankSuppliedCategory: 'Salary', direction: 'IN' }),
    ]);
    expect(r.transactions[0].categoryLevel1).toBe('Income');
    expect(r.transactions[0].categoryLevel2).toBe('Salary');
  });

  it('routes "rent income" → Income / Rent', () => {
    const r = categoriseTransactions([
      tx({ bankSuppliedCategory: 'Rent income', direction: 'IN' }),
    ]);
    expect(r.transactions[0].categoryLevel1).toBe('Income');
    expect(r.transactions[0].categoryLevel2).toBe('Rent');
  });

  it('routes "council rates" → Property / Rates', () => {
    const r = categoriseTransactions([
      tx({ bankSuppliedCategory: 'Council rates' }),
    ]);
    expect(r.transactions[0].categoryLevel1).toBe('Property');
    expect(r.transactions[0].categoryLevel2).toBe('Rates');
  });

  it('routes "Electric" → Utilities / Energy', () => {
    const r = categoriseTransactions([
      tx({ bankSuppliedCategory: 'Electricity bill' }),
    ]);
    expect(r.transactions[0].categoryLevel1).toBe('Utilities');
    expect(r.transactions[0].categoryLevel2).toBe('Energy');
  });

  it('routes "Streaming" → Subscriptions', () => {
    const r = categoriseTransactions([
      tx({ bankSuppliedCategory: 'Streaming subscription' }),
    ]);
    expect(r.transactions[0].categoryLevel1).toBe('Subscriptions');
  });

  it('falls through to Uncategorised when L-field is unknown', () => {
    const r = categoriseTransactions([
      tx({ bankSuppliedCategory: 'Some random unmappable category XYZ' }),
    ]);
    expect(r.transactions[0].categoryLevel1).toBe('Uncategorised');
    expect(r.transactions[0].confidenceScore).toBe(0);
  });

  it('rule-engine match wins over the L-field seed', () => {
    // Description "salary" triggers a high-priority rule; even though
    // L-field says "Property", the rule must win.
    const r = categoriseTransactions([
      tx({
        description: 'NAB salary deposit',
        rawDescription: 'NAB salary deposit',
        direction: 'IN',
        bankSuppliedCategory: 'Property',
      }),
    ]);
    expect(r.transactions[0].categoryLevel1).toBe('Income');
    expect(r.transactions[0].confidenceScore).toBe(0.9);
  });

  it('no L-field + no rule match → Uncategorised at 0', () => {
    const r = categoriseTransactions([tx({})]);
    expect(r.transactions[0].categoryLevel1).toBe('Uncategorised');
    expect(r.transactions[0].confidenceScore).toBe(0);
  });
});
