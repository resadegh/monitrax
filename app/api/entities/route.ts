/**
 * /api/entities — Phase 41b
 *
 * GET   — list every LegalEntity for the calling user, with owned-objects
 *         counts. Used by the wizard step + standalone /dashboard/entities
 *         surface + the entity drill-in dialog.
 * POST  — create a new LegalEntity. Validated, audit-logged. TFN (if
 *         supplied) encrypted at rest via lib/security/tfnEncryption.ts.
 *
 * SSOT: route handlers are thin. All read/write logic lives in
 * `lib/services/legalEntityService.ts` (CLAUDE.md §6.1, §12.2).
 *
 * Audit: every state-changing action writes a CRUD audit log via
 * `logCRUD`. TFN value NEVER appears in audit metadata — the helper
 * passes a sanitised payload that records `hasTfn: boolean` only.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  listEntitiesForUser,
  createEntity,
  type CreateEntityInput,
} from '@/lib/services/legalEntityService';
import { logCRUD } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import {
  isValidAbn,
  isValidAcn,
  isValidTfnFormat,
} from '@/lib/utils/auValidators';
import type { LegalEntityType, LegalEntityRole } from '@prisma/client';

const VALID_TYPES: LegalEntityType[] = [
  'PERSONAL_NAME',
  'COMPANY',
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
  'SMSF',
  'PARTNERSHIP',
  'SOLE_TRADER',
];

const VALID_ROLES: LegalEntityRole[] = [
  'PERSONAL',
  'HOLDING',
  'OPERATING',
  'INVESTMENT',
  'SUPERANNUATION',
];

export const GET = withPermission('entity.read', async (_request, auth) => {
  try {
    const entities = await listEntitiesForUser(auth.userId);
    return NextResponse.json({ data: entities, _meta: { count: entities.length } });
  } catch (error) {
    // Phase 41c resilience: surface a useful error message to the client so
    // the My Structure page's error block can tell the user (and Reza)
    // what's actually wrong — opaque "Internal server error" makes a live
    // bug invisible. We still log the full error server-side; the client
    // gets the message + a class hint for known failure modes.
    console.error('List entities error:', error);
    let message = 'Failed to list entities.';
    let code: string | undefined;
    if (error instanceof Error) {
      // Prisma "model not found in current schema" surfaces as P2021 / P2022 /
      // a "does not exist" relation error when migrations haven't run.
      // Surface that explicitly so the deployment diagnosis is one click away.
      const m = error.message;
      if (/relation .* does not exist/i.test(m) || /no such table/i.test(m)) {
        message =
          'The legal_entities table is missing in this database. The Phase 41a migration ' +
          'may not have run on this environment. Contact support.';
        code = 'TABLE_MISSING';
      } else if (/Unknown arg|Unknown field/i.test(m)) {
        message =
          'The deployed Prisma client is out of sync with the database schema. ' +
          'Trigger a redeploy.';
        code = 'CLIENT_OUT_OF_SYNC';
      } else {
        // Pass through the underlying message — it's safe (no PII), and
        // surfaces real diagnostic info to the user.
        message = m;
      }
    }
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
});

interface CreateEntityRequestBody {
  name?: unknown;
  type?: unknown;
  role?: unknown;
  abn?: unknown;
  acn?: unknown;
  tfn?: unknown;
  tradingName?: unknown;
  establishedDate?: unknown;
  parentEntityId?: unknown;
  // Phase 12 Track G.3a — reform-aware fields, so the onboarding wizard's
  // entities step can create a trust WITH its trustType in one POST.
  trustType?: unknown;
  isForeignResident?: unknown;
}

const VALID_TRUST_TYPES: ReadonlyArray<string> = [
  'DISCRETIONARY',
  'FIXED',
  'UNIT',
  'TESTAMENTARY_FIXED',
  'CHARITABLE',
  'DECEASED_ESTATE',
  'SPECIAL_DISABILITY',
  'OTHER',
];

export const POST = withPermission('entity.write', async (request: NextRequest, auth) => {
  try {
    const body = (await request.json()) as CreateEntityRequestBody;

    // -------------------------------------------------------------------
    // Validate at the boundary (CLAUDE.md §12.5 — input validation
    // happens at system boundaries, internal code is trusted).
    // -------------------------------------------------------------------
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length === 0 || name.length > 200) {
      return NextResponse.json(
        { error: 'Name is required and must be ≤200 characters.' },
        { status: 400 },
      );
    }

    const type = body.type as LegalEntityType;
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `type must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    const role = body.role as LegalEntityRole;
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `role must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 },
      );
    }

    if (body.abn !== undefined && body.abn !== null && body.abn !== '') {
      if (typeof body.abn !== 'string' || !isValidAbn(body.abn)) {
        return NextResponse.json(
          { error: 'ABN must be 11 digits with a valid checksum.' },
          { status: 400 },
        );
      }
    }

    if (body.acn !== undefined && body.acn !== null && body.acn !== '') {
      if (typeof body.acn !== 'string' || !isValidAcn(body.acn)) {
        return NextResponse.json(
          { error: 'ACN must be 9 digits with a valid checksum.' },
          { status: 400 },
        );
      }
    }

    if (body.tfn !== undefined && body.tfn !== null && body.tfn !== '') {
      if (typeof body.tfn !== 'string' || !isValidTfnFormat(body.tfn)) {
        return NextResponse.json(
          { error: 'TFN must be 8 or 9 digits.' },
          { status: 400 },
        );
      }
    }

    const tradingName =
      typeof body.tradingName === 'string' && body.tradingName.trim().length > 0
        ? body.tradingName.trim()
        : null;

    const establishedDate =
      typeof body.establishedDate === 'string' && body.establishedDate.length > 0
        ? body.establishedDate
        : null;

    const parentEntityId =
      typeof body.parentEntityId === 'string' && body.parentEntityId.length > 0
        ? body.parentEntityId
        : null;

    // Phase 12 Track G.3a — reform-aware fields. `createEntity` only
    // persists `trustType` for trust entity types; an unrecognised value
    // is dropped to null rather than 400'd (lenient — the wizard never
    // sends a bad one, and the field is non-critical).
    const trustType =
      typeof body.trustType === 'string' &&
      VALID_TRUST_TYPES.includes(body.trustType)
        ? (body.trustType as CreateEntityInput['trustType'])
        : null;
    const isForeignResident =
      typeof body.isForeignResident === 'boolean' ? body.isForeignResident : false;

    // -------------------------------------------------------------------
    // Delegate to the canonical service
    // -------------------------------------------------------------------
    const entity = await createEntity(auth.userId, {
      name,
      type,
      role,
      abn: typeof body.abn === 'string' ? body.abn : null,
      acn: typeof body.acn === 'string' ? body.acn : null,
      tfn: typeof body.tfn === 'string' ? body.tfn : null,
      tradingName,
      establishedDate,
      parentEntityId,
      trustType,
      isForeignResident,
    });

    // Fire-and-forget audit log (CLAUDE.md §12.10 — never block responses).
    // CDR §13: TFN value NEVER appears in metadata; we record `hasTfn: boolean`
    // and run the payload through `sanitizeCdrMetadata` for defence-in-depth.
    logCRUD({
      userId: auth.userId,
      action: 'CREATE',
      entityType: 'LegalEntity',
      entityId: entity.id,
      metadata: sanitizeCdrMetadata({
        name: entity.name,
        type: entity.type,
        role: entity.role,
        hasAbn: entity.abn != null,
        hasAcn: entity.acn != null,
        hasTfn: entity.hasTfn,
        hasParent: entity.parentEntityId != null,
      }),
    }).catch(() => {});

    return NextResponse.json(entity, { status: 201 });
  } catch (error) {
    console.error('Create entity error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: message.startsWith('Parent entity') ? 400 : 500 },
    );
  }
});
