/**
 * Phase 51.1 — loan-statement import: pure-logic tests (classification +
 * mapping + dedup hash). The DB-touching `importLoanStatement()` is covered by
 * its callers/integration; here we lock the classification rules + the stable
 * dedup key that prevents re-imported statements from doubling the ledger.
 */

import { describe, it, expect } from 'vitest';
import { LoanTransactionKind, TransactionDirection } from '@prisma/client';
import {
  classifyLoanRow,
  computeLoanRowHash,
  mapLoanStatement,
} from '@/lib/bookkeeping/loanLedger/importLoanStatement';
import type { ParsedFile } from '@/lib/bank/types';

describe('classifyLoanRow', () => {
  it('keyword: interest → INTEREST_CHARGED', () => {
    expect(classifyLoanRow({ description: 'Interest charged', direction: 'OUT', amount: -842.1 })).toBe(
      LoanTransactionKind.INTEREST_CHARGED
    );
  });
  it('keyword: repayment → REPAYMENT_RECEIVED', () => {
    expect(classifyLoanRow({ description: 'Loan repayment received', direction: 'IN', amount: 1271.34 })).toBe(
      LoanTransactionKind.REPAYMENT_RECEIVED
    );
  });
  it('keyword: redraw → REDRAW (purpose-classification event, before fee/interest)', () => {
    expect(classifyLoanRow({ description: 'Redraw to everyday', direction: 'OUT', amount: -5000 })).toBe(
      LoanTransactionKind.REDRAW
    );
  });
  it('keyword: fee → FEE', () => {
    expect(classifyLoanRow({ description: 'Monthly account fee', direction: 'OUT', amount: -10 })).toBe(
      LoanTransactionKind.FEE
    );
  });
  it('direction fallback: IN (credit reduces balance) → REPAYMENT_RECEIVED', () => {
    expect(classifyLoanRow({ description: 'EFT 0042', direction: 'IN', amount: 900 })).toBe(
      LoanTransactionKind.REPAYMENT_RECEIVED
    );
  });
  it('direction fallback: OUT (charge increases balance) → INTEREST_CHARGED', () => {
    expect(classifyLoanRow({ description: 'Misc', direction: 'OUT', amount: -50 })).toBe(
      LoanTransactionKind.INTEREST_CHARGED
    );
  });
});

describe('computeLoanRowHash', () => {
  const base = { loanId: 'loan-1', date: new Date('2026-05-15T00:00:00Z'), amount: 1271.34, description: 'Loan repayment' };
  it('is stable for the same row (re-import dedup)', () => {
    expect(computeLoanRowHash(base)).toBe(computeLoanRowHash({ ...base }));
  });
  it('ignores description case/whitespace (normalised)', () => {
    expect(computeLoanRowHash(base)).toBe(computeLoanRowHash({ ...base, description: '  LOAN   repayment ' }));
  });
  it('differs when amount differs (variable IO repayment is a distinct row)', () => {
    expect(computeLoanRowHash(base)).not.toBe(computeLoanRowHash({ ...base, amount: 1275.34 }));
  });
  it('differs across loans', () => {
    expect(computeLoanRowHash(base)).not.toBe(computeLoanRowHash({ ...base, loanId: 'loan-2' }));
  });
});

describe('mapLoanStatement', () => {
  const parsed: ParsedFile = {
    format: 'QIF',
    totalRows: 3,
    transactions: [
      { rowNumber: 1, rawData: {}, date: new Date('2026-05-15'), amount: -842.1, direction: 'OUT', description: 'Interest charged', balance: 482104.55 },
      { rowNumber: 2, rawData: {}, date: new Date('2026-05-15'), amount: 1271.34, direction: 'IN', description: 'Loan repayment' },
      { rowNumber: 3, rawData: {}, description: 'No date — skipped' }, // missing date/amount
    ],
  };
  const rows = mapLoanStatement('loan-1', parsed);

  it('skips rows without a date or amount', () => {
    expect(rows).toHaveLength(2);
  });
  it('stores absolute amount + derived direction + classified kind', () => {
    const interest = rows[0];
    expect(interest.amount).toBe(842.1);
    expect(interest.direction).toBe(TransactionDirection.OUT);
    expect(interest.kind).toBe(LoanTransactionKind.INTEREST_CHARGED);
    expect(interest.balanceAfter).toBe(482104.55);
  });
  it('carries a contentHash per row', () => {
    expect(rows[0].contentHash).toMatch(/^[a-f0-9]{32}$/);
    expect(rows[0].contentHash).not.toBe(rows[1].contentHash);
  });
});
