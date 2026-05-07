/**
 * Phase 42 PR5 — Tests for the Xero bank-statement-import CSV exporter.
 *
 * The exporter is the LOAD-BEARING handoff to Xero. The accountant
 * uploads this file to Xero's "Import statement" surface; if the
 * format drifts (header order, date format, signed-amount column,
 * RFC 4180 escaping), Xero rejects the import. These tests are the
 * contract.
 */

import { describe, it, expect } from 'vitest';
import {
  formatXeroDate,
  escapeCsv,
  formatXeroAmount,
  transactionToXeroRow,
  renderXeroRow,
  renderXeroCsv,
  suggestedXeroFilename,
  XERO_CSV_HEADER,
} from '../../lib/bookkeeping/taxPack/csvExporter';
import type { UnifiedTransaction } from '@prisma/client';

function tx(over: Partial<UnifiedTransaction>): UnifiedTransaction {
  return {
    id: 't',
    userId: 'u',
    accountId: 'a',
    date: new Date(Date.UTC(2026, 9, 22)),
    postDate: null,
    amount: -42.5,
    currency: 'AUD',
    direction: 'OUT',
    merchantRaw: 'COLES BRUNSWICK',
    merchantStandardised: 'Coles',
    merchantCategoryCode: '5411',
    description: 'Groceries',
    categoryLevel1: 'Food & Dining',
    categoryLevel2: 'Groceries',
    subcategory: null,
    tags: [],
    userCorrectedCategory: false,
    confidenceScore: 0.9,
    isRecurring: false,
    recurrencePattern: null,
    recurrenceGroupId: null,
    isEssential: false,
    isTransfer: false,
    transferToAccountId: null,
    isInvestmentContribution: false,
    investmentTransactionId: null,
    anomalyFlags: [],
    source: 'QIF',
    externalId: 'REF123',
    basiqTransactionId: null,
    importBatchId: null,
    propertyId: null,
    loanId: null,
    incomeId: null,
    expenseId: null,
    investmentAccountId: null,
    normalisedDescriptionHash: null,
    matchedDocumentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
    ...over,
  } as UnifiedTransaction;
}

describe('formatXeroDate', () => {
  it('renders DD/MM/YYYY (AU format)', () => {
    expect(formatXeroDate(new Date(Date.UTC(2026, 0, 5)))).toBe('05/01/2026');
    expect(formatXeroDate(new Date(Date.UTC(2026, 11, 31)))).toBe('31/12/2026');
  });
  it('zero-pads single-digit days + months', () => {
    expect(formatXeroDate(new Date(Date.UTC(2026, 0, 1)))).toBe('01/01/2026');
  });
});

describe('formatXeroAmount', () => {
  it('always emits 2 decimal places', () => {
    expect(formatXeroAmount(42)).toBe('42.00');
    expect(formatXeroAmount(42.5)).toBe('42.50');
    expect(formatXeroAmount(0)).toBe('0.00');
  });
  it('preserves the negative sign for OUT transactions', () => {
    expect(formatXeroAmount(-42.5)).toBe('-42.50');
  });
  it('handles non-finite gracefully', () => {
    expect(formatXeroAmount(Number.NaN)).toBe('0.00');
    expect(formatXeroAmount(Number.POSITIVE_INFINITY)).toBe('0.00');
  });
});

describe('escapeCsv (RFC 4180)', () => {
  it('passes plain values through unquoted', () => {
    expect(escapeCsv('Coles Brunswick')).toBe('Coles Brunswick');
    expect(escapeCsv('REF123')).toBe('REF123');
  });
  it('quotes values containing commas', () => {
    expect(escapeCsv('Coles, Brunswick')).toBe('"Coles, Brunswick"');
  });
  it('quotes + doubles values containing quotes', () => {
    expect(escapeCsv('Big "Bunnings"')).toBe('"Big ""Bunnings"""');
  });
  it('quotes values containing newlines (CR or LF)', () => {
    expect(escapeCsv('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsv('line1\rline2')).toBe('"line1\rline2"');
  });
  it('returns empty for empty input', () => {
    expect(escapeCsv('')).toBe('');
  });
});

describe('XERO_CSV_HEADER', () => {
  it('is the exact column order Xero expects', () => {
    expect(XERO_CSV_HEADER).toBe('Date,Amount,Payee,Description,Reference');
  });
});

describe('transactionToXeroRow', () => {
  it('preserves the signed amount (OUT negative, IN positive)', () => {
    expect(transactionToXeroRow(tx({ amount: -42.5, direction: 'OUT' })).amount).toBe(-42.5);
    expect(transactionToXeroRow(tx({ amount: 1200, direction: 'IN' })).amount).toBe(1200);
  });
  it('prefers merchantStandardised over merchantRaw + description for payee', () => {
    const row = transactionToXeroRow(tx({}));
    expect(row.payee).toBe('Coles');
  });
  it('falls back to merchantRaw when standardised is null', () => {
    const row = transactionToXeroRow(tx({ merchantStandardised: null }));
    expect(row.payee).toBe('COLES BRUNSWICK');
  });
  it('uses externalId as reference', () => {
    const row = transactionToXeroRow(tx({}));
    expect(row.reference).toBe('REF123');
  });
});

describe('renderXeroRow', () => {
  it('produces a complete CSV row in the canonical column order', () => {
    const row = renderXeroRow({
      date: new Date(Date.UTC(2026, 9, 22)),
      amount: -42.5,
      payee: 'Coles',
      description: 'Groceries',
      reference: 'REF123',
    });
    expect(row).toBe('22/10/2026,-42.50,Coles,Groceries,REF123');
  });
  it('escapes payees containing commas', () => {
    const row = renderXeroRow({
      date: new Date(Date.UTC(2026, 9, 22)),
      amount: -42.5,
      payee: 'Coles, Brunswick',
      description: 'Groceries',
      reference: null,
    });
    expect(row).toBe('22/10/2026,-42.50,"Coles, Brunswick",Groceries,');
  });
});

describe('renderXeroCsv', () => {
  it('emits the header + one row per transaction + trailing newline', () => {
    const csv = renderXeroCsv([tx({})]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Date,Amount,Payee,Description,Reference');
    expect(lines[1]).toBe('22/10/2026,-42.50,Coles,Groceries,REF123');
    expect(lines[2]).toBe(''); // trailing newline
  });
  it('preserves transaction order (caller pre-sorts)', () => {
    const a = tx({ date: new Date(Date.UTC(2026, 9, 1)), description: 'A' });
    const b = tx({ date: new Date(Date.UTC(2026, 9, 22)), description: 'B' });
    const csv = renderXeroCsv([a, b]);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('A');
    expect(lines[2]).toContain('B');
  });
  it('omits the header when header=false', () => {
    const csv = renderXeroCsv([tx({})], { header: false });
    expect(csv.startsWith('Date,Amount')).toBe(false);
    expect(csv.startsWith('22/10/2026,')).toBe(true);
  });
  it('omits the trailing newline when trailingNewline=false', () => {
    const csv = renderXeroCsv([tx({})], { trailingNewline: false });
    expect(csv.endsWith('REF123')).toBe(true);
    expect(csv.endsWith('\n')).toBe(false);
  });
  it('handles an empty transaction list gracefully', () => {
    expect(renderXeroCsv([])).toBe('Date,Amount,Payee,Description,Reference\n');
  });
});

describe('suggestedXeroFilename', () => {
  it('matches the monitrax-xero-import-YYYY-MM-DD.csv pattern', () => {
    expect(suggestedXeroFilename()).toMatch(/^monitrax-xero-import-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
