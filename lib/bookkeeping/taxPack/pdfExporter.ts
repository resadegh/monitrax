/**
 * Phase 42 PR5.5 — Tax Pack PDF exporter.
 *
 * Renders the canonical `TaxPackSummary` as a printable PDF designed
 * for the consumer-to-accountant handoff. One artefact the user can
 * email, attach to a portal, or print and hand over physically.
 *
 * Sections (in reading order):
 *   1. Cover — title, FY label, generated date, user disclaimer
 *   2. Totals — income / expenses / net cashflow / transaction count
 *   3. ATO labels — schedule + line item + amount + tx count
 *   4. Per-property P&L — one block per property, with expense
 *      categories sorted by total descending
 *   5. Data-source disclosure — per-source counts + month coverage
 *      (so the accountant can assess provenance at a glance)
 *   6. Disclaimer (footer of every page)
 *
 * Per CLAUDE.md §12.3 — composes the already-canonical
 * `buildTaxPackSummary()` output; no new aggregation logic in this
 * file. Per §12.7 — `pdfkit` reviewed + accepted as the single
 * server-side PDF dep (see `docs/policy/APPROVED_DEPENDENCIES.md`).
 *
 * Returns a Node Buffer suitable for
 *   `Content-Type: application/pdf` download.
 */

import PDFDocument from 'pdfkit';
import type { TaxPackSummary, AtoLabelTotals, PerPropertyPL } from './summary';

// ---- design tokens (single source of truth for the PDF look) ----

const FONT_BODY = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const COLOR_INK = '#0f172a'; // slate-900
const COLOR_MUTED = '#475569'; // slate-600
const COLOR_RULE = '#cbd5e1'; // slate-300
const COLOR_ACCENT = '#047857'; // emerald-700

const PAGE_MARGIN = 50;
const TITLE_SIZE = 22;
const H1_SIZE = 14;
const H2_SIZE = 11;
const BODY_SIZE = 10;
const FOOT_SIZE = 8;

/**
 * Build the Tax Pack PDF. Returns a Node Buffer.
 *
 * The PDF is generated synchronously via `pdfkit` — we collect the
 * stream chunks and concatenate at the end. This is the canonical
 * `pdfkit` server-side pattern; matches how
 * `app/api/share/[token]/download/route.ts` builds its ZIP.
 */
export async function buildTaxPackPdf(summary: TaxPackSummary): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: PAGE_MARGIN,
      info: {
        Title: `Monitrax Tax Pack — ${summary.window.label}`,
        Author: 'Monitrax',
        Subject: `Tax Pack handoff for ${summary.window.label}`,
        Creator: 'Monitrax PDF Exporter (Phase 42 PR5.5)',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ---- 1. Cover ----
    renderCover(doc, summary);

    // ---- 2. Totals ----
    renderTotals(doc, summary);

    // ---- 3. ATO labels ----
    renderAtoLabels(doc, summary.atoLabels);

    // ---- 4. Per-property P&L ----
    renderPerProperty(doc, summary.perProperty);

    // ---- 5. Data sources ----
    renderDataSources(doc, summary);

    // ---- 6. Footer disclaimer on every page ----
    renderFooterOnAllPages(doc, summary.disclaimer);

    doc.end();
  });
}

/**
 * Suggested filename for the PDF download. Includes the FY label so
 * the file is self-describing once saved.
 */
export function suggestedPdfFilename(fyLabel: string): string {
  return `monitrax-tax-pack-${fyLabel.toLowerCase()}.pdf`;
}

// ----------------------------------------------------------------------
// Section renderers
// ----------------------------------------------------------------------

function renderCover(doc: PDFKit.PDFDocument, summary: TaxPackSummary): void {
  doc
    .font(FONT_BOLD)
    .fillColor(COLOR_INK)
    .fontSize(TITLE_SIZE)
    .text('Tax Pack', { align: 'left' });
  doc.moveDown(0.2);
  doc
    .font(FONT_BODY)
    .fillColor(COLOR_MUTED)
    .fontSize(H1_SIZE)
    .text(`Australian Financial Year ${summary.window.label}`);
  doc.moveDown(0.3);
  doc
    .fontSize(BODY_SIZE)
    .text(`Generated ${formatDate(summary.generatedAt)}`);
  doc.moveDown(1.0);
  drawRule(doc);
  doc.moveDown(0.5);
}

