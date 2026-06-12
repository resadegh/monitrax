/**
 * /api/entities/[id] — Phase 41b
 *
 * GET    — single LegalEntity with owned-objects counts.
 * PUT    — update entity metadata. TFN follows the same encrypt-and-
 *          never-log rule as POST /api/entities.
 * DELETE — remove the entity. Hard-guarded: returns 409 Conflict if the
 *          entity has any owned rows (Properties / Loans / Accounts /
 *          InvestmentAccounts / Assets / Income / Expenses). The DB FK
 *          is `ON DELETE RESTRICT` per Phase 41a migration §5; this
 *          guard surfaces the specific counts so the UI can render
 *          "Reassign 3 properties first" instead of a raw 500.
 *
 * Route shape: `withPermission<RouteContext>('perm', async (request,
 * auth, context) => { const { id } = await context!.params; })` —
 * Next.js 15 strict route shape requires the Promise-typed params + the
 * non-null assertion on `context!`. See PR #607 fix d843e03 for the
 * full WHY.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  listEntitiesForUser,
  updateEntity,
  deleteEntity,
  EntityHasOwnedObjectsError,
} from '@/lib/services/legalEntityService';
import { logCRUD } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import {
  isValidAbn,
  isValidAcn,
  isValidTfnFormat,
} from '@/lib/utils/auValidators';
import type { LegalEntityType, LegalEntityRole, CompanySubtype } from '@prisma/client';
import {
  ALL_ENTITY_TYPES,
  ALL_ENTITY_ROLES,
  COMPANY_SUBTYPE_OPTIONS,
  ESTATE_STATUS_OPTIONS,
  PARTNERSHIP_SUBTYPE_OPTIONS,
} from '@/lib/entities/entityTypeCatalog';

type RouteContext = { params: Promise<{ id: string }> };

// Phase 47 F1 — the full Phase 44 grammar (catalog = SSOT).
const VALID_TYPES: readonly LegalEntityType[] = ALL_ENTITY_TYPES;
const VALID_ROLES: readonly LegalEntityRole[] = ALL_ENTITY_ROLES;
const VALID_COMPANY_SUBTYPES: ReadonlySet<string> = new Set(
  COMPANY_SUBTYPE_OPTIONS.map(o => o.value),
);
const VALID_ESTATE_STATUSES: ReadonlySet<string> = new Set(
  ESTATE_STATUS_OPTIONS.map(o => o.value),
);
const VALID_PARTNERSHIP_SUBTYPES: ReadonlySet<string> = new Set(
  PARTNERSHIP_SUBTYPE_OPTIONS.map(o => o.value),
);

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
      return NextResponse.json(entity);
    } catch (error) {
      console.error('Get entity error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);

interface UpdateEntityRequestBody {
  name?: unknown;
  type?: unknown;
  role?: unknown;
  abn?: unknown;
  acn?: unknown;
  tfn?: unknown;            // null clears, undefined leaves untouched
  tradingName?: unknown;
  establishedDate?: unknown;
  parentEntityId?: unknown; // null disconnects, undefined leaves untouched
  trustType?: unknown;      // Phase 41E.3 — Measure 3 dispatch input
  isForeignResident?: unknown; // Phase 41E.3 — Measure 4 dispatch input
  // Phase 47 F1 — extended-grammar detail fields.
  companySubtype?: unknown;
  dateOfBirth?: unknown;
  vestingDate?: unknown;
  deedDate?: unknown;
  estateAdministrationStatus?: unknown;
  partnershipSubtype?: unknown;
}

/** Phase 47 F1 — optional ISO date field: undefined absent, null clears. */
function parseOptionalDateField(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || isNaN(new Date(value).getTime())) {
    throw new Error(`${field} must be an ISO date string.`);
  }
  return value;
}

