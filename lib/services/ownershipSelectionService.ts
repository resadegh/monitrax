/**
 * Ownership selection — Phase 47 Stage A (Entity Ownership Fabric).
 *
 * Canonical translation layer between the OwnershipPicker UI ("Just me /
 * Joint / Shared / An entity" — §4A personal-tier completeness matrix in
 * PHASE_47_ENTITY_OWNERSHIP_FABRIC.md) and the Phase 44 ownership models:
 *
 *   - 'sole'   → ownerEntityId = the user's PERSONAL_NAME entity (P1)
 *   - 'entity' → ownerEntityId = a validated entity of the user's (trust /
 *                company / SMSF)
 *   - 'joint'  → ownerEntityId stays personal (primary legal-title holder)
 *                + an OwnershipGroup(JOINT_TENANTS) with equal stakes and
 *                survivorship (P2 — ATO TR 93/32: income splits follow the
 *                names on the title, 50/50, regardless of contribution)
 *   - 'shared' → same, but TENANTS_IN_COMMON with explicit sharePct (P3)
 *
 * Co-owners who aren't yet modelled are created as INDIVIDUAL LegalEntity
 * rows (role PERSONAL) — the §4A P2/P3 quick-create path. This service is
 * the ONLY writer for picker-driven ownership; routes stay thin (§12.3).
 *
 * Sequencing note: the owned object is created first, then the group. If
 * the group write fails the object remains soly-owned — recoverable, and
 * surfaced to the caller via the thrown error. No partial groups are
 * possible (`createOwnershipGroup` is atomic internally).
 *
 * Design SoT: Stitch screen `8e6fc018886e4d54b18abff0f7c80c13`
 * (`.stitch/designs/phase47/ownership-picker-property-joint-v2.{html,png}`).
 */

import { prisma } from '@/lib/db';
import { createEntity, getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import {
  createOwnershipGroup,
  deleteOwnershipGroup,
  listOwnershipGroups,
  type OwnershipStakeInput,
} from '@/lib/services/ownershipService';
import { createAuditLog } from '@/lib/security/auditLog';

// ---------------------------------------------------------------------------
// Types + pure parsing/validation (unit-tested)
// ---------------------------------------------------------------------------

export interface CoOwnerInput {
  /** An existing LegalEntity id (must belong to the user), OR… */
  entityId?: string;
  /** …a display name — an INDIVIDUAL entity is quick-created for them. */
  name?: string;
}

export interface SharedOwnerInput extends CoOwnerInput {
  /** Percentage share of legal title (TIC). 0 < pct ≤ 100. */
  sharePct: number;
  /** True for the user's own stake ("You"). */
  isSelf?: boolean;
}

export type OwnershipSelection =
  | { mode: 'sole' }
  | { mode: 'entity'; entityId: string }
  | { mode: 'joint'; coOwners: CoOwnerInput[] }
  | { mode: 'shared'; owners: SharedOwnerInput[] };

export class OwnershipSelectionError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_SELECTION'
      | 'ENTITY_NOT_FOUND'
      | 'CO_OWNER_INVALID'
      | 'SHARES_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'OwnershipSelectionError';
  }
}

/** Tolerance mirroring ownershipService's TIC share-sum check. */
const SHARE_SUM_TOLERANCE = 0.5;

function isCoOwnerShape(v: unknown): v is { entityId?: unknown; name?: unknown } {
  return typeof v === 'object' && v !== null;
}

function parseCoOwner(raw: unknown): CoOwnerInput {
  if (!isCoOwnerShape(raw)) {
    throw new OwnershipSelectionError('CO_OWNER_INVALID', 'Each co-owner must be an object.');
  }
  const entityId = typeof raw.entityId === 'string' && raw.entityId.trim() ? raw.entityId : undefined;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : undefined;
  if (!entityId && !name) {
    throw new OwnershipSelectionError(
      'CO_OWNER_INVALID',
      'Each co-owner needs an entityId or a name.',
    );
  }
  return { entityId, name };
}

/**
 * Parse + validate an untrusted `ownership` request payload into a typed
 * selection. Returns null when the payload is absent (callers default to
 * sole — the zero-friction path stays untouched). Throws
 * `OwnershipSelectionError` on malformed payloads.
 */