function renderTotals(doc: PDFKit.PDFDocument, summary: TaxPackSummary): void {
  sectionHeading(doc, 'Totals (property-scoped)');
  const rows: Array<[string, string]> = [
    ['Income (gross)', formatCurrency(summary.totals.incomeGross)],
    ['Expenses', formatCurrency(summary.totals.expenseTotal)],
    ['Net cashflow', formatCurrency(summary.totals.netCashflow)],
    ['Transactions included', summary.totals.transactionCount.toLocaleString('en-AU')],
  ];
  renderTwoColumnTable(doc, rows);
  doc.moveDown(1);

  // MON-170: the nothing-silent reconciliation — every excluded row is
  // counted with its dollars, and the identity line is printed so the
  // accountant can see the pack accounts for the whole window.
  const r = summary.reconciliation;
  sectionHeading(doc, 'Reconciliation');
  const excludedCount =
    r.excluded.transfers.count + r.excluded.loanRepayments.count + r.excluded.notPropertyScoped.count;
  renderTwoColumnTable(doc, [
    ['All transactions in window', r.transactionsTotal.toLocaleString('en-AU')],
    ['Included (property-scoped)', `${r.included.count} rows · ${formatCurrency(r.included.amount)}`],
    ['Excluded — transfers', `${r.excluded.transfers.count} rows · ${formatCurrency(r.excluded.transfers.amount)}`],
    ['Excluded — loan repayments', `${r.excluded.loanRepayments.count} rows · ${formatCurrency(r.excluded.loanRepayments.amount)}`],
    ['Excluded — not property-scoped', `${r.excluded.notPropertyScoped.count} rows · ${formatCurrency(r.excluded.notPropertyScoped.amount)}`],
    ['Identity check', `${r.included.count} included + ${excludedCount} excluded = ${r.transactionsTotal} total`],
    ['ATO labelling', `${r.atoLabelling.labelled.count} labelled · ${r.atoLabelling.noCategory.count} no category (review on the Housekeeping page) · ${r.atoLabelling.noAtoMapping.count} unmapped`],
  ]);
  doc.moveDown(1);
}

function renderAtoLabels(doc: PDFKit.PDFDocument, atoLabels: AtoLabelTotals[]): void {
  sectionHeading(doc, 'ATO labels');
  if (atoLabels.length === 0) {
    bodyText(doc, 'No ATO-tagged transactions in this period.');
    doc.moveDown(0.8);
    return;
  }
  const headers: string[] = ['Label', 'Schedule', 'Line item', 'Amount', 'Tx'];
  const widths: number[] = [120, 90, 120, 90, 40];
  renderTableHeader(doc, headers, widths);
  for (const row of atoLabels) {
    renderTableRow(
      doc,
      [
        row.atoLabel,
        row.schedule ?? '',
        row.lineItem ?? '',
        formatCurrency(row.totalAmount),
        row.transactionCount.toString(),
      ],
      widths
    );
  }
  doc.moveDown(0.8);
}

function renderPerProperty(doc: PDFKit.PDFDocument, perProperty: PerPropertyPL[]): void {
  sectionHeading(doc, 'Per-property P&L');
  if (perProperty.length === 0) {
    bodyText(doc, 'No property-linked transactions in this period.');
    doc.moveDown(0.8);
    return;
  }
  for (const property of perProperty) {
    pageBreakIfNeeded(doc, 180);
    doc.font(FONT_BOLD).fillColor(COLOR_INK).fontSize(H2_SIZE).text(property.propertyName);
    doc.moveDown(0.2);
    const summaryRows: Array<[string, string]> = [
      ['Income', `${formatCurrency(property.income.total)} (${property.income.count} tx)`],
      ['Expenses', `${formatCurrency(property.expenses.total)} (${property.expenses.count} tx)`],
      ['Net', formatCurrency(property.net)],
    ];
    renderTwoColumnTable(doc, summaryRows);

    if (property.expenses.byCategory.length > 0) {
      doc.moveDown(0.4);
      doc
        .font(FONT_BOLD)
        .fillColor(COLOR_MUTED)
        .fontSize(BODY_SIZE)
        .text('Expense breakdown');
      const categoryWidths = [220, 90, 50];
      renderTableHeader(doc, ['Category', 'Total', 'Count'], categoryWidths);
      const sortedCats = property.expenses.byCategory
        .slice()
        .sort((a, b) => b.total - a.total);
      for (const cat of sortedCats) {
        renderTableRow(
          doc,
          [cat.category, formatCurrency(cat.total), cat.count.toString()],
          categoryWidths
        );
      }
    }
    doc.moveDown(0.8);
  }
}

