/**
 * Phase 42 PR6.5c — Review Queue card-stack ordering invariants.
 *
 * The card-stack is presentation-only — its semantics live in the
 * ordering function. If `orderReviewQueue()` ever stops surfacing
 * anomaly-flagged tx first, tax-pack correctness regresses
 * silently. These tests pin the contract.
 */

import { describe, it, expect } from 'vitest';
import { orderReviewQueue } from '../../components/bookkeeping/ReviewQueueCards';

interface Tx {
  id: string;
  date: string;
  amount: number;
  currency: string;
  direction: 'IN' | 'OUT';
  merchantRaw: string | null;
  merchantStandardised: string | null;
  description: string;
  categoryLevel1: string | null;
  anomalyFlags: string[];
  account: { id: string; name: string; institution: string };
}

const account = { id: 'a1', name: 'Daily', institution: 'CommBank' };

function tx(over: Partial<Tx>): Tx {
  return {
    id: 'tx-1',
    date: '2026-05-07',
    amount: -10,
    currency: 'AUD',
    direction: 'OUT',
    merchantRaw: 'M',
    merchantStandardised: 'M',
    description: 'M',
    categoryLevel1: null,
    anomalyFlags: [],
    account,
    ...over,
  };
}

describe('orderReviewQueue', () => {
  it('surfaces anomaly-flagged transactions before non-anomaly ones', () => {
    const input = [
      tx({ id: 'a', date: '2026-05-07', anomalyFlags: [] }),
      tx({ id: 'b', date: '2026-05-06', anomalyFlags: ['PRICE_INCREASE'] }),
      tx({ id: 'c', date: '2026-05-05', anomalyFlags: [] }),
    ];
    const out = orderReviewQueue(input);
    expect(out[0].id).toBe('b');
  });

  it('breaks ties on date — newest first within each anomaly bucket', () => {
    const input = [
      tx({ id: 'a', date: '2026-05-05' }),
      tx({ id: 'b', date: '2026-05-07' }),
      tx({ id: 'c', date: '2026-05-06' }),
    ];
    const out = orderReviewQueue(input);
    expect(out.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('preserves anomaly-first AND newest-within-bucket together', () => {
    const input = [
      tx({ id: 'a', date: '2026-05-07', anomalyFlags: [] }),
      tx({ id: 'b', date: '2026-05-05', anomalyFlags: ['UNUSUAL_AMOUNT'] }),
      tx({ id: 'c', date: '2026-05-06', anomalyFlags: ['PRICE_INCREASE'] }),
      tx({ id: 'd', date: '2026-05-04', anomalyFlags: [] }),
    ];
    const out = orderReviewQueue(input);
    // Anomalies first (newest first within), then non-anomalies (newest first)
    expect(out.map((t) => t.id)).toEqual(['c', 'b', 'a', 'd']);
  });

  it('does not mutate the input array', () => {
    const input = [tx({ id: 'a' }), tx({ id: 'b' })];
    const before = input.map((t) => t.id);
    orderReviewQueue(input);
    expect(input.map((t) => t.id)).toEqual(before);
  });

  it('returns an empty array when given an empty array', () => {
    expect(orderReviewQueue([])).toEqual([]);
  });

  it('handles single-item input', () => {
    const out = orderReviewQueue([tx({ id: 'only' })]);
    expect(out.map((t) => t.id)).toEqual(['only']);
  });

  it('treats multiple anomaly flags identically to one flag (just "has anomaly")', () => {
    const input = [
      tx({ id: 'a', date: '2026-05-07', anomalyFlags: ['PRICE_INCREASE'] }),
      tx({ id: 'b', date: '2026-05-06', anomalyFlags: ['PRICE_INCREASE', 'UNUSUAL_AMOUNT'] }),
    ];
    const out = orderReviewQueue(input);
    // Both are in the anomaly bucket, so the date tiebreaker decides — newest first
    expect(out.map((t) => t.id)).toEqual(['a', 'b']);
  });
});
