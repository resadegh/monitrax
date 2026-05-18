/**
 * Phase 42 PR5.5 — Receipt ZIP bundle builder.
 *
 * Bundles every Document in the requested AU FY window whose
 * `category` is one of RECEIPT / INVOICE / TAX into a single ZIP for
 * accountant handoff. The accountant gets:
 *   - The Tax Pack summary (already covered by JSON/XLSX/PDF), AND
 *   - The supporting receipts in one zipped folder.
 *
 * Folder structure inside the ZIP (single canonical layout — keeps the
 * accountant from having to learn three structures, unlike
 * `/api/documents/export` which exposes 3):
 *
 *   monitrax-receipts-FY<label>/
 *     Receipts/
 *       <yyyy-MM-dd>_<originalFilename>
 *     Invoices/
 *       <yyyy-MM-dd>_<originalFilename>
 *     Tax_Documents/
 *       <yyyy-MM-dd>_<originalFilename>
 *     MANIFEST.txt   (plain-text inventory; bundle vintage + count + per-folder list)
 *
 * Per CLAUDE.md §12.3 — composes the existing storage abstraction
 * (`lib/documents/storage/factory.ts`) + the existing `jszip` pattern
 * from `/api/documents/export`. No new ZIP infrastructure.
 *
 * Per §12.7 — `jszip` is already an approved dep (see
 * `docs/policy/APPROVED_DEPENDENCIES.md`). The originally-proposed
 * `archiver` dep is NOT added; one ZIP library is the SSOT.
 *
 * Per §13.3 — receipts are user-uploaded artefacts (NOT CDR data); no
 * sanitisation required at the bytes level. The bundle filename
 * includes only the FY label, never user balances or merchant info.
 */

import JSZip from 'jszip';
import prisma from '@/lib/db';
import { getStorageProvider } from '@/lib/documents/storage';
import type { TaxPackWindow } from './summary';
import type { DocumentCategory } from '@prisma/client';

const RECEIPT_CATEGORIES = ['RECEIPT', 'INVOICE', 'TAX'] as const satisfies readonly DocumentCategory[];

const FOLDER_BY_CATEGORY: Record<(typeof RECEIPT_CATEGORIES)[number], string> = {
  RECEIPT: 'Receipts',
  INVOICE: 'Invoices',
  TAX: 'Tax_Documents',
};

export interface ReceiptBundleResult {
  /** The ZIP bytes — caller wraps as Blob + NextResponse. */
  bytes: Uint8Array;
  /** Total documents bundled (sum across all three folders). */
  documentCount: number;
  /** Per-folder count. Always 3 keys (Receipts / Invoices / Tax_Documents). */
  countByFolder: Record<string, number>;
  /** Documents that existed in the DB but had no fetchable content. */
  missingCount: number;
}

/**
 * Build a receipt ZIP bundle for the given user + FY window.
 *
 * Returns `bytes` (Uint8Array) plus diagnostic counts the caller can
 * surface in response headers (`X-Monitrax-Doc-Count`, etc.).
 *
 * Throws only on storage-fetch failures that suggest a misconfigured
 * provider — individual missing-bytes documents are tolerated and
 * reported via `missingCount`, the bundle still ships with the rest.
 */
export async function buildReceiptZipBundle(
  userId: string,
  window: TaxPackWindow
): Promise<ReceiptBundleResult> {
  const documents = await prisma.document.findMany({
    where: {
      userId,
      deletedAt: null,
      category: { in: [...RECEIPT_CATEGORIES] },
      uploadedAt: { gte: window.start, lte: window.end },
    },
    orderBy: { uploadedAt: 'asc' },
  });

  const zip = new JSZip();
  const root = zip.folder(`monitrax-receipts-${window.label.toLowerCase()}`);
  if (!root) {
    throw new Error('Failed to create root folder in ZIP archive');
  }

  const storage = await getStorageProvider(userId);
  const usedPaths = new Set<string>();
  const countByFolder: Record<string, number> = {
    Receipts: 0,
    Invoices: 0,
    Tax_Documents: 0,
  };
  let missingCount = 0;

  for (const doc of documents) {
    const folder = FOLDER_BY_CATEGORY[doc.category as keyof typeof FOLDER_BY_CATEGORY];
    if (!folder) continue;

    let bytes: Buffer | null = null;
    if (doc.fileContent) {
      bytes = doc.fileContent;
    } else if (doc.storagePath) {
      const dl = await storage.download(doc.storagePath);
      if (dl.success && dl.data) {
        bytes = dl.data;
      }
    }
    if (!bytes) {
      missingCount++;
      continue;
    }

    const datePrefix = formatDatePrefix(doc.uploadedAt);
    const safeName = sanitiseFilename(doc.originalFilename || doc.filename || `${doc.id}.bin`);
    let candidate = `${folder}/${datePrefix}_${safeName}`;
    let counter = 1;
    while (usedPaths.has(candidate)) {
      const ext = safeName.includes('.') ? safeName.slice(safeName.lastIndexOf('.')) : '';
      const base = safeName.includes('.') ? safeName.slice(0, safeName.lastIndexOf('.')) : safeName;
      candidate = `${folder}/${datePrefix}_${base}_${counter}${ext}`;
      counter++;
    }
    usedPaths.add(candidate);
    root.file(candidate, bytes);
    countByFolder[folder] = (countByFolder[folder] ?? 0) + 1;
  }

  root.file('MANIFEST.txt', buildManifest(window, documents.length, countByFolder, missingCount));

  const bytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    bytes,
    documentCount: documents.length - missingCount,
    countByFolder,
    missingCount,
  };
}

export function suggestedZipFilename(fyLabel: string): string {
  return `monitrax-receipts-${fyLabel.toLowerCase()}.zip`;
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

function formatDatePrefix(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Strip filesystem-unsafe characters + cap length. Mirrors the
 * `sanitizeFilename` already used by `/api/documents/export` (single
 * canonical sanitisation rule).
 */
function sanitiseFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200);
}

function buildManifest(
  window: TaxPackWindow,
  total: number,
  countByFolder: Record<string, number>,
  missing: number
): string {
  const generated = new Date().toISOString();
  const folderLines = Object.entries(countByFolder)
    .map(([folder, count]) => `  ${folder}: ${count}`)
    .join('\n');
  return [
    'Monitrax Tax Pack — Receipt bundle',
    `FY: ${window.label}`,
    `Window: ${window.start.toISOString().slice(0, 10)} → ${window.end.toISOString().slice(0, 10)}`,
    `Generated: ${generated}`,
    '',
    `Total documents in window: ${total}`,
    `Bundled: ${total - missing}`,
    `Missing (content unavailable): ${missing}`,
    '',
    'By folder:',
    folderLines,
    '',
    'This bundle is NOT tax advice. Your registered tax agent confirms',
    'deductibility, applies depreciation rates, and reconciles against',
    'statutory records. Monitrax is the user-side tool; Xero / your',
    'accountant remain the authoritative bookkeeping system.',
    '',
  ].join('\n');
}
