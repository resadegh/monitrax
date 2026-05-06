/**
 * Phase 41f.3 — Typed parsers for Xero "Reports" responses.
 *
 * Xero's BalanceSheet + ProfitAndLoss endpoints return a deeply
 * nested `{ Reports: [{ Rows: [...] }] }` structure. Rows are mixed
 * `Header / Section / Row / SummaryRow`; cells are positional.
 *
 * This module reduces that to a flat typed shape suitable for
 * persistence in `EntityAccountingSnapshot`. Parsing is **tolerant**
 * — any field we can't find returns `undefined` (snapshots use
 * nullable columns for the optional line items per the 41f.1 schema).
 *
 * Reference shapes:
 * - https://developer.xero.com/documentation/api/accounting/reports#balance-sheet
 * - https://developer.xero.com/documentation/api/accounting/reports#profit-and-loss
 */

import 'server-only';

// =============================================================================
// Public typed shapes
// =============================================================================

export interface XeroBalanceSheet {
  reportDate: string; // YYYY-MM-DD as returned by Xero

  // Required totals (every BS has these — if missing, parse fails)
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;

  // Optional line items — depends on the org's chart of accounts
  cashAndEquivalents?: number;
  tradeReceivables?: number;
  inventoryValue?: number;
  fixedAssetsNet?: number;
  tradePayables?: number;
  shortTermDebt?: number;
  longTermDebt?: number;
  retainedEarnings?: number;
}

export interface XeroProfitAndLoss {
  fromDate: string; // YYYY-MM-DD
  toDate: string;

  // Required
  revenue: number;
  operatingExpenses: number;
  netProfitBeforeTax: number;
  netProfitAfterTax: number;

  // Optional
  costOfGoodsSold?: number;
  taxExpense?: number;
  depreciation?: number;
  interest?: number;
}

export class XeroReportParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XeroReportParseError';
  }
}

// =============================================================================
// Raw shape from Xero — minimal typing (we walk it dynamically)
// =============================================================================

interface RawCell {
  Value?: string | number;
  Attributes?: Array<{ Value?: string; Id?: string }>;
}
interface RawRow {
  RowType?: 'Header' | 'Section' | 'Row' | 'SummaryRow';
  Title?: string;
  Cells?: RawCell[];
  Rows?: RawRow[];
}
interface RawReport {
  ReportName?: string;
  ReportDate?: string;
  ReportTitles?: string[];
  Rows?: RawRow[];
}
interface RawReportEnvelope {
  Reports?: RawReport[];
}

// =============================================================================
// Balance Sheet parser
// =============================================================================

export function parseBalanceSheet(raw: unknown): XeroBalanceSheet {
  const report = extractReport(raw, 'BalanceSheet');

  // Xero BS top-level sections: "Assets", "Liabilities", "Equity"
  const assetSection = findSectionByTitle(report.Rows ?? [], /assets/i);
  const liabilitySection = findSectionByTitle(report.Rows ?? [], /liabilities/i);
  const equitySection = findSectionByTitle(report.Rows ?? [], /equity/i);

  if (!assetSection || !liabilitySection || !equitySection) {
    throw new XeroReportParseError(
      'Balance Sheet missing one of Assets / Liabilities / Equity sections.',
    );
  }

  const totalAssets = pickSummaryAmount(assetSection);
  const totalLiabilities = pickSummaryAmount(liabilitySection);
  const totalEquity = pickSummaryAmount(equitySection);

  if (
    !Number.isFinite(totalAssets) ||
    !Number.isFinite(totalLiabilities) ||
    !Number.isFinite(totalEquity)
  ) {
    throw new XeroReportParseError(
      'Balance Sheet missing top-level totals (Assets / Liabilities / Equity).',
    );
  }

  return {
    reportDate: report.ReportDate ?? new Date().toISOString().slice(0, 10),
    totalAssets,
    totalLiabilities,
    totalEquity,
    cashAndEquivalents: findRowAmount(assetSection, /^(?:bank|cash)/i),
    tradeReceivables: findRowAmount(assetSection, /receivable|debtors/i),
    inventoryValue: findRowAmount(assetSection, /inventory|stock/i),
    fixedAssetsNet: findRowAmount(assetSection, /fixed assets|property, plant/i),
    tradePayables: findRowAmount(liabilitySection, /payable|creditors/i),
    shortTermDebt: findRowAmount(liabilitySection, /current.*loan|short.term/i),
    longTermDebt: findRowAmount(liabilitySection, /non.current.*loan|long.term/i),
    retainedEarnings: findRowAmount(equitySection, /retained earnings|current year earnings/i),
  };
}

