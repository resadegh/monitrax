/**
 * Phase 41f.4 — /api/entities/[id]/trust-deed
 *
 * GET   — Returns the latest TrustDeedExtractedRules row for this
 *         entity (any status) + the underlying Document metadata.
 *         Used by the 4-step UI page to render the current state.
 *
 * POST  — Uploads a PDF + extracts in one round-trip:
 *         1. Validates the entity belongs to the caller
 *         2. Persists the PDF to Phase 26 vault via the existing
 *            Document model
 *         3. Runs OCR + Gemini extraction
 *         4. Persists a new TrustDeedExtractedRules row (status =
 *            EXTRACTED)
 *
 *         Body: multipart/form-data with `file` (PDF). Returns the
 *         persisted rules row + the document id.
 *
 * Per spec doc §1.1 — read-only treatment of the PDF; we never modify
 * the user's uploaded file.
 *
 * CLAUDE.md §13.3 — CDR sanitisation: trust deeds may contain TFNs +
 * beneficiary PII. The raw deed text passes through Gemini (Privacy
 * Act 1988 covered, not CDR — per spec doc §10) but is NEVER logged
 * verbatim. Audit metadata is sanitised.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listEntitiesForUser } from '@/lib/services/legalEntityService';
import prisma from '@/lib/db';
import {
  createExtraction,
  getLatestExtractionForEntity,
  TrustDeedServiceError,
} from '@/lib/integrations/trust-deed';
import { logCRUD } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { isGeminiConfigured } from '@/lib/ai/gemini';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_PDF_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const GET = withPermission<RouteContext>(
  'entity.read',
  async (_request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;

      const entities = await listEntitiesForUser(auth.userId);
      const entity = entities.find((e) => e.id === id);
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      const rules = await getLatestExtractionForEntity(id);

      let document = null;
      if (rules) {
        document = await prisma.document.findUnique({
          where: { id: rules.uploadedDocumentId },
          select: {
            id: true,
            originalFilename: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
          },
        });
      }

      return NextResponse.json({
        configured: isGeminiConfigured(),
        entity: { id: entity.id, name: entity.name, type: entity.type },
        rules: rules ? serializeRules(rules) : null,
        document,
      });
    } catch (error) {
      console.error('GET trust-deed error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);

export const POST = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;

      const entities = await listEntitiesForUser(auth.userId);
      const entity = entities.find((e) => e.id === id);
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      // Trust-deed parsing only makes sense for trust-shaped entities;
      // surface a friendly 400 for personal-name / company / SMSF.
      if (
        entity.type !== 'DISCRETIONARY_TRUST' &&
        entity.type !== 'UNIT_TRUST'
      ) {
        return NextResponse.json(
          {
            error:
              'Trust-deed parsing is only available for DISCRETIONARY_TRUST or UNIT_TRUST entities.',
            code: 'NOT_A_TRUST_ENTITY',
          },
          { status: 400 },
        );
      }

      if (!isGeminiConfigured()) {
        return NextResponse.json(
          {
            error: 'Trust-deed parser is not configured (GEMINI_API_KEY unset).',
            code: 'GEMINI_NOT_CONFIGURED',
          },
          { status: 503 },
        );
      }

      // Multipart PDF upload.
      const formData = await request.formData().catch(() => null);
      if (!formData) {
        return NextResponse.json(
          { error: 'Expected multipart/form-data with a `file` field.' },
          { status: 400 },
        );
      }
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: 'Missing or invalid `file` field.' },
          { status: 400 },
        );
      }
      if (!file.type.toLowerCase().includes('pdf')) {
        return NextResponse.json(
          { error: 'Trust-deed must be a PDF.', code: 'NOT_A_PDF' },
          { status: 400 },
        );
      }
      if (file.size > MAX_PDF_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `PDF too large (max ${MAX_PDF_SIZE_BYTES / (1024 * 1024)} MB).`,
            code: 'PDF_TOO_LARGE',
          },
          { status: 413 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Persist the PDF to Phase 26 vault via the canonical Document model.
      // We store inline (MONITRAX storage) at v1 — external-storage providers
      // are an extractionService limitation noted in §1.1 of the spec doc.
      const document = await prisma.document.create({
        data: {
          userId: auth.userId,
          filename: `trust-deed-${entity.id}-${Date.now()}.pdf`,
          originalFilename: file.name,
          mimeType: file.type || 'application/pdf',
          size: file.size,
          category: 'CONTRACT',
          storageProvider: 'MONITRAX',
          storagePath: `trust-deeds/${entity.id}/${Date.now()}.pdf`,
          fileContent: buffer,
          description: `Trust deed for ${entity.name}`,
          tags: ['trust-deed', `entity:${entity.id}`],
        },
        select: { id: true },
      });

      // Run extraction.
      let rules;
      try {
        rules = await createExtraction({
          legalEntityId: id,
          uploadedDocumentId: document.id,
          pulledByUserId: auth.userId,
        });
      } catch (err) {
        if (err instanceof TrustDeedServiceError) {
          const status = mapErrorCodeToStatus(err.code);
          return NextResponse.json(
            { error: err.message, code: err.code, documentId: document.id },
            { status },
          );
        }
        throw err;
      }

      logCRUD({
        userId: auth.userId,
        action: 'CREATE',
        entityType: 'TrustDeedExtractedRules',
        entityId: rules.id,
        metadata: sanitizeCdrMetadata({
          legalEntityId: entity.id,
          legalEntityName: entity.name,
          legalEntityType: entity.type,
          documentId: document.id,
          extractorVersion: rules.extractorVersion,
          // CDR-safe: counts only, never beneficiary names or rule text
          beneficiaryCount: Array.isArray(rules.beneficiaries)
            ? rules.beneficiaries.length
            : 0,
          uncomputedNoteCount: Array.isArray(rules.uncomputedNotes)
            ? rules.uncomputedNotes.length
            : 0,
        }),
      }).catch(() => {});

      return NextResponse.json({
        rules: serializeRules(rules),
        document: { id: document.id },
      });
    } catch (error) {
      console.error('POST trust-deed error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);

function mapErrorCodeToStatus(code: TrustDeedServiceError['code']): number {
  switch (code) {
    case 'DOCUMENT_NOT_FOUND':
    case 'RULES_NOT_FOUND':
      return 404;
    case 'DOCUMENT_NOT_PDF':
    case 'PDF_PARSE_ERROR':
    case 'EMPTY_PDF':
    case 'SCHEMA_INVALID':
    case 'INVALID_TRANSITION':
    case 'NOT_EDITABLE':
      return 400;
    case 'SCANNED_PDF_DETECTED':
      return 422;
    case 'GEMINI_NOT_CONFIGURED':
      return 503;
    case 'EXTRACTION_FAILED':
      return 502;
    default:
      return 500;
  }
}

// Serialise — Decimal/Date/JSON columns to plain JSON. rawExtractorPayload
// is server-side-only (never returned to the client per spec doc §10).
function serializeRules(r: import('@prisma/client').TrustDeedExtractedRules) {
  return {
    id: r.id,
    legalEntityId: r.legalEntityId,
    uploadedDocumentId: r.uploadedDocumentId,
    extractedAt: r.extractedAt.toISOString(),
    extractorVersion: r.extractorVersion,
    extractedByUserId: r.extractedByUserId,
    status: r.status,
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    rejectedAt: r.rejectedAt?.toISOString() ?? null,
    rejectionReason: r.rejectionReason,
    beneficiaries: r.beneficiaries,
    distributionRules: r.distributionRules,
    vestingDate: r.vestingDate?.toISOString().slice(0, 10) ?? null,
    trusteePower: r.trusteePower,
    loanProvisions: r.loanProvisions,
    uncomputedNotes: r.uncomputedNotes,
    // rawExtractorPayload omitted — forensic only
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
