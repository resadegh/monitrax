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
import type { Prisma, PrismaClient, LegalEntityType, LegalEntityRole } from '@prisma/client';
import { encryptTfn } from '@/lib/security/tfnEncryption';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

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
    if (input.parentEntityId === entityId) {
      throw new Error('An entity cannot be its own parent.');
    }
    const parent = await client.legalEntity.findUnique({
      where: { id: input.parentEntityId },
      select: { userId: true },
    });
    if (!parent || parent.userId !== userId) {
      throw new Error('Parent entity not found or not owned by this user.');
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
