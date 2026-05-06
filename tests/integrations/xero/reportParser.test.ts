/**
 * Phase 41f.3 — Xero report parser tests.
 *
 * Uses synthetic fixtures matching the shape Xero's BalanceSheet +
 * ProfitAndLoss endpoints return. Verifies tolerant parsing — required
 * fields throw, optional fields return undefined when absent.
 */

import { describe, it, expect } from 'vitest';
import {
  parseBalanceSheet,
  parseProfitAndLoss,
  XeroReportParseError,
} from '@/lib/integrations/xero';

// Helper — build a minimal Xero report envelope
const env = (report: object) => ({ Reports: [report] });

describe('Phase 41f.3 — parseBalanceSheet', () => {
  it('extracts Total Assets / Liabilities / Equity from a typical Xero BS', () => {
    const raw = env({
      ReportName: 'Balance Sheet',
      ReportDate: '30 June 2025',
      Rows: [
        { RowType: 'Header', Cells: [{ Value: '' }, { Value: 'June 2025' }] },
        {
          RowType: 'Section',
          Title: 'Assets',
          Rows: [
            {
              RowType: 'Section',
              Title: 'Bank',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Bank Account' }, { Value: '50000' }] },
                { RowType: 'SummaryRow', Cells: [{ Value: 'Total Bank' }, { Value: '50000' }] },
              ],
            },
            {
              RowType: 'Section',
              Title: 'Current Assets',
              Rows: [
                { RowType: 'Row', Cells: [{ Value: 'Trade Receivables' }, { Value: '20000' }] },
                { RowType: 'SummaryRow', Cells: [{ Value: 'Total Current Assets' }, { Value: '70000' }] },
              ],
            },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Assets' }, { Value: '500000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Liabilities',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'Trade Payables' }, { Value: '30000' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Liabilities' }, { Value: '200000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Equity',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'Retained Earnings' }, { Value: '250000' }] },
            { RowType: 'Row', Cells: [{ Value: 'Owner Capital' }, { Value: '50000' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Equity' }, { Value: '300000' }] },
          ],
        },
      ],
    });

    const bs = parseBalanceSheet(raw);
    expect(bs.totalAssets).toBe(500_000);
    expect(bs.totalLiabilities).toBe(200_000);
    expect(bs.totalEquity).toBe(300_000);
    expect(bs.retainedEarnings).toBe(250_000);
    expect(bs.tradeReceivables).toBe(20_000);
    expect(bs.tradePayables).toBe(30_000);
    expect(bs.cashAndEquivalents).toBe(50_000);
  });

  it('parses numeric strings with commas', () => {
    const raw = env({
      Rows: [
        {
          RowType: 'Section',
          Title: 'Assets',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Assets' }, { Value: '1,500,000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Liabilities',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Liabilities' }, { Value: '500,000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Equity',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Equity' }, { Value: '1,000,000' }] },
          ],
        },
      ],
    });
    const bs = parseBalanceSheet(raw);
    expect(bs.totalAssets).toBe(1_500_000);
    expect(bs.totalLiabilities).toBe(500_000);
    expect(bs.totalEquity).toBe(1_000_000);
  });

  it('returns undefined for optional line items not present', () => {
    const raw = env({
      Rows: [
        {
          RowType: 'Section',
          Title: 'Assets',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Assets' }, { Value: '100' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Liabilities',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Liabilities' }, { Value: '40' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Equity',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Equity' }, { Value: '60' }] },
          ],
        },
      ],
    });
    const bs = parseBalanceSheet(raw);
    expect(bs.cashAndEquivalents).toBeUndefined();
    expect(bs.retainedEarnings).toBeUndefined();
    expect(bs.tradePayables).toBeUndefined();
  });

  it('throws when one of the top-level sections is missing', () => {
    const raw = env({
      Rows: [
        {
          RowType: 'Section',
          Title: 'Assets',
          Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Assets' }, { Value: '100' }] }],
        },
        // Liabilities missing
        {
          RowType: 'Section',
          Title: 'Equity',
          Rows: [{ RowType: 'SummaryRow', Cells: [{ Value: 'Total Equity' }, { Value: '60' }] }],
        },
      ],
    });
    expect(() => parseBalanceSheet(raw)).toThrow(XeroReportParseError);
  });

  it('throws when the response envelope has no Reports', () => {
    expect(() => parseBalanceSheet({})).toThrow(XeroReportParseError);
    expect(() => parseBalanceSheet({ Reports: [] })).toThrow(XeroReportParseError);
  });
});

