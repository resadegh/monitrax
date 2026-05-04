/**
 * LegalEntity service — Phase 41a foundation.
 *
 * Single canonical source for "which `LegalEntity` should I attach this
 * thing to?" decisions. Every Property / Loan / Account / InvestmentAccount /
 * Asset / Income / Expense create call must supply an `ownerEntityId` (the
 * column is NOT NULL after the migration backfill). Until the Phase 41b
 * onboarding wizard ships and lets users explicitly pick, every new owned
 * row defaults to the user's `PERSONAL_NAME` entity — same shape the
 * migration backfilled existing rows to.
 *
 * `getDefaultLegalEntityId()` is the SSOT for that resolution. It returns
 * the user's existing `PERSONAL_NAME` entity, creating one if missing
 * (e.g. for a brand-new user who just registered post-migration).
 *
 * CLAUDE.md §12.2 SSOT: do NOT duplicate this lookup in route handlers or
 * components. Always import this helper.
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient } from '@prisma/client';

type PrismaTxOrClient =
  | PrismaClient
  | Prisma.TransactionClient;

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