function renderDataSources(doc: PDFKit.PDFDocument, summary: TaxPackSummary): void {
  pageBreakIfNeeded(doc, 200);
  sectionHeading(doc, 'Data sources');
  bodyText(
    doc,
    'Provenance of every transaction in this window. Mixed-source months are normal — the accountant can spot-check by source if needed.'
  );
  doc.moveDown(0.3);

  const sourceEntries = Object.entries(summary.dataSources.sources);
  if (sourceEntries.length > 0) {
    const rows: Array<[string, string]> = sourceEntries
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => [source, count.toLocaleString('en-AU')]);
    renderTwoColumnTable(doc, rows);
  } else {
    bodyText(doc, '(no transactions)');
  }
  doc.moveDown(0.4);

  const monthLines: Array<[string, string]> = [
    ['BASIQ months', summary.dataSources.basiqMonths.join(', ') || '(none)'],
    ['Imported months', summary.dataSources.importedMonths.join(', ') || '(none)'],
    ['Manual-only months', summary.dataSources.manualOnlyMonths.join(', ') || '(none)'],
  ];
  for (const [label, value] of monthLines) {
    doc
      .font(FONT_BOLD)
      .fillColor(COLOR_INK)
      .fontSize(BODY_SIZE)
      .text(`${label}: `, { continued: true });
    doc.font(FONT_BODY).fillColor(COLOR_MUTED).text(value);
  }
  doc.moveDown(0.8);
}

function renderFooterOnAllPages(
  doc: PDFKit.PDFDocument,
  disclaimer: string
): void {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    const bottomY = doc.page.height - PAGE_MARGIN + 5;
    doc.save();
    doc
      .strokeColor(COLOR_RULE)
      .lineWidth(0.5)
      .moveTo(PAGE_MARGIN, bottomY - 12)
      .lineTo(doc.page.width - PAGE_MARGIN, bottomY - 12)
      .stroke();
    doc
      .font(FONT_BODY)
      .fillColor(COLOR_MUTED)
      .fontSize(FOOT_SIZE)
      .text(disclaimer, PAGE_MARGIN, bottomY - 8, {
        width: doc.page.width - PAGE_MARGIN * 2,
        align: 'center',
        lineGap: -1,
      });
    doc.restore();
  }
}

// ----------------------------------------------------------------------
// Layout primitives
// ----------------------------------------------------------------------

function sectionHeading(doc: PDFKit.PDFDocument, label: string): void {
  pageBreakIfNeeded(doc, 80);
  doc.font(FONT_BOLD).fillColor(COLOR_ACCENT).fontSize(H1_SIZE).text(label);
  doc.moveDown(0.3);
}

function bodyText(doc: PDFKit.PDFDocument, text: string): void {
  doc.font(FONT_BODY).fillColor(COLOR_MUTED).fontSize(BODY_SIZE).text(text);
}

function drawRule(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc
    .save()
    .strokeColor(COLOR_RULE)
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke()
    .restore();
}

function renderTwoColumnTable(
  doc: PDFKit.PDFDocument,
  rows: Array<[string, string]>
): void {
  doc.font(FONT_BODY).fillColor(COLOR_INK).fontSize(BODY_SIZE);
  const labelWidth = 200;
  const valueWidth = doc.page.width - PAGE_MARGIN * 2 - labelWidth;
  for (const [label, value] of rows) {
    pageBreakIfNeeded(doc, 20);
    const y = doc.y;
    doc.font(FONT_BOLD).fillColor(COLOR_INK).text(label, PAGE_MARGIN, y, { width: labelWidth });
    doc.font(FONT_BODY).fillColor(COLOR_MUTED).text(value, PAGE_MARGIN + labelWidth, y, {
      width: valueWidth,
      align: 'left',
    });
    doc.moveDown(0.2);
  }
}

function renderTableHeader(
  doc: PDFKit.PDFDocument,
  headers: string[],
  widths: number[]
): void {
  pageBreakIfNeeded(doc, 30);
  doc.font(FONT_BOLD).fillColor(COLOR_INK).fontSize(BODY_SIZE);
  const y = doc.y;
  let x = PAGE_MARGIN;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, y, { width: widths[i], align: i >= 3 ? 'right' : 'left' });
    x += widths[i];
  }
  doc.moveDown(0.2);
  drawRule(doc);
  doc.moveDown(0.2);
}

function renderTableRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[]
): void {
  pageBreakIfNeeded(doc, 18);
  doc.font(FONT_BODY).fillColor(COLOR_INK).fontSize(BODY_SIZE);
  const y = doc.y;
  let x = PAGE_MARGIN;
  let rowHeight = 0;
  for (let i = 0; i < cells.length; i++) {
    const align = i >= 3 ? 'right' : 'left';
    doc.text(cells[i], x, y, { width: widths[i], align });
    const cellHeight = doc.heightOfString(cells[i], { width: widths[i] });
    if (cellHeight > rowHeight) rowHeight = cellHeight;
    x += widths[i];
  }
  doc.y = y + rowHeight + 2;
}

function pageBreakIfNeeded(doc: PDFKit.PDFDocument, requiredHeight: number): void {
  const bottomLimit = doc.page.height - PAGE_MARGIN - 20; // leave room for footer
  if (doc.y + requiredHeight > bottomLimit) {
    doc.addPage();
  }
}

// ----------------------------------------------------------------------
// Formatters
// ----------------------------------------------------------------------

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
