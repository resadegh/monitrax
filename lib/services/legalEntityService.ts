/**
 * LegalEntity service — Phase 41a foundation + Phase 41b extensions.
 *
 * Single canonical source for all `LegalEntity` reads/writes. Every owned
 * object (Property / Loan / Account / InvestmentAccount / Asset / Income /
 * Expense) hangs off `ownerEntityId`; the column is NOT NULL after the
 * migration backfill.
 *
 * 41a (shipped): `getDefaultLegalEntityId()` — returns the user's
 * PERSONAL_NAME entity, creating one on demand. Used by every owned-row
 * create call site.
 *
 * 41b (this PR): list / create / update / delete with the destructive-
 * removal guard. The wizard step + standalone `/dashboard/entities`
 * surface + `/api/entities` routes all import from here. CLAUDE.md §12.2
 * SSOT — never duplicate this lookup or write logic in route handlers.
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, LegalEntityType, LegalEntityRole, TrustType, CompanySubtype } from '@prisma/client';
import { encryptTfn } from '@/lib/security/tfnEncryption';
import { deriveTrustType, isTrustFamily, isCompanyFamily } from '@/lib/entities/entityTypeCatalog';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Phase 41e.0 — parentEntityId cycle-detection (audit doc §7)
// ---------------------------------------------------------------------------

/**
 * Maximum depth allowed for a `parentEntityId` chain. Per audit doc §7.2
 * Rule 3 — corporate trustee chains in practice are 1–2 levels deep;
 * trust-of-trust-of-trust is rare and 10 is a safety ceiling that
 * catches accidentally-built rabbit-hole structures.
 */
const PARENT_CHAIN_MAX_DEPTH = 10;

export type ParentChainValidationError =
  | 'SELF_PARENT'
  | 'CYCLE_DETECTED'
  | 'MAX_DEPTH_EXCEEDED'
  | 'PARENT_NOT_FOUND';

export type ParentChainValidationResult =
  | { ok: true }
  | { ok: false; code: ParentChainValidationError; message: string };

/**
 * Validate that setting `proposedParentId` as the parent of `entityId`
 * does not create a cycle, exceed depth, or self-reference.
 *
 * Per audit doc §7.2:
 *   Rule 1 — `entity.parentEntityId !== entity.id`.
 *   Rule 2 — walking the parent chain from `proposedParentId` upward
 *            never revisits `entityId` and never revisits any node
 *            (catches reparenting cycles where the proposed parent's
 *            chain already includes this entity downstream).
 *   Rule 3 — chain depth ≤ 10.
 *   Rule 4 — type-compatibility is advisory only and lives in route /
 *            wizard layer, NOT here (a structurally-cycle-free chain is
 *            the absolute floor; type rules are policy on top).
 *
 * Per audit doc §7.3 — MUST be called inside the same transaction as
 * the write to prevent TOCTOU races. Both `createEntity` and
 * `updateEntity` already do this via the `client` parameter.
 *
 * `entityId === null` ⇒ creating a new entity (no row to cycle to yet).
 */
