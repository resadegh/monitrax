/**
 * Phase 42 PR6.5i — Transfer auto-pairing matching tests.
 *
 * The pairing rules are strict by design — false pairs would
 * silently break the user's analytics by tagging the wrong
 * destination arrival as a transfer. These tests pin the 7
 * matching criteria so a future relaxation has to be deliberate.
 */

import { describe, it, expect } from 'vitest';
import {
  filterPairCandidates,
  TRANSFER_PAIR_AMOUNT_TOLERANCE,
  TRANSFER_PAIR_WINDOW_DAYS,
} from '../../lib/bookkeeping/transferPairing';
import type { TransactionDirection } from '@prisma/client';

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

interface TxLite {
  id: string;
  userId: string;
  accountId: string;
  date: Date;
  amount: number;
  direction: TransactionDirection;
  isTransfer: boolean;
  expenseId: string | null;
  incomeId: string | null;
  loanId: string | null;
}

function tx(over: Partial<TxLite>): TxLite {
  return {
    id: 'c1',
    userId: 'u1',
    accountId: 'B',
    date: day(2026, 5, 8),
    amount: 100,
    direction: 'IN',
    isTransfer: false,
    expenseId: null,
    incomeId: null,
    loanId: null,
    ...over,
  };
}

const source: TxLite = {
  id: 'src',
  userId: 'u1',
  accountId: 'A',
  date: day(2026, 5, 8),
  amount: -100,
  direction: 'OUT',
  isTransfer: true,
  expenseId: null,
  incomeId: null,
  loanId: null,
};

describe('filterPairCandidates', () => {
  it('matches an opposite-direction same-amount same-day candidate on the destination account', () => {
    const matches = filterPairCandidates(source, 'B', [tx({})]);
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('c1');
  });

  it('rejects candidates on a different account', () => {
    expect(filterPairCandidates(source, 'B', [tx({ accountId: 'C' })])).toHaveLength(0);
  });

  it('rejects candidates with the same direction (not opposite)', () => {
    expect(filterPairCandidates(source, 'B', [tx({ direction: 'OUT' })])).toHaveLength(0);
  });

  it('matches when amount differs within the $0.01 tolerance', () => {
    const out = filterPairCandidates(source, 'B', [tx({ amount: 100.01 })]);
    expect(out).toHaveLength(1);
  });

  it('rejects when amount differs by more than the tolerance', () => {
    const out = filterPairCandidates(source, 'B', [tx({ amount: 100.5 })]);
    expect(out).toHaveLength(0);
  });

  it('matches when source amount is negative and destination positive (sign-agnostic)', () => {
    // Source has amount=-100 (OUT). Destination has amount=+100 (IN).
    // Absolute values match → pair.
    const out = filterPairCandidates(source, 'B', [tx({ amount: 100 })]);
    expect(out).toHaveLength(1);
  });

  it('matches when destination is within the day window', () => {
    const onTime = filterPairCandidates(source, 'B', [tx({ date: day(2026, 5, 11) })]);
    expect(onTime).toHaveLength(1);
  });

  it('rejects when destination is outside the day window', () => {
    // Window is ±3 days. Source is May 8. Day 12 is 4 days later.
    const tooFar = filterPairCandidates(source, 'B', [tx({ date: day(2026, 5, 12) })]);
    expect(tooFar).toHaveLength(0);
  });

  it('rejects already-tagged-as-transfer candidates', () => {
    expect(filterPairCandidates(source, 'B', [tx({ isTransfer: true })])).toHaveLength(0);
  });

  it('rejects candidates already linked to an Expense', () => {
    expect(filterPairCandidates(source, 'B', [tx({ expenseId: 'e1' })])).toHaveLength(0);
  });

  it('rejects candidates already linked to an Income', () => {
    expect(filterPairCandidates(source, 'B', [tx({ incomeId: 'i1' })])).toHaveLength(0);
  });

  it('rejects candidates already linked to a Loan', () => {
    expect(filterPairCandidates(source, 'B', [tx({ loanId: 'l1' })])).toHaveLength(0);
  });

  it('rejects candidates from a different user', () => {
    expect(filterPairCandidates(source, 'B', [tx({ userId: 'u2' })])).toHaveLength(0);
  });

  it('rejects self-match (defensive)', () => {
    expect(filterPairCandidates(source, 'B', [tx({ id: 'src' })])).toHaveLength(0);
  });

  it('returns multiple matches when more than one candidate qualifies (caller must handle)', () => {
    const out = filterPairCandidates(source, 'B', [
      tx({ id: 'c1' }),
      tx({ id: 'c2', date: day(2026, 5, 9) }),
    ]);
    expect(out).toHaveLength(2);
    // Caller in `pairTransferIfPossible` returns null on length !== 1.
  });

  it('returns empty when zero candidates match', () => {
    expect(filterPairCandidates(source, 'B', [])).toHaveLength(0);
  });
});

describe('TRANSFER_PAIR_WINDOW_DAYS constant', () => {
  it('is 3 days (strict — keeps false-pair rate near zero)', () => {
    expect(TRANSFER_PAIR_WINDOW_DAYS).toBe(3);
  });
});

describe('TRANSFER_PAIR_AMOUNT_TOLERANCE constant', () => {
  it('is $0.01 (single-cent FX-rounding tolerance only)', () => {
    expect(TRANSFER_PAIR_AMOUNT_TOLERANCE).toBe(0.01);
  });
});