describe('Phase 41f.3 — parseProfitAndLoss', () => {
  it('extracts Revenue / Operating Expenses / Net Profit from a typical Xero P&L', () => {
    const raw = env({
      ReportName: 'Profit and Loss',
      ReportTitles: [
        'Profit and Loss',
        'Acme Pty Ltd',
        'For the period 1 Jul 2024 to 30 Jun 2025',
      ],
      Rows: [
        { RowType: 'Header', Cells: [{ Value: '' }, { Value: 'FY24-25' }] },
        {
          RowType: 'Section',
          Title: 'Income',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'Sales' }, { Value: '1000000' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Income' }, { Value: '1000000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Less Cost of Sales',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'COGS' }, { Value: '300000' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Cost of Sales' }, { Value: '300000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Operating Expenses',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'Salaries' }, { Value: '400000' }] },
            { RowType: 'Row', Cells: [{ Value: 'Depreciation' }, { Value: '50000' }] },
            { RowType: 'Row', Cells: [{ Value: 'Interest Expense' }, { Value: '10000' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Operating Expenses' }, { Value: '500000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Net Profit before Tax',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Net Profit before Tax' }, { Value: '200000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Less Taxation',
          Rows: [
            { RowType: 'Row', Cells: [{ Value: 'Income Tax' }, { Value: '60000' }] },
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Taxation' }, { Value: '60000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Net Profit After Tax',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Net Profit After Tax' }, { Value: '140000' }] },
          ],
        },
      ],
    });

    const pl = parseProfitAndLoss(raw);
    expect(pl.revenue).toBe(1_000_000);
    expect(pl.costOfGoodsSold).toBe(300_000);
    expect(pl.operatingExpenses).toBe(500_000);
    expect(pl.netProfitBeforeTax).toBe(200_000);
    expect(pl.taxExpense).toBe(60_000);
    expect(pl.netProfitAfterTax).toBe(140_000);
    expect(pl.depreciation).toBe(50_000);
    expect(pl.interest).toBe(10_000);
    expect(pl.fromDate).toBe('2024-07-01');
    expect(pl.toDate).toBe('2025-06-30');
  });

  it('falls back to before-tax when after-tax is absent (simple org without tax section)', () => {
    const raw = env({
      ReportTitles: ['For the period 1 Jul 2024 to 30 Jun 2025'],
      Rows: [
        {
          RowType: 'Section',
          Title: 'Income',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Income' }, { Value: '500000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Operating Expenses',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Operating Expenses' }, { Value: '350000' }] },
          ],
        },
        {
          RowType: 'Section',
          Title: 'Net Profit',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Net Profit' }, { Value: '150000' }] },
          ],
        },
      ],
    });
    const pl = parseProfitAndLoss(raw);
    expect(pl.netProfitBeforeTax).toBe(150_000);
    expect(pl.netProfitAfterTax).toBe(150_000); // fallback
    expect(pl.taxExpense).toBeUndefined();
  });

  it('throws when revenue or net-profit is missing', () => {
    const raw = env({
      Rows: [
        {
          RowType: 'Section',
          Title: 'Operating Expenses',
          Rows: [
            { RowType: 'SummaryRow', Cells: [{ Value: 'Total Operating Expenses' }, { Value: '100' }] },
          ],
        },
      ],
    });
    expect(() => parseProfitAndLoss(raw)).toThrow(XeroReportParseError);
  });
});