// =============================================================================
// P&L parser
// =============================================================================

export function parseProfitAndLoss(raw: unknown): XeroProfitAndLoss {
  const report = extractReport(raw, 'ProfitAndLoss');

  // Period covered comes from ReportTitles like ["For the period 1 Jul 2024 to 30 Jun 2025"]
  const period = parsePeriodFromTitles(report.ReportTitles ?? []);

  // Top-level sections vary slightly by accounting style:
  // - Income / Less Cost of Sales / Gross Profit / Less Operating Expenses /
  //   Net Profit (or Net Loss) / Less Taxation / Net Profit After Tax
  const incomeSection = findSectionByTitle(report.Rows ?? [], /^income|^revenue/i);
  const cogsSection = findSectionByTitle(report.Rows ?? [], /cost of (sales|goods)/i);
  const expenseSection = findSectionByTitle(report.Rows ?? [], /operating expenses|less expenses|^expenses/i);
  const taxSection = findSectionByTitle(report.Rows ?? [], /less taxation|taxation expense/i);

  // Net Profit lines are surface-level summary rows on the report (not
  // inside a section). Walk the top-level rows.
  const netProfitBeforeTax = findTopLevelSummaryAmount(
    report.Rows ?? [],
    /net profit($|.*before tax|.*after operating)/i,
  );
  const netProfitAfterTax = findTopLevelSummaryAmount(
    report.Rows ?? [],
    /net profit after tax|net.profit.\(after taxation\)/i,
  );

  if (!incomeSection) {
    throw new XeroReportParseError('P&L missing Income / Revenue section.');
  }

  const revenue = pickSummaryAmount(incomeSection);
  const operatingExpenses = expenseSection ? pickSummaryAmount(expenseSection) : 0;
  // If after-tax line is absent (common in simple orgs where there is
  // no tax section), fall back to before-tax.
  const finalNetProfitAfterTax = Number.isFinite(netProfitAfterTax)
    ? netProfitAfterTax
    : netProfitBeforeTax;

  if (!Number.isFinite(revenue) || !Number.isFinite(netProfitBeforeTax)) {
    throw new XeroReportParseError(
      'P&L missing required totals (Revenue / Net Profit Before Tax).',
    );
  }

  return {
    fromDate: period.fromDate,
    toDate: period.toDate,
    revenue,
    operatingExpenses,
    netProfitBeforeTax,
    netProfitAfterTax: finalNetProfitAfterTax,
    costOfGoodsSold: cogsSection ? pickSummaryAmount(cogsSection) : undefined,
    taxExpense: taxSection ? pickSummaryAmount(taxSection) : undefined,
    depreciation: expenseSection
      ? findRowAmount(expenseSection, /depreciation|amortisation/i)
      : undefined,
    interest: expenseSection
      ? findRowAmount(expenseSection, /interest expense|finance cost/i)
      : undefined,
  };
}

// =============================================================================
// Internal walkers
// =============================================================================

function extractReport(raw: unknown, expectedKind: 'BalanceSheet' | 'ProfitAndLoss'): RawReport {
  const env = raw as RawReportEnvelope | undefined;
  const report = env?.Reports?.[0];
  if (!report) {
    throw new XeroReportParseError(`Xero ${expectedKind} response missing Reports[0].`);
  }
  return report;
}

function findSectionByTitle(rows: RawRow[], match: RegExp): RawRow | undefined {
  return rows.find(
    (r) => r.RowType === 'Section' && typeof r.Title === 'string' && match.test(r.Title),
  );
}

