/**
 * CSV import parser (2026-07-02) — Reza: "some banks still don't have QIF".
 *
 * The account import route wires `parseCSV` alongside `parseQIF`. These tests
 * pin that a realistic AU-bank CSV (auto-detected by header) parses into
 * transactions with the right date / amount / direction, and that garbage
 * returns 0 rows (so the route surfaces the friendly "check your columns"
 * message rather than importing nonsense).
 */
import { describe, it, expect } from 'vitest';
import { parseCSV } from '@/lib/bank/parsers/csv';

describe('parseCSV — AU bank CSV import', () => {
  it('parses a generic date/description/amount CSV (signed amounts)', () => {
    const csv = [
      'date,description,amount',
      '18/06/2026,WOOLWORTHS 1234 SYDNEY,-52.40',
      '17/06/2026,SALARY ACME PTY LTD,3200.00',
    ].join('\n');
    const out = parseCSV(csv);
    expect(out.format).toBe('CSV');
    expect(out.transactions).toHaveLength(2);

    const spend = out.transactions[0];
    expect(spend.description).toContain('WOOLWORTHS');
    expect(Math.abs(spend.amount!)).toBeCloseTo(52.4, 2);
    expect(spend.direction).toBe('OUT');

    const income = out.transactions[1];
    expect(income.amount).toBeCloseTo(3200, 2);
    expect(income.direction).toBe('IN');
  });

  it('parses a NAB-style CSV (separate Debits / Credits columns)', () => {
    const csv = [
      'Date,Transaction Details,Debits,Credits',
      '18 Jun 26,EFTPOS COLES,45.10,',
      '17 Jun 26,INTEREST PAID,,1.23',
    ].join('\n');
    const out = parseCSV(csv);
    expect(out.transactions).toHaveLength(2);
    expect(out.transactions[0].direction).toBe('OUT');
    expect(Math.abs(out.transactions[0].amount!)).toBeCloseTo(45.1, 2);
    expect(out.transactions[1].direction).toBe('IN');
    expect(out.transactions[1].amount).toBeCloseTo(1.23, 2);
  });

  it('returns 0 transactions for content with no recognisable columns', () => {
    const out = parseCSV('just a line of prose with no columns at all');
    expect(out.transactions).toHaveLength(0);
  });

  it('returns 0 transactions for empty content', () => {
    expect(parseCSV('').transactions).toHaveLength(0);
  });
});

describe('parseCSV — headerless CSVs (NAB-style; 2026-07-02 fix)', () => {
  it('infers date/amount/description from a headerless CSV (no phantom header row)', () => {
    // Date, Amount(signed), Description, Balance — no header row.
    const csv = [
      '02/07/2026,-52.40,WOOLWORTHS SYDNEY,1000.00',
      '01/07/2026,-18.00,COLES BLACKTOWN,1052.40',
      '30/06/2026,3200.00,SALARY ACME,1070.40',
    ].join('\n');
    const out = parseCSV(csv);
    expect(out.transactions).toHaveLength(3); // first row NOT eaten as a header
    const first = out.transactions[0];
    expect(first.description).toContain('WOOLWORTHS');
    expect(Math.abs(first.amount!)).toBeCloseTo(52.4, 2);
    expect(first.direction).toBe('OUT');
    expect(out.transactions[2].direction).toBe('IN'); // salary
  });

  it('does NOT pick the running-balance column as the amount', () => {
    // amount is small + signed; balance is large + monotonic — must pick amount.
    const csv = ['05/07/2026,-9.50,CAFE,4990.50', '04/07/2026,-10.00,BUS,5000.00'].join('\n');
    const out = parseCSV(csv);
    expect(Math.abs(out.transactions[0].amount!)).toBeCloseTo(9.5, 2); // not 4990.50
  });

  it('a headed known-bank CSV is unaffected by header auto-detection', () => {
    const csv = ['Date,Transaction Details,Debits,Credits', '18 Jun 26,EFTPOS COLES,45.10,'].join('\n');
    const out = parseCSV(csv);
    expect(out.transactions).toHaveLength(1);
    expect(out.transactions[0].direction).toBe('OUT');
  });
});

describe('parseCSV — blank-column immunity + odd bank formats (2026-07-02)', () => {
  it('AMEX/Qantas-style CSV with a BLANK column + full-month dates parses correctly', () => {
    // Date, Amount(signed), Account, <blank>, Type, Details, Category, Merchant, Processed.
    // The blank column previously matched EVERY pattern (p.includes('') === true),
    // so a bank "matched" 100% and every lookup collapsed onto the blank column
    // → "Missing or invalid amount".
    const csv = [
      'Date,Amount,Account Number,,Transaction Type,Transaction Details,Category,Merchant Name,Processed On',
      '27 June 26,500.00,Card ending 6000,,CREDIT CARD PAYMENT,BPAY PAYMENT - THANK YOU,Internal transfers,,29 June 26',
      '20 June 26,-28.62,Card ending 7959,,CREDIT CARD PURCHASE,OPENAI *CHATGPT SUBSCR SAN FRANCISCO,Electronics,OpenAI,21 June 26',
    ].join('\n');
    const out = parseCSV(csv);
    expect(out.transactions).toHaveLength(2);
    // amount comes from the real Amount column, NOT the blank column
    expect(out.transactions[0].amount).toBeCloseTo(500, 2);
    expect(out.transactions[0].direction).toBe('IN');
    expect(out.transactions[0].description).toContain('BPAY PAYMENT');
    expect(Math.abs(out.transactions[1].amount!)).toBeCloseTo(28.62, 2);
    expect(out.transactions[1].direction).toBe('OUT');
    expect(out.transactions[1].description).toContain('OPENAI');
  });

  it('a headed CSV from an UNKNOWN bank infers columns from the data', () => {
    // No known-bank header names; a blank column present too.
    const csv = [
      'When,,Memo,Value,Running Total',
      '2026-07-01,,Coffee shop,-4.50,995.50',
      '2026-06-30,,Payday,2000.00,1000.00',
    ].join('\n');
    const out = parseCSV(csv);
    expect(out.transactions).toHaveLength(2);
    expect(Math.abs(out.transactions[0].amount!)).toBeCloseTo(4.5, 2); // "Value", not "Running Total"
    expect(out.transactions[0].direction).toBe('OUT');
    expect(out.transactions[1].direction).toBe('IN');
  });
});