export const PUT = withPermission<RouteContext>(
  'entity.write',
  async (request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;
      const body = (await request.json()) as UpdateEntityRequestBody;

      // Confirm ownership first (defence-in-depth — service also checks).
      const entities = await listEntitiesForUser(auth.userId);
      const existing = entities.find((e) => e.id === id);
      if (!existing) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      // Validate boundary inputs.
      if (body.name !== undefined) {
        if (typeof body.name !== 'string' || body.name.trim().length === 0) {
          return NextResponse.json(
            { error: 'Name must be a non-empty string.' },
            { status: 400 },
          );
        }
      }

      if (body.type !== undefined && !VALID_TYPES.includes(body.type as LegalEntityType)) {
        return NextResponse.json(
          { error: `type must be one of: ${VALID_TYPES.join(', ')}` },
          { status: 400 },
        );
      }

      if (body.role !== undefined && !VALID_ROLES.includes(body.role as LegalEntityRole)) {
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

      // Phase 41E.3 — validate trustType against the closed enum.
      // Phase 47 F1 adds HYBRID + TESTAMENTARY (the Phase 44 additions).
      if (body.trustType !== undefined && body.trustType !== null && body.trustType !== '') {
        const VALID_TRUST_TYPES = [
          'DISCRETIONARY',
          'FIXED',
          'UNIT',
          'TESTAMENTARY_FIXED',
          'CHARITABLE',
          'DECEASED_ESTATE',
          'SPECIAL_DISABILITY',
          'OTHER',
          'HYBRID',
          'TESTAMENTARY',
        ];
        if (typeof body.trustType !== 'string' || !VALID_TRUST_TYPES.includes(body.trustType)) {
          return NextResponse.json(
            {
              error: `trustType must be one of: ${VALID_TRUST_TYPES.join(', ')}`,
            },
            { status: 400 },
          );
        }
      }

      // Phase 41E.3 — validate isForeignResident is a boolean (or null).
      if (body.isForeignResident !== undefined && body.isForeignResident !== null) {
        if (typeof body.isForeignResident !== 'boolean') {
          return NextResponse.json(
            { error: 'isForeignResident must be a boolean or null.' },
            { status: 400 },
          );
        }
      }

      // Phase 47 F1 — validate the extended detail fields.
      if (
        body.companySubtype !== undefined &&
        body.companySubtype !== null &&
        body.companySubtype !== '' &&
        (typeof body.companySubtype !== 'string' ||
          !VALID_COMPANY_SUBTYPES.has(body.companySubtype))
      ) {
        return NextResponse.json(
          { error: `companySubtype must be one of: ${[...VALID_COMPANY_SUBTYPES].join(', ')}` },
          { status: 400 },
        );
      }
      if (
        body.estateAdministrationStatus !== undefined &&
        body.estateAdministrationStatus !== null &&
        body.estateAdministrationStatus !== '' &&
        (typeof body.estateAdministrationStatus !== 'string' ||
          !VALID_ESTATE_STATUSES.has(body.estateAdministrationStatus))
      ) {
        return NextResponse.json(
          {
            error: `estateAdministrationStatus must be one of: ${[...VALID_ESTATE_STATUSES].join(', ')}`,
          },
          { status: 400 },
        );
      }
      if (
        body.partnershipSubtype !== undefined &&
        body.partnershipSubtype !== null &&
        body.partnershipSubtype !== '' &&
        (typeof body.partnershipSubtype !== 'string' ||
          !VALID_PARTNERSHIP_SUBTYPES.has(body.partnershipSubtype))
      ) {
        return NextResponse.json(
          {
            error: `partnershipSubtype must be one of: ${[...VALID_PARTNERSHIP_SUBTYPES].join(', ')}`,
          },
          { status: 400 },
        );
      }
      let dateOfBirthField: string | null | undefined;
      let vestingDateField: string | null | undefined;
      let deedDateField: string | null | undefined;
      try {
        dateOfBirthField = parseOptionalDateField(body.dateOfBirth, 'dateOfBirth');
        vestingDateField = parseOptionalDateField(body.vestingDate, 'vestingDate');
        deedDateField = parseOptionalDateField(body.deedDate, 'deedDate');
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Invalid date field.' },
          { status: 400 },
        );
      }

      // Build the partial-update input (preserve undefined for "leave alone").
      const updated = await updateEntity(auth.userId, id, {
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.type !== undefined && { type: body.type as LegalEntityType }),
        ...(body.role !== undefined && { role: body.role as LegalEntityRole }),
        ...(body.abn !== undefined && {
          abn: body.abn === null || body.abn === '' ? null : (body.abn as string),
        }),
        ...(body.acn !== undefined && {
          acn: body.acn === null || body.acn === '' ? null : (body.acn as string),
        }),
        ...(body.tfn !== undefined && {
          tfn: body.tfn === null || body.tfn === '' ? null : (body.tfn as string),
        }),
        ...(body.tradingName !== undefined && {
          tradingName:
            body.tradingName === null || body.tradingName === ''
              ? null
              : (body.tradingName as string),
        }),
        ...(body.establishedDate !== undefined && {
          establishedDate:
            body.establishedDate === null || body.establishedDate === ''
              ? null
              : (body.establishedDate as string),
        }),
        ...(body.parentEntityId !== undefined && {
          parentEntityId:
            body.parentEntityId === null || body.parentEntityId === ''
              ? null
              : (body.parentEntityId as string),
        }),
        // Phase 41E.3 — Measure 3 + 4 inputs. Validate against the
        // closed enums; reject anything else with 400.
        ...(body.trustType !== undefined && {
          trustType:
            body.trustType === null || body.trustType === ''
              ? null
              : (body.trustType as import('@prisma/client').TrustType),
        }),
        ...(body.isForeignResident !== undefined && {
          isForeignResident:
            body.isForeignResident === null ? null : Boolean(body.isForeignResident),
        }),
        // Phase 47 F1 — extended detail fields (partial-update semantics).
        ...(body.companySubtype !== undefined && {
          companySubtype:
            body.companySubtype === null || body.companySubtype === ''
              ? null
              : (body.companySubtype as CompanySubtype),
        }),
        ...(dateOfBirthField !== undefined && { dateOfBirth: dateOfBirthField }),
        ...(vestingDateField !== undefined && { vestingDate: vestingDateField }),
        ...(deedDateField !== undefined && { deedDate: deedDateField }),
        ...(body.estateAdministrationStatus !== undefined && {
          estateAdministrationStatus:
            body.estateAdministrationStatus === null || body.estateAdministrationStatus === ''
              ? null
              : (body.estateAdministrationStatus as string),
        }),
        ...(body.partnershipSubtype !== undefined && {
          partnershipSubtype:
            body.partnershipSubtype === null || body.partnershipSubtype === ''
              ? null
              : (body.partnershipSubtype as string),
        }),
      });

      logCRUD({
        userId: auth.userId,
        action: 'UPDATE',
        entityType: 'LegalEntity',
        entityId: updated.id,
        metadata: sanitizeCdrMetadata({
          name: updated.name,
          type: updated.type,
          role: updated.role,
          hasAbn: updated.abn != null,
          hasAcn: updated.acn != null,
          hasTfn: updated.hasTfn,
          hasParent: updated.parentEntityId != null,
          // Track which fields were touched (CDR-safe: just the keys, no values).
          fieldsChanged: Object.keys(body),
        }),
      }).catch(() => {});

      return NextResponse.json(updated);
    } catch (error) {
      console.error('Update entity error:', error);
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      const status =
        message.startsWith('Parent entity') || message.startsWith('An entity cannot')
          ? 400
          : 500;
      return NextResponse.json({ error: message }, { status });
    }
  },
);