export async function validateParentChain(
  entityId: string | null,
  proposedParentId: string | null,
  client: PrismaTxOrClient = prisma,
): Promise<ParentChainValidationResult> {
  if (proposedParentId === null) {
    return { ok: true };
  }

  // Rule 1 — self-parent forbidden.
  if (entityId !== null && entityId === proposedParentId) {
    return {
      ok: false,
      code: 'SELF_PARENT',
      message: 'An entity cannot be its own parent.',
    };
  }

  // Walk from `proposedParentId` upward toward the root.
  const visited = new Set<string>();
  let current: string | null = proposedParentId;
  let depth = 0;

  while (current !== null) {
    // Rule 3 — max depth.
    if (depth >= PARENT_CHAIN_MAX_DEPTH) {
      return {
        ok: false,
        code: 'MAX_DEPTH_EXCEEDED',
        message: `Parent chain exceeds the ${PARENT_CHAIN_MAX_DEPTH}-deep safety ceiling.`,
      };
    }

    // Rule 2 — cycle detection. Two flavours:
    //   (a) the chain visits the node we're trying to set the parent
    //       on (entityId) — that means proposedParent is downstream of
    //       this entity, so connecting them creates an immediate cycle.
    //   (b) the chain visits a node already seen this walk — that means
    //       the existing chain (independent of our proposed change) is
    //       already cyclic. Surface it now rather than infinite-loop.
    if (entityId !== null && current === entityId) {
      return {
        ok: false,
        code: 'CYCLE_DETECTED',
        message: 'Setting this parent would create a cycle in the entity chain.',
      };
    }
    if (visited.has(current)) {
      return {
        ok: false,
        code: 'CYCLE_DETECTED',
        message: 'Existing parent chain is already cyclic — fix upstream before re-parenting.',
      };
    }
    visited.add(current);

    // Step up one level. Explicit type annotation because the
    // `PrismaTxOrClient` union confuses TS' inference here.
    const parent: { parentEntityId: string | null } | null =
      await client.legalEntity.findUnique({
        where: { id: current },
        select: { parentEntityId: true },
      });

    if (!parent) {
      return {
        ok: false,
        code: 'PARENT_NOT_FOUND',
        message: 'Parent entity not found while walking the chain.',
      };
    }

    current = parent.parentEntityId;
    depth++;
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Default entity (Phase 41a)
// ---------------------------------------------------------------------------

/**
 * Resolve the user's default `LegalEntity` id.
 *
 * Returns the user's `PERSONAL_NAME` entity. Creates it on demand if the
 * user doesn't have one yet (new registrations between Phase 41a deploy
 * and Phase 41b wizard ship). Re-uses an existing one if present
 * (idempotent — safe to call from any create path).
 *
 * Pass a transaction client when calling from inside `prisma.$transaction`
 * so the entity creation is part of the same atomic write.
 */
export async function getDefaultLegalEntityId(
  userId: string,
  client: PrismaTxOrClient = prisma,
): Promise<string> {
  const existing = await client.legalEntity.findFirst({
    where: { userId, type: 'PERSONAL_NAME' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) return existing.id;

  // Look up the user to name the new entity sensibly. If the user row
  // doesn't exist (caller bug), Prisma will throw at the create() below
  // anyway — let it fail loudly rather than masking with a generic name.
  const user = await client.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true },
  });

  const created = await client.legalEntity.create({
    data: {
      userId,
      name: user.name,
      type: 'PERSONAL_NAME',
      role: 'PERSONAL',
    },
    select: { id: true },
  });

  return created.id;
}

// ---------------------------------------------------------------------------
// Phase 41b — list / create / update / delete
// ---------------------------------------------------------------------------

/**
 * Shape returned to UI consumers. NEVER includes `tfnEncrypted` — the
 * value is read separately through a dedicated authorisation boundary if
 * required (for the demo it's never needed; the wizard captures TFN on
 * write only).
 *
 * `ownedObjectsCount` is the aggregate of every owned-row table — surfaces
 * the destructive-remove guard's reasoning to the UI ("Remove Family
 * Trust — owns 3 properties, 2 loans, 1 account").
 */
export interface LegalEntitySummary {
  id: string;
  userId: string;
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  abn: string | null;
  acn: string | null;
  hasTfn: boolean;          // boolean only — value never returned by default
  tradingName: string | null;
  establishedDate: Date | null;
  parentEntityId: string | null;
  parentEntityName: string | null;
  // Phase 41E.4 — reform-aware fields. Both nullable; the entity
  // edit UI reads these to pre-populate the trustType selector +
  // foreign-resident toggle.
  trustType: TrustType | null;
  isForeignResident: boolean | null;
  // Phase 47 F1 — extended-grammar detail fields (all nullable; only
  // set for the types they apply to — see entityTypeCatalog).
  companySubtype: CompanySubtype | null;
  dateOfBirth: Date | null;
  vestingDate: Date | null;
  deedDate: Date | null;
  estateAdministrationStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  ownedObjectsCount: {
    properties: number;
    loans: number;
    accounts: number;
    investmentAccounts: number;
    assets: number;
    incomes: number;
    expenses: number;
    total: number;
  };
}

/**
 * List all `LegalEntity` rows for a user, with their owned-objects
 * counts. Sorted by created date (PERSONAL_NAME first by virtue of being
 * created at registration / backfill).
 */
export async function listEntitiesForUser(
  userId: string,
  client: PrismaTxOrClient = prisma,
): Promise<LegalEntitySummary[]> {
  const entities = await client.legalEntity.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      userId: true,
      name: true,
      type: true,
      role: true,
      abn: true,
      acn: true,
      tfnEncrypted: true,
      tradingName: true,
      establishedDate: true,
      parentEntityId: true,
      parentEntity: { select: { name: true } },
      // Phase 41E.4 — surface reform-aware fields so the entity edit
      // form can show the user's current trustType + isForeignResident.
      trustType: true,
      isForeignResident: true,
      // Phase 47 F1 — extended-grammar detail fields.
      companySubtype: true,
      dateOfBirth: true,
      vestingDate: true,
      deedDate: true,
      estateAdministrationStatus: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          properties: true,
          loans: true,
          accounts: true,
          investmentAccounts: true,
          assets: true,
          incomes: true,
          expenses: true,
        },
      },
    },
  });

  return entities.map((e) => ({
    id: e.id,
    userId: e.userId,
    name: e.name,
    type: e.type,
    role: e.role,
    abn: e.abn,
    acn: e.acn,
    hasTfn: e.tfnEncrypted != null && e.tfnEncrypted.length > 0,
    tradingName: e.tradingName,
    establishedDate: e.establishedDate,
    parentEntityId: e.parentEntityId,
    parentEntityName: e.parentEntity?.name ?? null,
    // Phase 41E.4 — surface reform fields on the summary.
    trustType: e.trustType,
    isForeignResident: e.isForeignResident,
    // Phase 47 F1 — extended-grammar detail fields.
    companySubtype: e.companySubtype,
    dateOfBirth: e.dateOfBirth,
    vestingDate: e.vestingDate,
    deedDate: e.deedDate,
    estateAdministrationStatus: e.estateAdministrationStatus,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    ownedObjectsCount: {
      properties: e._count.properties,
      loans: e._count.loans,
      accounts: e._count.accounts,
      investmentAccounts: e._count.investmentAccounts,
      assets: e._count.assets,
      incomes: e._count.incomes,
      expenses: e._count.expenses,
      total:
        e._count.properties +
        e._count.loans +
        e._count.accounts +
        e._count.investmentAccounts +
        e._count.assets +
        e._count.incomes +
        e._count.expenses,
    },
  }));
}

