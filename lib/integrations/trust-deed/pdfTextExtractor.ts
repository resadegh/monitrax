/**
 * Phase 41f.4 — PDF text extraction using `unpdf`.
 *
 * Why `unpdf` over Vision OCR:
 *   - Most trust deeds are typeset PDFs (not scanned images). Text
 *     extraction is faster + cheaper + more deterministic than image
 *     OCR.
 *   - `unpdf` is serverless-friendly (works in Vercel functions; no
 *     native deps).
 *   - Already installed in package.json (Phase 26 vault dep).
 *
 * Scanned-PDF fallback (out of scope for v1, captured as
 * `UC-TRUST-DEED-SCANNED-PDF`): if `unpdf` returns sub-100-char text
 * it's likely a scanned/image-based PDF; we surface a friendly error
 * and ask the user to use the OCR pipeline (Phase 26 → Vision OCR)
 * which will land in 41f.4-followup.
 *
 * Per spec doc §1.1 — read-only. We never modify the PDF.
 */

import 'server-only';
import { extractText, getDocumentProxy } from 'unpdf';

export class TrustDeedExtractionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'PDF_PARSE_ERROR'
      | 'SCANNED_PDF_DETECTED'
      | 'EMPTY_PDF',
  ) {
    super(message);
    this.name = 'TrustDeedExtractionError';
  }
}

export interface PdfTextResult {
  /** All page text concatenated with `\n\n` separators. */
  text: string;
  /** Number of pages in the source PDF. */
  pageCount: number;
  /** Per-page text — useful for "this beneficiary list spans pages 5–7" provenance. */
  pages: string[];
}

const SCANNED_PDF_THRESHOLD_CHARS = 100;

/**
 * Extract text from a PDF buffer. Throws `TrustDeedExtractionError`
 * with a typed `code` on any failure so callers can render specific UI.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<PdfTextResult> {
  let proxy;
  try {
    // unpdf accepts a Uint8Array; Buffer is a Uint8Array subclass.
    proxy = await getDocumentProxy(new Uint8Array(buffer));
  } catch (err) {
    throw new TrustDeedExtractionError(
      err instanceof Error ? `PDF parse failed: ${err.message}` : 'PDF parse failed',
      'PDF_PARSE_ERROR',
    );
  }

  let result;
  try {
    // mergePages: false returns text per page; we'll build both shapes.
    result = await extractText(proxy, { mergePages: false });
  } catch (err) {
    throw new TrustDeedExtractionError(
      err instanceof Error ? `PDF text extract failed: ${err.message}` : 'PDF text extract failed',
      'PDF_PARSE_ERROR',
    );
  }

  const pages = Array.isArray(result.text)
    ? result.text.map((p) => (typeof p === 'string' ? p : ''))
    : [String(result.text ?? '')];
  const text = pages.join('\n\n').trim();

  if (text.length === 0) {
    throw new TrustDeedExtractionError(
      'PDF appears to be empty or unreadable.',
      'EMPTY_PDF',
    );
  }

  if (text.length < SCANNED_PDF_THRESHOLD_CHARS) {
    throw new TrustDeedExtractionError(
      'This PDF appears to be a scan/image rather than typeset text. Image OCR support lands in a follow-up — please supply a typeset PDF for now.',
      'SCANNED_PDF_DETECTED',
    );
  }

  return {
    text,
    pageCount: pages.length,
    pages,
  };
}
