/**
 * Phase 50 D.5b — Document retention clock (the DIE's "is this still worth
 * keeping for the ATO, or safe to archive?" judgement). PURE + ADVISORY.
 *
 * The ATO requires records that substantiate a tax return be kept for **5 years
 * from the date the relevant return was lodged**. Returns are lodged after the
 * end of the financial year (30 June), so the conservative, defensible clock is:
 *
 *     retainUntil = 30 June (5 + 1) years after the FY the document falls in
 *
 * i.e. 5 full years after the END of the document's financial year. This errs
 * toward RETAIN (it assumes the latest plausible lodgement), which is exactly
 * the financial-adviser-lens behaviour we want — never nudge a user to bin a
 * record the ATO might still ask for.
 *
 * AUTONOMY + safety (Reza decision 2026-06-18, CLAUDE.md §0 financial-adviser
 * lens): this module is **advice only**. It NEVER deletes, NEVER mutates, NEVER
 * touches Prisma (pure, §6.4). `ARCHIVE_SAFE` is a suggestion the user acts on —
 * the app never auto-archives. We are deliberately conservative about which
 * categories even get a clock: only classic tax-substantiation documents
 * (receipts, invoices, tax docs, statements). Contracts, leases, insurance,
 * PDSs, valuations and "other" have ongoing legal/reference value, so we give NO
 * archive advice for them (`NO_CLOCK`) rather than risk telling someone to bin a
 * still-relevant policy or contract.
 */

/** Mirror of the Prisma `DocumentCategory` values (kept local so this stays
 *  Prisma-free and pure). */
export type DocumentCategoryLike =
  | 'CONTRACT'
  | 'STATEMENT'
  | 'RECEIPT'
  | 'TAX'
  | 'PDS'
  | 'VALUATION'
  | 'INSURANCE'
  | 'MORTGAGE'
  | 'LEASE'
  | 'INVOICE'
  | 'OTHER';

/** ATO substantiation window, in years, from the end of the relevant FY. */
export const ATO_RETENTION_YEARS = 5;

/**
 * Categories whose primary purpose is tax substantiation → a retention clock
 * applies. Everything else gets `NO_CLOCK` (ongoing relevance, no clean basis to
 * advise archiving).
 */
const TAX_SUBSTANTIATION_CATEGORIES: ReadonlySet<DocumentCategoryLike> = new Set([
  'RECEIPT',
  'INVOICE',
  'TAX',
  'STATEMENT',
]);

export type RetentionStatus =
  /** Within the ATO window — keep it. */
  | 'RETAIN'
  /** Past the window for a tax-substantiation doc — safe to archive (advice). */
  | 'ARCHIVE_SAFE'
  /** Category has no defined retention basis — no archive advice given. */
  | 'NO_CLOCK';

export interface RetentionVerdict {
  status: RetentionStatus;
  /** ISO date the ATO window closes (only when a clock applies). */
  retainUntil?: string;
  /** Short, warm, non-shaming label for a pill/tooltip. */
  label: string;
  /** One-line rationale (e.g. "ATO 5-year window closed 30 Jun 2024"). */
  reason: string;
}

/**
 * Australian financial year END (30 June) for the FY a date falls in. A date in
 * Jan–Jun belongs to the FY ending 30 Jun of that calendar year; Jul–Dec
 * belongs to the FY ending 30 Jun of the NEXT year.
 */
function financialYearEnd(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0 = Jan
  // Months Jul(6)–Dec(11) → FY ends next calendar year's 30 Jun.
  const fyEndYear = m >= 6 ? y + 1 : y;
  return new Date(Date.UTC(fyEndYear, 5, 30)); // 5 = June, day 30
}

function formatAuDate(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Classify a document's retention status from its (best-known) date + category.
 *
 * @param documentDate the most relevant date for the document (extracted issue/
 *   transaction date when available, else the upload date). Invalid/absent dates
 *   yield `NO_CLOCK` — we don't guess.
 * @param category the document's category.
 * @param now injectable clock for testability (defaults to `new Date()`).
 */
export function computeRetentionStatus(
  documentDate: Date | string | null | undefined,
  category: DocumentCategoryLike | string | null | undefined,
  now: Date = new Date(),
): RetentionVerdict {
  const cat = (category ?? '') as DocumentCategoryLike;
  if (!TAX_SUBSTANTIATION_CATEGORIES.has(cat)) {
    return {
      status: 'NO_CLOCK',
      label: 'Keep on file',
      reason: 'No ATO retention clock for this document type.',
    };
  }

  const date = documentDate instanceof Date ? documentDate : documentDate ? new Date(documentDate) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return {
      status: 'NO_CLOCK',
      label: 'Keep on file',
      reason: 'No document date to start the retention clock.',
    };
  }

  // retainUntil = ATO_RETENTION_YEARS after the END of the document's FY.
  const fyEnd = financialYearEnd(date);
  const retainUntil = new Date(
    Date.UTC(fyEnd.getUTCFullYear() + ATO_RETENTION_YEARS, fyEnd.getUTCMonth(), fyEnd.getUTCDate()),
  );

  const past = now.getTime() > retainUntil.getTime();
  return past
    ? {
        status: 'ARCHIVE_SAFE',
        retainUntil: retainUntil.toISOString(),
        label: 'Safe to archive',
        reason: `ATO ${ATO_RETENTION_YEARS}-year window closed ${formatAuDate(retainUntil)}.`,
      }
    : {
        status: 'RETAIN',
        retainUntil: retainUntil.toISOString(),
        label: 'Keep for tax',
        reason: `Keep until ${formatAuDate(retainUntil)} (ATO ${ATO_RETENTION_YEARS}-year rule).`,
      };
}

/**
 * Pull the most relevant date for retention out of a document's extracted data,
 * unwrapping the {value, confidence} ExtractedField shape when present. Returns
 * null when nothing usable is found (caller falls back to the upload date).
 */
export function extractDocumentDate(extractedData: unknown): Date | null {
  if (!extractedData || typeof extractedData !== 'object') return null;
  const obj = extractedData as Record<string, unknown>;
  for (const key of ['date', 'issueDate', 'transactionDate', 'invoiceDate', 'statementDate']) {
    const raw = obj[key];
    if (raw == null) continue;
    const value =
      typeof raw === 'object' && raw !== null && 'value' in raw
        ? (raw as { value: unknown }).value
        : raw;
    if (typeof value === 'string' || value instanceof Date) {
      const d = new Date(value as string | Date);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}
