/**
 * Phase 41f.4 — Trust-deed extraction orchestrator.
 *
 * Coordinates the 4-step flow per spec doc §7:
 *   1. UPLOAD — caller persists the PDF to Phase 26 vault and passes
 *      us the `documentId`. (We don't own upload here; we own
 *      extraction.)
 *   2. EXTRACT — pdfTextExtractor → geminiExtractor → persist new
 *      `TrustDeedExtractedRules` row with `status = EXTRACTED`.
 *   3. REVIEW — caller PATCHes individual fields via the API; the
 *      service exposes `updateExtractedRules` for that.
 *   4. CONFIRM | REJECT — caller transitions the row's status; the
 *      lifecycle helper enforces the locked transitions.
 *
 * Lifecycle invariants (spec doc §1.1 + §6.2):
 *   - Tax engines (Phase 41e.4 + e.5) ONLY consume CONFIRMED rows.
 *   - REJECTED rows are tombstoned for audit; never re-activated.
 *   - Re-extraction (e.g. user uploads a newer deed) creates a NEW
 *     row; the previous CONFIRMED row stays in history.
 *
 * CLAUDE.md §12.11 — every write here is filled in advance:
 *   - createExtraction: pure CREATE; no row mutations.
 *   - updateExtractedRules: only updates EXTRACTED rows (rejects if
 *     status moved on); only touches the JSON columns the user is
 *     editing in the review step.
 *   - confirmExtraction / rejectExtraction: status transition guarded.
 */

import 'server-only';
import type { TrustDeedExtractedRules, TrustDeedRuleStatus } from '@prisma/client';
import prisma from '@/lib/db';
import { extractTextFromPdf, TrustDeedExtractionError } from './pdfTextExtractor';
import {
  extractTrustDeedRules,
  GeminiExtractionError,
} from './geminiExtractor';
import {
  TrustDeedExtractionSchema,
  type TrustDeedExtraction,
} from './types';

export class TrustDeedServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'DOCUMENT_NOT_FOUND'
      | 'DOCUMENT_NOT_PDF'
      | 'PDF_PARSE_ERROR'
      | 'SCANNED_PDF_DETECTED'
      | 'EMPTY_PDF'
      | 'GEMINI_NOT_CONFIGURED'
      | 'EXTRACTION_FAILED'
      | 'SCHEMA_INVALID'
      | 'RULES_NOT_FOUND'
      | 'INVALID_TRANSITION'
      | 'NOT_EDITABLE',
  ) {
    super(message);
    this.name = 'TrustDeedServiceError';
  }
}

export interface CreateExtractionInput {
  legalEntityId: string;
  uploadedDocumentId: string;
  pulledByUserId: string;
}

/**
 * End-to-end: load the PDF from Phase 26 vault → extract text →
 * Gemini-structure → persist a new TrustDeedExtractedRules row.
 *
 * Returns the persisted row. Status will be EXTRACTED.
 */
export async function createExtraction(
  input: CreateExtractionInput,
): Promise<TrustDeedExtractedRules> {
  // 1. Load the document + verify it's a PDF.
  const doc = await prisma.document.findUnique({
    where: { id: input.uploadedDocumentId },
    select: {
      id: true,
      userId: true,
      mimeType: true,
      fileContent: true,
      storagePath: true,
      storageProvider: true,
    },
  });
  if (!doc) {
    throw new TrustDeedServiceError(
      'Uploaded document not found.',
      'DOCUMENT_NOT_FOUND',
    );
  }
  if (!doc.mimeType?.toLowerCase().includes('pdf')) {
    throw new TrustDeedServiceError(
      'Trust-deed extraction requires a PDF upload.',
      'DOCUMENT_NOT_PDF',
    );
  }

  // 2. Resolve the PDF buffer. v1 supports the MONITRAX storage
  // provider (fileContent column). GCS / S3 paths are deferred to
  // a follow-up — surface a clear error if encountered.
  let buffer: Buffer;
  if (doc.fileContent) {
    buffer = Buffer.from(doc.fileContent);
  } else {
    throw new TrustDeedServiceError(
      'Document content not available for extraction (external-storage providers not yet supported in v1).',
      'DOCUMENT_NOT_FOUND',
    );
  }

  // 3. PDF → text.
  let pdf;
  try {
    pdf = await extractTextFromPdf(buffer);
  } catch (err) {
    if (err instanceof TrustDeedExtractionError) {
      throw new TrustDeedServiceError(err.message, err.code);
    }
    throw err;
  }

  // 4. Text → structured rules via Gemini.
  let geminiResult;
  try {
    geminiResult = await extractTrustDeedRules({ deedText: pdf.text });
  } catch (err) {
    if (err instanceof GeminiExtractionError) {
      throw new TrustDeedServiceError(err.message, err.code);
    }
    throw err;
  }

  const { extraction, extractorVersion, rawProviderPayload } = geminiResult;

  // 5. Persist as new TrustDeedExtractedRules row (status = EXTRACTED).
  const row = await prisma.trustDeedExtractedRules.create({
    data: {
      legalEntityId: input.legalEntityId,
      uploadedDocumentId: input.uploadedDocumentId,
      extractorVersion,
      extractedByUserId: input.pulledByUserId,
      status: 'EXTRACTED',
      beneficiaries: extraction.beneficiaries as unknown as object,
      distributionRules: extraction.distributionRules as unknown as object,
      vestingDate: extraction.vestingDate ? new Date(extraction.vestingDate) : null,
      trusteePower: (extraction.trusteePower ?? null) as unknown as object,
      loanProvisions: (extraction.loanProvisions ?? null) as unknown as object,
      uncomputedNotes: extraction.uncomputedNotes as unknown as object,
      rawExtractorPayload: rawProviderPayload as unknown as object,
    },
  });

  return row;
}