export interface CreateEntityInput {
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  abn?: string | null;
  acn?: string | null;
  tfn?: string | null;            // raw TFN; encrypted before persistence
  tradingName?: string | null;
  establishedDate?: Date | string | null;
  parentEntityId?: string | null;
  /**
   * Phase 12 Track G.3a — reform-aware inputs, so the onboarding wizard's
   * entities step (`entitiesSync.ts`) can create a trust WITH its
   * `trustType` in one call. Mirrors `UpdateEntityInput`.
   */
  trustType?: TrustType | null;
  isForeignResident?: boolean | null;
  /**
   * Phase 47 F1 — extended-grammar detail fields. Each is persisted
   * only for the entity types it applies to (entityTypeCatalog gating);
   * values supplied for non-applicable types are dropped to null.
   */
  companySubtype?: CompanySubtype | null;
  dateOfBirth?: Date | string | null;
  vestingDate?: Date | string | null;
  deedDate?: Date | string | null;
  estateAdministrationStatus?: string | null;
}

/**
 * Create a new `LegalEntity` for a user. TFN (if supplied) is encrypted
 * via `lib/security/tfnEncryption.ts` before persistence. Validates the
 * parent-entity link belongs to the same user (defensive — the API
 * already gates this but the service is the SSOT).
 */
export async function createEntity(
  userId: string,
  input: CreateEntityInput,
  client: PrismaTxOrClient = prisma,
): Promise<LegalEntitySummary> {
  if (input.parentEntityId) {
    const parent = await client.legalEntity.findUnique({
      where: { id: input.parentEntityId },
      select: { userId: true },
    });
    if (!parent || parent.userId !== userId) {
      throw new Error('Parent entity not found or not owned by this user.');
    }
    // Phase 41e.0 (audit §7) — cycle-detection inside the same client/tx.
    // entityId is `null` here because we haven't created the row yet; the
    // walker only checks that the proposed parent's chain is internally
    // consistent and within depth.
    const chainCheck = await validateParentChain(null, input.parentEntityId, client);
    if (!chainCheck.ok) {
      throw new Error(chainCheck.message);
    }
  }

  const created = await client.legalEntity.create({
    data: {
      userId,
      name: input.name.trim(),
      type: input.type,
      role: input.role,
      abn: input.abn?.replace(/\D+/g, '') || null,
      acn: input.acn?.replace(/\D+/g, '') || null,
      tfnEncrypted: encryptTfn(input.tfn ?? null),
      tradingName: input.tradingName?.trim() || null,
      establishedDate:
        input.establishedDate ? new Date(input.establishedDate) : null,
      parentEntityId: input.parentEntityId ?? null,
      // Phase 12 Track G.3a + Phase 47 F1 — trustType persists for the
      // whole trust family. When not supplied, auto-derive from the
      // entity type so Phase 41E Measure-3 dispatch stays correct by
      // construction (§12.14 — FIXED/HYBRID/TESTAMENTARY/BARE map to
      // their correctly-EXCLUDED subtypes; only DISCRETIONARY is
      // reform-affected).
      trustType: isTrustFamily(input.type)
        ? (input.trustType ?? deriveTrustType(input.type))
        : null,
      isForeignResident: input.isForeignResident ?? false,
      // Phase 47 F1 — extended-grammar detail fields, gated per type.
      companySubtype: isCompanyFamily(input.type) ? (input.companySubtype ?? null) : null,
      dateOfBirth:
        (input.type === 'INDIVIDUAL' || input.type === 'PERSONAL_NAME') && input.dateOfBirth
          ? new Date(input.dateOfBirth)
          : null,
      vestingDate:
        isTrustFamily(input.type) && input.vestingDate ? new Date(input.vestingDate) : null,
      deedDate: isTrustFamily(input.type) && input.deedDate ? new Date(input.deedDate) : null,
      estateAdministrationStatus:
        input.type === 'DECEASED_ESTATE' ? (input.estateAdministrationStatus ?? null) : null,
    },
    select: { id: true },
  });

  // Re-fetch via the canonical list query so the summary shape matches.
  const summaries = await listEntitiesForUser(userId, client);
  const summary = summaries.find((s) => s.id === created.id);
  if (!summary) {
    throw new Error('LegalEntity created but failed to re-fetch summary.');
  }
  return summary;
}

