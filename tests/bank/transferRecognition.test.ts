import { describe, it, expect } from 'vitest';
import { categoriseTransactions } from '../../lib/bank/categorisation';
import type { NormalisedTransaction } from '../../lib/bank/types';
import type { TransactionDirection } from '@prisma/client';

/**
 * Pins the engine-level transfer-recognition fix. `lib/bank/categorisation.ts`
 * (`categoriseTransactions`) is the live engine for Basiq sync + bank import. Its
 * DEFAULT_RULES transfer entries are substring keywords ("transfer to" /
 * "transfer from") that MISS "To Reza Sadegh … Transfer" (keyword at the end),
 * so such transfers imported as Uncategorised. The SSOT detector short-circuit
 * now recognises them in any word order. Regression lock for Reza's report.
 */

function tx(description: string, over: Partial<NormalisedTransaction> = {}): NormalisedTransaction {
  return {
    id: 't1',
    date: new Date(Date.UTC(2026, 4, 20, 12, 0, 0)),
    description,
    rawDescription: description,
    amount: -1000,
    direction: 'OUT' as TransactionDirection,
    sourceFileId: 'f1',
    hash: 'h1',
    ...over,
  };
}

describe('categoriseTransactions — transfer recognition (engine-level)', () => {
  it('recognises the exact regression case: "To Reza Sadegh … Transfer"', () => {
    const { transactions } = categoriseTransactions([tx('To Reza Sadegh 01:51pm 20may Transfer')]);
    expect(transactions[0].categoryLevel1).toBe('Transfer');
    expect(transactions[0].categoryType).toBe('TRANSFER');
  });

  it('still recognises keyword-first formats', () => {
    expect(categoriseTransactions([tx('Transfer to John')]).transactions[0].categoryLevel1).toBe('Transfer');
    expect(categoriseTransactions([tx('OSKO Payment')]).transactions[0].categoryLevel1).toBe('Transfer');
    expect(categoriseTransactions([tx('Internal Transfer 123')]).transactions[0].categoryLevel1).toBe('Transfer');
  });

  it('does NOT mis-flag a normal merchant as a transfer', () => {
    const cat = categoriseTransactions([tx("georgio's Kitchen Macquarie Park")]).transactions[0].categoryLevel1;
    expect(cat).not.toBe('Transfer');
  });

  it('does NOT match "TransferWise" (word-boundary guard)', () => {
    expect(categoriseTransactions([tx('TransferWise AUD payment')]).transactions[0].categoryLevel1).not.toBe('Transfer');
  });
});