export function parseOwnershipSelection(raw: unknown): OwnershipSelection | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'object') {
    throw new OwnershipSelectionError('INVALID_SELECTION', 'ownership must be an object.');
  }
  const body = raw as Record<string, unknown>;
  switch (body.mode) {
    case 'sole':
      return { mode: 'sole' };
    case 'entity': {
      if (typeof body.entityId !== 'string' || !body.entityId.trim()) {
        throw new OwnershipSelectionError(
          'INVALID_SELECTION',
          "ownership.entityId is required when mode is 'entity'.",
        );
      }
      return { mode: 'entity', entityId: body.entityId };
    }
    case 'joint': {
      const rawCoOwners = Array.isArray(body.coOwners) ? body.coOwners : [];
      if (rawCoOwners.length < 1) {
        throw new OwnershipSelectionError(
          'INVALID_SELECTION',
          'Joint ownership needs at least one co-owner.',
        );
      }
      return { mode: 'joint', coOwners: rawCoOwners.map(parseCoOwner) };
    }
    case 'shared': {
      const rawOwners = Array.isArray(body.owners) ? body.owners : [];
      if (rawOwners.length < 2) {
        throw new OwnershipSelectionError(
          'INVALID_SELECTION',
          'Shared ownership needs at least two owners (including you).',
        );
      }
      const owners: SharedOwnerInput[] = rawOwners.map(o => {
        const base = isCoOwnerShape(o) && o !== null && (o as Record<string, unknown>).isSelf === true
          ? {} // self stake doesn't need entityId/name — resolved to the personal entity
          : parseCoOwner(o);
        const rec = o as Record<string, unknown>;
        const sharePct = typeof rec.sharePct === 'number' ? rec.sharePct : NaN;
        if (!isFinite(sharePct) || sharePct <= 0 || sharePct > 100) {
          throw new OwnershipSelectionError(
            'SHARES_INVALID',
            'Each share must be a percentage between 0 and 100.',
          );
        }
        return { ...base, sharePct, isSelf: rec.isSelf === true };
      });
      if (!owners.some(o => o.isSelf)) {
        throw new OwnershipSelectionError(
          'SHARES_INVALID',
          'Shared ownership must include your own stake.',
        );
      }
      const sum = owners.reduce((s, o) => s + o.sharePct, 0);
      if (Math.abs(sum - 100) > SHARE_SUM_TOLERANCE) {
        throw new OwnershipSelectionError(
          'SHARES_INVALID',
          `Shares must total 100% — they currently total ${sum}%.`,
        );
      }
      return { mode: 'shared', owners };
    }
    default:
      throw new OwnershipSelectionError(
        'INVALID_SELECTION',
        "ownership.mode must be one of: sole, joint, shared, entity.",
      );
  }
}

/**
 * Build the OwnershipStake inputs for a selection once every owner has a
 * resolved entityId. Pure (unit-tested). Joint = equal undivided shares +
 * survivorship (P2); Shared = explicit fractions, no survivorship (P3).
 */
export function buildStakes(
  selection: Extract<OwnershipSelection, { mode: 'joint' | 'shared' }>,
  selfEntityId: string,
  resolvedCoOwnerIds: string[],
): OwnershipStakeInput[] {
  if (selection.mode === 'joint') {
    const all = [selfEntityId, ...resolvedCoOwnerIds];
    // Equal undivided shares — sharePct is reporting-only for JT, but we
    // record the even split so income attribution reads it directly.
    const evenPct = Math.round((100 / all.length) * 100) / 100;
    return all.map(entityId => ({
      entityId,
      sharePct: evenPct,
      survivorshipApplies: true,
    }));
  }
  let coIdx = 0;
  return selection.owners.map(o => ({
    entityId: o.isSelf ? selfEntityId : resolvedCoOwnerIds[coIdx++],
    sharePct: o.sharePct,
    survivorshipApplies: false,
  }));
}

// ---------------------------------------------------------------------------
// Orchestration (DB-touching)
// ---------------------------------------------------------------------------

/**
 * Resolve the `ownerEntityId` to stamp on the object being created.
 * 'entity' mode validates the entity belongs to the user; every other
 * mode keeps the personal default (joint/shared record the co-ownership
 * via the OwnershipGroup, with the user as primary legal-title holder).
 */