function findTopLevelSummaryAmount(rows: RawRow[], match: RegExp): number {
  for (const row of rows) {
    if (row.RowType === 'Section' && row.Title && match.test(row.Title)) {
      const inner = pickSummaryAmount(row);
      if (Number.isFinite(inner)) return inner;
    }
    if (row.RowType === 'Row' || row.RowType === 'SummaryRow') {
      const label = cellLabel(row);
      if (label && match.test(label)) {
        const amount = cellAmount(row);
        if (Number.isFinite(amount)) return amount;
      }
    }
  }
  return Number.NaN;
}

function pickSummaryAmount(section: RawRow): number {
  // The summary row is typically the last child with RowType=SummaryRow,
  // or sometimes a Row whose first cell label contains "Total".
  const summary = (section.Rows ?? []).find((r) => r.RowType === 'SummaryRow');
  if (summary) return cellAmount(summary);

  const totalRow = (section.Rows ?? []).find((r) => {
    const label = cellLabel(r);
    return label && /^total\b/i.test(label);
  });
  if (totalRow) return cellAmount(totalRow);

  // Some sections embed nested sub-sections; fall back to summing the
  // direct Row-type rows.
  const sumOfRows = (section.Rows ?? [])
    .filter((r) => r.RowType === 'Row')
    .map((r) => cellAmount(r))
    .filter((n) => Number.isFinite(n))
    .reduce((acc, n) => acc + n, 0);
  return sumOfRows;
}

function findRowAmount(section: RawRow, match: RegExp): number | undefined {
  for (const row of section.Rows ?? []) {
    if (row.RowType === 'Section') {
      const inner = findRowAmount(row, match);
      if (inner !== undefined) return inner;
    }
    if (row.RowType === 'Row') {
      const label = cellLabel(row);
      if (label && match.test(label)) {
        const amount = cellAmount(row);
        if (Number.isFinite(amount)) return amount;
      }
    }
  }
  return undefined;
}

function cellLabel(row: RawRow): string | undefined {
  const cell = row.Cells?.[0];
  if (!cell || cell.Value === undefined || cell.Value === null) return undefined;
  return String(cell.Value);
}

function cellAmount(row: RawRow): number {
  // Xero typically puts the running total in the LAST cell; the
  // intermediate cells are per-period when comparing periods. v1
  // requests single-period reports so the second cell holds the value.
  const cells = row.Cells ?? [];
  for (let i = cells.length - 1; i >= 1; i--) {
    const v = cells[i]?.Value;
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim().length > 0) {
      const parsed = Number(v.replace(/,/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return Number.NaN;
}

function parsePeriodFromTitles(titles: string[]): { fromDate: string; toDate: string } {
  // Look for dates like "1 Jul 2024 to 30 Jun 2025" or "Jul 2024 to Jun 2025"
  for (const t of titles) {
    const m = t.match(
      /(\d{1,2}\s+\w+\s+\d{4})\s+to\s+(\d{1,2}\s+\w+\s+\d{4})/i,
    );
    if (m) {
      const from = parseAuDate(m[1]);
      const to = parseAuDate(m[2]);
      if (from && to) return { fromDate: from, toDate: to };
    }
    // Fallback: month-only ("July 2024 to June 2025") — set to first/last
    // of month
    const m2 = t.match(/(\w+\s+\d{4})\s+to\s+(\w+\s+\d{4})/i);
    if (m2) {
      const from = parseMonthYear(m2[1], 'first');
      const to = parseMonthYear(m2[2], 'last');
      if (from && to) return { fromDate: from, toDate: to };
    }
  }
  // Last resort — Xero's response usually has dates somewhere; if
  // truly absent, default to the calling convention (today as toDate,
  // 12 months prior as fromDate).
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
}

function parseAuDate(raw: string): string | null {
  // "1 Jul 2024" / "30 Jun 2025"
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseMonthYear(raw: string, position: 'first' | 'last'): string | null {
  const d = new Date(`1 ${raw}`);
  if (Number.isNaN(d.getTime())) return null;
  if (position === 'last') {
    // Move to first of next month, then back one day
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
  }
  return d.toISOString().slice(0, 10);
}
