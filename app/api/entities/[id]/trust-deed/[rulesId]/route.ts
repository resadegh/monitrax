/**
 * Phase 41f.4 — /api/entities/[id]/trust-deed/[rulesId]
 *
 * PATCH — User edits to extracted rules during the review step.
 *         Body: partial TrustDeedExtraction shape; only EXTRACTED rows
 *         are editable (CONFIRMED / REJECTED rows are terminal).
 *
 * POST  — Lifecycle transition. Body:
 *         { action: 'CONFIRM' | 'REJECT', rejectionReason?: string }
 *
 * The 4-step flow (per spec doc §7) is:
 *   1. POST /api/entities/[id]/trust-deed (upload + extract)
 *   2. GET  /api/entities/[id]/trust-deed (load latest)
 *   3. PATCH /api/entities/[id]/trust-deed/[rulesId] (edit)
 *   4. POST  /api/entities/[id]/trust-deed/[rulesId] { action: 'CONFIRM' }
 *
 * CLAUDE.md §12.11: every write here is filled in advance. The service
 * layer enforces "only mutate rows that match the entity owner" by
 * pre-fetching via `prisma.trustDeedExtractedRules.findFirst` with
 * `legalEntityId` filter. The lifecycle transition map guards against
 * status drift.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listEntitiesForUser } from '@/lib/services/legalEntityService';
import prisma from '@/lib/db';
import {
  updateExtractedRules,
  confirmExtraction,
  rejectExtraction,
  TrustDeedServiceError,
} from '@/lib/integrations/trust-deed';
import { logCRUD } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

type RouteContext = { params: Promise<{ id: string; rulesId: string }> };

interface PatchBody {
  beneficiaries?: unknown;
  distributionRules?: unknown;
  vestingDate?: unknown;
  trusteePower?: unknown;
  loanProvisions?: unknown;
  uncomputedNotes?: unknown;
}

interface PostBody {
  action?: unknown;
  rejectionReason?: unknown;
}

export const PATCH = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    try {
      const { id, rulesId } = await context!.params;

      // Defence-in-depth — confirm the entity belongs to the caller AND
      // the rulesId belongs to that entity.
      const entities = await listEntitiesForUser(auth.userId);
      const entity = entities.find((e) => e.id === id);
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      const owned = await prisma.trustDeedExtractedRules.findFirst({
        where: { id: rulesId, legalEntityId: id },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { error: 'Trust-deed extraction not found.' },
          { status: 404 },
        );
      }

      const body = (await request.json().catch(() => ({}))) as PatchBody;

      // We pass through whatever the user sent and let the service +
      // Zod validate. Bad shapes return SCHEMA_INVALID.
      let updated;
      try {
        updated = await updateExtractedRules({
          rulesId,
          patch: body as never,
        });
      } catch (err) {
        if (err instanceof TrustDeedServiceError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: mapErrorCodeToStatus(err.code) },
          );
        }
        throw err;
      }

      logCRUD({
        userId: auth.userId,
        action: 'UPDATE',
        entityType: 'TrustDeedExtractedRules',
        entityId: rulesId,
        metadata: sanitizeCdrMetadata({
          legalEntityId: id,
          // CDR-safe: which top-level keys the user touched (counts only)
          fieldsTouched: Object.keys(body),
        }),
      }).catch(() => {});

      return NextResponse.json({ rules: serializeRules(updated) });
    } catch (error) {
      console.error('PATCH trust-deed error:', error);
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
      const { id, rulesId } = await context!.params;

      const entities = await listEntitiesForUser(auth.userId);
      const entity = entities.find((e) => e.id === id);
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      const owned = await prisma.trustDeedExtractedRules.findFirst({
        where: { id: rulesId, legalEntityId: id },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { error: 'Trust-deed extraction not found.' },
          { status: 404 },
        );
      }

      const body = (await request.json().catch(() => ({}))) as PostBody;
      const action = body.action;
      if (action !== 'CONFIRM' && action !== 'REJECT') {
        return NextResponse.json(
          {
            error: 'Body must include `action: "CONFIRM" | "REJECT"`.',
            code: 'INVALID_ACTION',
          },
          { status: 400 },
        );
      }

      let updated;
      try {
        if (action === 'CONFIRM') {
          updated = await confirmExtraction(rulesId);
        } else {
          const reason =
            typeof body.rejectionReason === 'string' && body.rejectionReason.trim().length > 0
              ? body.rejectionReason.trim()
              : 'User rejected the extracted rules.';
          updated = await rejectExtraction(rulesId, reason);
        }
      } catch (err) {
        if (err instanceof TrustDeedServiceError) {
          return NextResponse.json(
            { error: err.message, code: err.code },
            { status: mapErrorCodeToStatus(err.code) },
          );
        }
        throw err;
      }

      logCRUD({
        userId: auth.userId,
        action: 'UPDATE',
        entityType: 'TrustDeedExtractedRules',
        entityId: rulesId,
        metadata: sanitizeCdrMetadata({
          legalEntityId: id,
          legalEntityName: entity.name,
          transition: action,
          confirmedAt: updated.confirmedAt?.toISOString() ?? null,
          rejectedAt: updated.rejectedAt?.toISOString() ?? null,
        }),
      }).catch(() => {});

      return NextResponse.json({ rules: serializeRules(updated) });
    } catch (error) {
      console.error('POST trust-deed action error:', error);
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
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