/**
 * Patch the EXTRACTED rules with user edits during the review step.
 * Throws NOT_EDITABLE if the row has already been CONFIRMED or
 * REJECTED. Only the JSON shape columns are editable; provenance +
 * lifecycle columns are not.
 */
export async function updateExtractedRules(input: {
  rulesId: string;
  patch: Partial<TrustDeedExtraction>;
}): Promise<TrustDeedExtractedRules> {
  const existing = await prisma.trustDeedExtractedRules.findUnique({
    where: { id: input.rulesId },
    select: {
      id: true,
      status: true,
      beneficiaries: true,
      distributionRules: true,
      vestingDate: true,
      trusteePower: true,
      loanProvisions: true,
      uncomputedNotes: true,
    },
  });
  if (!existing) {
    throw new TrustDeedServiceError(
      'Trust-deed extraction not found.',
      'RULES_NOT_FOUND',
    );
  }
  if (existing.status !== 'EXTRACTED') {
    throw new TrustDeedServiceError(
      `Cannot edit a ${existing.status.toLowerCase()} extraction. Re-upload the deed to start over.`,
      'NOT_EDITABLE',
    );
  }

  // Re-validate the merged shape — never let a malformed patch land.
  const merged: TrustDeedExtraction = {
    beneficiaries:
      input.patch.beneficiaries ??
      (existing.beneficiaries as unknown as TrustDeedExtraction['beneficiaries']),
    distributionRules:
      input.patch.distributionRules ??
      (existing.distributionRules as unknown as TrustDeedExtraction['distributionRules']),
    vestingDate:
      input.patch.vestingDate ??
      (existing.vestingDate ? existing.vestingDate.toISOString().slice(0, 10) : null),
    trusteePower:
      input.patch.trusteePower ??
      (existing.trusteePower as unknown as TrustDeedExtraction['trusteePower']),
    loanProvisions:
      input.patch.loanProvisions ??
      (existing.loanProvisions as unknown as TrustDeedExtraction['loanProvisions']),
    uncomputedNotes:
      input.patch.uncomputedNotes ??
      (existing.uncomputedNotes as unknown as TrustDeedExtraction['uncomputedNotes']),
    overallConfidence: 1, // user-edited rules carry implicit user trust
  };

  const validated = TrustDeedExtractionSchema.safeParse(merged);
  if (!validated.success) {
    throw new TrustDeedServiceError(
      `Edited rules failed validation: ${validated.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
      'SCHEMA_INVALID',
    );
  }

  const updated = await prisma.trustDeedExtractedRules.update({
    where: { id: input.rulesId },
    data: {
      beneficiaries: validated.data.beneficiaries as unknown as object,
      distributionRules: validated.data.distributionRules as unknown as object,
      vestingDate: validated.data.vestingDate
        ? new Date(validated.data.vestingDate)
        : null,
      trusteePower: (validated.data.trusteePower ?? null) as unknown as object,
      loanProvisions: (validated.data.loanProvisions ?? null) as unknown as object,
      uncomputedNotes: validated.data.uncomputedNotes as unknown as object,
    },
  });
  return updated;
}

// =============================================================================
// Lifecycle transitions (EXTRACTED → CONFIRMED | REJECTED)
// =============================================================================

const ALLOWED_TRANSITIONS: Record<TrustDeedRuleStatus, TrustDeedRuleStatus[]> = {
  EXTRACTED: ['CONFIRMED', 'REJECTED'],
  CONFIRMED: [], // terminal — re-upload the deed to revise
  REJECTED: [], // terminal — re-upload the deed to revise
};

export function isAllowedTransition(
  from: TrustDeedRuleStatus,
  to: TrustDeedRuleStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function confirmExtraction(
  rulesId: string,
): Promise<TrustDeedExtractedRules> {
  return transitionStatus(rulesId, 'CONFIRMED');
}

export async function rejectExtraction(
  rulesId: string,
  reason: string,
): Promise<TrustDeedExtractedRules> {
  return transitionStatus(rulesId, 'REJECTED', reason);
}

async function transitionStatus(
  rulesId: string,
  to: TrustDeedRuleStatus,
  rejectionReason?: string,
): Promise<TrustDeedExtractedRules> {
  const existing = await prisma.trustDeedExtractedRules.findUnique({
    where: { id: rulesId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new TrustDeedServiceError(
      'Trust-deed extraction not found.',
      'RULES_NOT_FOUND',
    );
  }
  if (!isAllowedTransition(existing.status, to)) {
    throw new TrustDeedServiceError(
      `Cannot transition from ${existing.status} to ${to}. ${
        existing.status === 'EXTRACTED'
          ? ''
          : 'This extraction is already finalised — re-upload the deed to revise.'
      }`,
      'INVALID_TRANSITION',
    );
  }

  const now = new Date();
  return prisma.trustDeedExtractedRules.update({
    where: { id: rulesId },
    data: {
      status: to,
      ...(to === 'CONFIRMED' ? { confirmedAt: now } : {}),
      ...(to === 'REJECTED'
        ? {
            rejectedAt: now,
            rejectionReason: rejectionReason ?? null,
          }
        : {}),
    },
  });
}

/**
 * Read latest extraction for an entity (any status). Used by the
 * connect-bookkeeping flow + the trust-deed page to render the
 * current state.
 */
export async function getLatestExtractionForEntity(
  legalEntityId: string,
): Promise<TrustDeedExtractedRules | null> {
  return prisma.trustDeedExtractedRules.findFirst({
    where: { legalEntityId },
    orderBy: { createdAt: 'desc' },
  });
}