export interface UpdateEntityInput {
  name?: string;
  type?: LegalEntityType;
  role?: LegalEntityRole;
  abn?: string | null;
  acn?: string | null;
  tfn?: string | null;            // raw; pass null to clear, undefined to leave untouched
  tradingName?: string | null;
  establishedDate?: Date | string | null;
  parentEntityId?: string | null;
  /**
   * Phase 41E.3 — Measure 3 dispatch input. Only DISCRETIONARY trusts
   * are subject to the 30% min tax from FY 2028-29. Pass null to clear,
   * undefined to leave untouched. See PHASE_41E_REFORM_2026_27.md §4.2 + §10.3.
   */
  trustType?: TrustType | null;
  /**
   * Phase 41E.3 — Measure 4 dispatch input. Drives Div 855 TARP + 365-day
   * PAT applicability. Pass null to clear, undefined to leave untouched.
   * See PHASE_41E_REFORM_2026_27.md §4.2 + §10.4.
   */
  isForeignResident?: boolean | null;
  /** Phase 47 F1 — extended-grammar detail fields (partial-update semantics). */
  companySubtype?: CompanySubtype | null;
  dateOfBirth?: Date | string | null;
  vestingDate?: Date | string | null;
  deedDate?: Date | string | null;
  estateAdministrationStatus?: string | null;
}

/**
 * Update a `LegalEntity`. Only the supplied fields are changed (Prisma
 * partial-update semantics).
 *
 * §12.11 destructive-write guarded — the `where: { id, userId }` filter
 * ensures we only update an entity owned by the calling user. The route
 * handler also pre-checks ownership; this is defence-in-depth.
 *
 * `tfn`: pass `undefined` to leave the existing tfnEncrypted value
 * untouched; pass `null` to clear it; pass a string to set a new one.
 */