export const DELETE = withPermission<RouteContext>(
  'entity.delete',
  async (_request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;

      // Pre-fetch the summary so we can include the friendly counts in
      // the 409 response payload if the guard fires.
      const entities = await listEntitiesForUser(auth.userId);
      const target = entities.find((e) => e.id === id);
      if (!target) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      // The user's PERSONAL_NAME entity is special — it's the default
      // owner for everything created without an explicit entity choice.
      // Removing it would leave new owned rows without a fallback. Block
      // the deletion of the LAST PERSONAL_NAME entity even if it has
      // zero owned objects.
      if (target.type === 'PERSONAL_NAME') {
        const personalCount = entities.filter((e) => e.type === 'PERSONAL_NAME').length;
        if (personalCount <= 1) {
          return NextResponse.json(
            {
              error:
                'Your personal-name entity is the default owner for new properties, accounts and other items. ' +
                'It cannot be removed.',
              code: 'LAST_PERSONAL_NAME',
            },
            { status: 409 },
          );
        }
      }

      try {
        await deleteEntity(auth.userId, id);
      } catch (error) {
        if (error instanceof EntityHasOwnedObjectsError) {
          return NextResponse.json(
            {
              error:
                `This entity owns ${error.counts.total} item${
                  error.counts.total === 1 ? '' : 's'
                }. Reassign or remove them first.`,
              code: 'ENTITY_HAS_OWNED_OBJECTS',
              counts: error.counts,
            },
            { status: 409 },
          );
        }
        throw error;
      }

      logCRUD({
        userId: auth.userId,
        action: 'DELETE',
        entityType: 'LegalEntity',
        entityId: id,
        metadata: sanitizeCdrMetadata({
          name: target.name,
          type: target.type,
          role: target.role,
        }),
      }).catch(() => {});

      return NextResponse.json({ message: 'Entity deleted.' });
    } catch (error) {
      console.error('Delete entity error:', error);
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
);