export async function resolveOwnerEntityIdForSelection(
  userId: string,
  selection: OwnershipSelection | null,
): Promise<string> {
  if (selection?.mode === 'entity') {
    const entity = await prisma.legalEntity.findFirst({
      where: { id: selection.entityId, userId },
      select: { id: true },
    });
    if (!entity) {
      throw new OwnershipSelectionError(
        'ENTITY_NOT_FOUND',
        'The selected owner entity was not found.',
      );
    }
    return entity.id;
  }
  return getDefaultLegalEntityId(userId);
}

/**
 * Route-facing convenience: parse the raw `ownership` payload AND resolve
 * the ownerEntityId in one call. Throws `OwnershipSelectionError` (routes
 * map it to 400/404). Keeps the create routes uniform across the six
 * object types (§12.3 thin handlers).
 */
export async function resolveOwnershipForCreate(
  userId: string,
  rawOwnership: unknown,
): Promise<{ selection: OwnershipSelection | null; ownerEntityId: string }> {
  const selection = parseOwnershipSelection(rawOwnership);
  const ownerEntityId = await resolveOwnerEntityIdForSelection(userId, selection);
  return { selection, ownerEntityId };
}

/**
 * Apply a joint/shared selection to a just-created owned object: resolve
 * co-owners (validating existing entity ids; quick-creating INDIVIDUAL
 * entities for named people), then create the OwnershipGroup + stakes.
 * No-op for sole/entity modes.
 */