export async function updateEntity(
  userId: string,
  entityId: string,
  input: UpdateEntityInput,
  client: PrismaTxOrClient = prisma,
): Promise<LegalEntitySummary> {
  if (input.parentEntityId !== undefined && input.parentEntityId !== null) {
    const parent = await client.legalEntity.findUnique({
      where: { id: input.parentEntityId },
      select: { userId: true },
    });
    if (!parent || parent.userId !== userId) {
      throw new Error('Parent entity not found or not owned by this user.');
    }
    // Phase 41e.0 (audit §7) — cycle-detection. Subsumes the old
    // self-parent check (Rule 1) and adds chain-cycle + max-depth.
    const chainCheck = await validateParentChain(entityId, input.parentEntityId, client);
    if (!chainCheck.ok) {
      throw new Error(chainCheck.message);
    }
  }

  const data: Prisma.LegalEntityUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.type !== undefined) data.type = input.type;
  if (input.role !== undefined) data.role = input.role;
  if (input.abn !== undefined) data.abn = input.abn?.replace(/\D+/g, '') || null;
  if (input.acn !== undefined) data.acn = input.acn?.replace(/\D+/g, '') || null;
  if (input.tradingName !== undefined) {
    data.tradingName = input.tradingName?.trim() || null;
  }
  if (input.establishedDate !== undefined) {
    data.establishedDate = input.establishedDate ? new Date(input.establishedDate) : null;
  }
  if (input.parentEntityId !== undefined) {
    data.parentEntity = input.parentEntityId
      ? { connect: { id: input.parentEntityId } }
      : { disconnect: true };
  }
  if (input.tfn !== undefined) {
    data.tfnEncrypted = encryptTfn(input.tfn);
  }
  // Phase 41E.3 — Measure 3 + Measure 4 inputs. Nullable + additive;
  // safe to update through this path because the columns are owned by
  // the user-confirmation flow (not the engine).
  if (input.trustType !== undefined) {
    data.trustType = input.trustType;
  }
  if (input.isForeignResident !== undefined) {
    data.isForeignResident = input.isForeignResident;
  }
  // Phase 47 F1 — extended-grammar detail fields (partial-update).
  if (input.companySubtype !== undefined) data.companySubtype = input.companySubtype;
  if (input.dateOfBirth !== undefined) {
    data.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  }
  if (input.vestingDate !== undefined) {
    data.vestingDate = input.vestingDate ? new Date(input.vestingDate) : null;
  }
  if (input.deedDate !== undefined) {
    data.deedDate = input.deedDate ? new Date(input.deedDate) : null;
  }
  if (input.estateAdministrationStatus !== undefined) {
    data.estateAdministrationStatus = input.estateAdministrationStatus;
  }

  await client.legalEntity.update({
    where: { id: entityId, userId },   // §12.11 guarded by composite filter
    data,
  });

  const summaries = await listEntitiesForUser(userId, client);
  const summary = summaries.find((s) => s.id === entityId);
  if (!summary) {
    throw new Error('LegalEntity updated but failed to re-fetch summary.');
  }
  return summary;
}

export class EntityHasOwnedObjectsError extends Error {
  constructor(
    public readonly entityId: string,
    public readonly counts: LegalEntitySummary['ownedObjectsCount'],
  ) {
    super(
      `LegalEntity ${entityId} has ${counts.total} owned objects (` +
        `properties=${counts.properties}, loans=${counts.loans}, ` +
        `accounts=${counts.accounts}, investments=${counts.investmentAccounts}, ` +
        `assets=${counts.assets}, incomes=${counts.incomes}, expenses=${counts.expenses})` +
        `. Reassign or delete those rows first.`,
    );
    this.name = 'EntityHasOwnedObjectsError';
  }
}

/**
 * Delete a `LegalEntity`. Hard guard: throws `EntityHasOwnedObjectsError`
 * if the entity has any owned rows. The DB FK is `ON DELETE RESTRICT`
 * (Phase 41a migration §5) so the underlying `prisma.delete` would fail
 * anyway — this guard surfaces a structured error the UI can render
 * helpfully ("Reassign 3 properties first") rather than a raw Prisma
 * P2003 foreign-key violation.
 *
 * §12.11: composite `where: { id, userId }` prevents cross-user
 * deletion; the count-check prevents silent data loss.
 */
export async function deleteEntity(
  userId: string,
  entityId: string,
  client: PrismaTxOrClient = prisma,
): Promise<void> {
  const summaries = await listEntitiesForUser(userId, client);
  const summary = summaries.find((s) => s.id === entityId);
  if (!summary) {
    throw new Error('LegalEntity not found or not owned by this user.');
  }
  if (summary.ownedObjectsCount.total > 0) {
    throw new EntityHasOwnedObjectsError(entityId, summary.ownedObjectsCount);
  }
  await client.legalEntity.delete({
    where: { id: entityId, userId },
  });
}

/**
 * Phase 44 Part 1c (Q4) — flip an entity's `accountantVerified` flag.
 *
 * The accountant-review share-pass (PHASE_44_ENTITY_GRAPH.md §9) turns
 * this provenance flag into a professional sign-off: the user hands
 * their accountant the structure report, the accountant confirms the
 * entity is recorded correctly, the user marks it verified.
 *
 * Returns `false` if the entity is not found / not owned by the caller.
 * The route layer audits the change (this file's convention — route
 * handlers own the audit log for LegalEntity writes).
 *
 * §12.11: composite `where: { id, userId }` confines the write to the
 * caller's own entity; `accountantVerified` is a provenance flag owned
 * exclusively by this code path, never user-entered financial data.
 */
export async function setEntityAccountantVerified(
  userId: string,
  entityId: string,
  verified: boolean,
  client: PrismaTxOrClient = prisma,
): Promise<boolean> {
  const existing = await client.legalEntity.findFirst({
    where: { id: entityId, userId },
    select: { id: true },
  });
  if (!existing) return false;
  await client.legalEntity.update({
    where: { id: entityId, userId },
    data: { accountantVerified: verified },
  });
  return true;
}