export async function applyOwnershipSelection(
  userId: string,
  ownedObjectType: 'property' | 'loan' | 'account' | 'investmentAccount' | 'asset',
  ownedObjectId: string,
  selection: OwnershipSelection | null,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<{ groupId: string; warnings: string[] } | null> {
  if (!selection || selection.mode === 'sole' || selection.mode === 'entity') return null;

  const selfEntityId = await getDefaultLegalEntityId(userId);
  const coOwners = selection.mode === 'joint'
    ? selection.coOwners
    : selection.owners.filter(o => !o.isSelf);

  const resolvedCoOwnerIds: string[] = [];
  for (const co of coOwners) {
    if (co.entityId) {
      const entity = await prisma.legalEntity.findFirst({
        where: { id: co.entityId, userId },
        select: { id: true },
      });
      if (!entity) {
        throw new OwnershipSelectionError(
          'CO_OWNER_INVALID',
          'A selected co-owner was not found.',
        );
      }
      resolvedCoOwnerIds.push(entity.id);
    } else {
      // §4A quick-create: a person who co-owns with the user but has no
      // structure of their own — an INDIVIDUAL entity, role PERSONAL.
      // DEDUP: the same person co-owning a second asset must resolve to
      // the SAME entity — otherwise the universe grows duplicate "Sarah"
      // tiles and her ownership fragments. Case-insensitive name match
      // against the user's existing INDIVIDUAL entities first.
      const existing = await prisma.legalEntity.findFirst({
        where: {
          userId,
          type: 'INDIVIDUAL',
          name: { equals: co.name!, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) {
        resolvedCoOwnerIds.push(existing.id);
      } else {
        const created = await createEntity(userId, {
          name: co.name!,
          type: 'INDIVIDUAL',
          role: 'PERSONAL',
        });
        resolvedCoOwnerIds.push(created.id);
      }
    }
  }

  const stakes = buildStakes(selection, selfEntityId, resolvedCoOwnerIds);
  const result = await createOwnershipGroup(
    userId,
    {
      ownedObjectType,
      ownedObjectId,
      tenancyType: selection.mode === 'joint' ? 'JOINT_TENANTS' : 'TENANTS_IN_COMMON',
      stakes,
    },
    requestMeta,
  );
  return { groupId: result.ownershipGroupId, warnings: result.warnings ?? [] };
}

// ---------------------------------------------------------------------------
// Stage A2 — "Correct ownership record" (Q-EOF-1: correction, NEVER transfer)
// ---------------------------------------------------------------------------

export type OwnedObjectType = 'property' | 'loan' | 'account' | 'investmentAccount' | 'asset';

const OWNED_OBJECT_TYPES: ReadonlySet<string> = new Set([
  'property',
  'loan',
  'account',
  'investmentAccount',
  'asset',
]);

export function isOwnedObjectType(v: unknown): v is OwnedObjectType {
  return typeof v === 'string' && OWNED_OBJECT_TYPES.has(v);
}

/** Verify the owned object exists + belongs to the user; return its current owner. */
async function findOwnedObject(
  userId: string,
  objectType: OwnedObjectType,
  objectId: string,
): Promise<{ ownerEntityId: string | null } | null> {
  const where = { id: objectId, userId };
  const select = { ownerEntityId: true };
  switch (objectType) {
    case 'property':
      return prisma.property.findFirst({ where, select });
    case 'loan':
      return prisma.loan.findFirst({ where, select });
    case 'account':
      return prisma.account.findFirst({ where, select });
    case 'investmentAccount':
      return prisma.investmentAccount.findFirst({ where, select });
    case 'asset':
      return prisma.asset.findFirst({ where, select });
  }
}

/**
 * Correct the ownership record of an existing owned object (Stage A2).
 *
 * Semantics (Q-EOF-1, decided 2026-06-10): this CORRECTS a wrong record —
 * "this owner was always on the title; I entered it wrong." It is NEVER a
 * transfer affordance (a real transfer is a disposal + acquisition with
 * CGT/duty consequences — out of scope by design; the UI carries the
 * warning verbatim).
 *
 * §12.11 destructive-write discipline:
 *   - `ownerEntityId` update: `where { id, userId }` composite confines
 *     the write to the caller's own row; the ONLY column touched is
 *     `ownerEntityId` (an attribution pointer, not user-entered financial
 *     data).
 *   - Existing OwnershipGroups for the object are hard-deleted via
 *     `deleteOwnershipGroup` (its documented "mistaken entry" semantic) —
 *     each delete is ownership-verified inside the canonical service.
 *   - Every correction is audit-logged as OWNERSHIP_RECORD_CORRECTED with
 *     the user's reason (truncated; no financial values — §13.3).
 */
export async function correctOwnershipRecord(
  userId: string,
  objectType: OwnedObjectType,
  objectId: string,
  selection: OwnershipSelection,
  reason: string,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<{ warnings: string[] }> {
  const existing = await findOwnedObject(userId, objectType, objectId);
  if (!existing) {
    throw new OwnershipSelectionError('ENTITY_NOT_FOUND', 'Item not found.');
  }

  const newOwnerEntityId = await resolveOwnerEntityIdForSelection(userId, selection);

  // 1) Re-point legal title if it changed.
  if (existing.ownerEntityId !== newOwnerEntityId) {
    const where = { id: objectId, userId };
    const data = { ownerEntityId: newOwnerEntityId };
    switch (objectType) {
      case 'property':
        await prisma.property.update({ where, data });
        break;
      case 'loan':
        await prisma.loan.update({ where, data });
        break;
      case 'account':
        await prisma.account.update({ where, data });
        break;
      case 'investmentAccount':
        await prisma.investmentAccount.update({ where, data });
        break;
      case 'asset':
        await prisma.asset.update({ where, data });
        break;
    }
  }

  // 2) Replace any existing co-ownership record (the old record was wrong).
  const groups = await listOwnershipGroups(userId, {
    ownedObjectType: objectType,
    ownedObjectId: objectId,
  });
  for (const g of groups) {
    await deleteOwnershipGroup(userId, g.id, requestMeta);
  }

  // 3) Record the corrected co-ownership, if any.
  let warnings: string[] = [];
  if (selection.mode === 'joint' || selection.mode === 'shared') {
    const applied = await applyOwnershipSelection(
      userId,
      objectType,
      objectId,
      selection,
      requestMeta,
    );
    warnings = applied?.warnings ?? [];
  }

  void createAuditLog({
    userId,
    action: 'OWNERSHIP_RECORD_CORRECTED',
    status: 'SUCCESS',
    entityType: objectType,
    entityId: objectId,
    metadata: {
      mode: selection.mode,
      reason: reason.slice(0, 300),
      previousOwnerEntityId: existing.ownerEntityId,
      newOwnerEntityId,
    },
    ...requestMeta,
  }).catch(() => {});

  return { warnings };
}
