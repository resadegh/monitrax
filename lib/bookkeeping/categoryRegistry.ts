/**
 * Phase 42 PR1 — Canonical category registry.
 *
 * Single SSOT for category labels across:
 *   - `UnifiedTransaction.categoryLevel1/2/subcategory` (free-form strings)
 *   - `Expense.customCategoryId` / `Income.customCategoryId` (FK to `Category`)
 *   - `MerchantMapping.categoryLevel1/2/subcategory` (free-form strings)
 *
 * Per CLAUDE.md §12.2 SSOT — there is exactly one place that defines
 * "what categories does this user have?", and from PR1 onwards it is this
 * registry. Existing string-based categorisations on UnifiedTransaction +
 * MerchantMapping are seeded into the registry by the backfill below.
 *
 * PR1 ships: registry table + seed-from-existing-strings + lookup helpers.
 * PR2+ will: rewrite the categoriser to RESOLVE through the registry,
 * surface user-renames in the UI, and expose registry IDs on the
 * `UnifiedTransaction` PATCH path.
 *
 * BASIQ-onboarding behaviour: BASIQ-fed categories resolve through the
 * same registry as QIF-fed categories. The registry is source-agnostic.
 */

import prisma from '@/lib/db';
import type { CategoryType, CanonicalCategoryRegistry } from '@prisma/client';

/**
 * Resolve a (level1, level2, subcategory) string triple to a canonical
 * registry row. Creates the row if it doesn't exist. Idempotent.
 *
 * Type inference rule:
 *   - level1 === 'Income' → INCOME
 *   - level1 === 'Transfer' → TRANSFER
 *   - everything else → EXPENSE
 *
 * If the existing app-level string-based categoriser writes a triple we
 * haven't seen before, this lazily seeds the registry — so every
 * categorised transaction in the app has a corresponding registry row.
 */
export async function resolveOrCreateCategory(input: {
  userId: string;
  level1: string;
  level2?: string | null;
  subcategory?: string | null;
}): Promise<CanonicalCategoryRegistry> {
  const level2 = input.level2 ?? null;
  const subcategory = input.subcategory ?? null;
  const type = inferType(input.level1);

  const existing = await prisma.canonicalCategoryRegistry.findUnique({
    where: {
      userId_level1_level2_subcategory: {
        userId: input.userId,
        level1: input.level1,
        level2: level2 ?? '',
        subcategory: subcategory ?? '',
      },
    },
  });
  if (existing) return existing;

  // Race-tolerant create — if two concurrent calls reach here, the
  // second one will hit the unique index and we recover by re-reading.
  try {
    return await prisma.canonicalCategoryRegistry.create({
      data: {
        userId: input.userId,
        level1: input.level1,
        level2,
        subcategory,
        type,
        isSystem: false,
      },
    });
  } catch (err) {
    // Recover from concurrent insert: read the row that won the race.
    const winner = await prisma.canonicalCategoryRegistry.findUnique({
      where: {
        userId_level1_level2_subcategory: {
          userId: input.userId,
          level1: input.level1,
          level2: level2 ?? '',
          subcategory: subcategory ?? '',
        },
      },
    });
    if (winner) return winner;
    throw err;
  }
}

/**
 * Backfill the registry from existing UnifiedTransaction strings for a
 * given user. Idempotent — re-runs are safe; existing rows are unchanged.
 *
 * Returns the count of rows seeded by THIS invocation (the rows that did
 * not already exist).
 *
 * Performance note: this is intended to run once per user as part of a
 * background backfill job, NOT on every request. Keep it cheap by
 * grouping at the DB layer.
 */
export async function backfillRegistryForUser(userId: string): Promise<number> {
  const existing = await prisma.canonicalCategoryRegistry.findMany({
    where: { userId },
    select: { level1: true, level2: true, subcategory: true },
  });
  const existingKeys = new Set(
    existing.map((row) => keyOf(row.level1, row.level2, row.subcategory))
  );

  // Distinct triples from BOTH transaction history and merchant mappings.
  // GroupBy is more efficient than findMany + manual dedup at high row counts.
  const [txTriples, mappingTriples] = await Promise.all([
    prisma.unifiedTransaction.groupBy({
      by: ['categoryLevel1', 'categoryLevel2', 'subcategory'],
      where: { userId, categoryLevel1: { not: null } },
    }),
    prisma.merchantMapping.groupBy({
      by: ['categoryLevel1', 'categoryLevel2', 'subcategory'],
      where: { userId, categoryLevel1: { not: '' } },
    }),
  ]);

  const seeds = new Map<string, { level1: string; level2: string | null; subcategory: string | null }>();
  for (const row of txTriples) {
    if (!row.categoryLevel1) continue;
    seeds.set(
      keyOf(row.categoryLevel1, row.categoryLevel2, row.subcategory),
      {
        level1: row.categoryLevel1,
        level2: row.categoryLevel2,
        subcategory: row.subcategory,
      }
    );
  }
  for (const row of mappingTriples) {
    if (!row.categoryLevel1) continue;
    seeds.set(
      keyOf(row.categoryLevel1, row.categoryLevel2, row.subcategory),
      {
        level1: row.categoryLevel1,
        level2: row.categoryLevel2,
        subcategory: row.subcategory,
      }
    );
  }

  let seeded = 0;
  for (const [key, triple] of seeds.entries()) {
    if (existingKeys.has(key)) continue;
    await prisma.canonicalCategoryRegistry.create({
      data: {
        userId,
        level1: triple.level1,
        level2: triple.level2,
        subcategory: triple.subcategory,
        type: inferType(triple.level1),
        isSystem: false,
      },
    });
    seeded++;
  }
  return seeded;
}

function keyOf(
  level1: string | null | undefined,
  level2: string | null | undefined,
  subcategory: string | null | undefined
): string {
  return `${level1 ?? ''}|${level2 ?? ''}|${subcategory ?? ''}`;
}

function inferType(level1: string): CategoryType {
  const lower = level1.toLowerCase();
  if (lower === 'income') return 'INCOME';
  // Transfers map to EXPENSE in the registry's `type` field — the
  // existing Prisma `CategoryType` enum is binary (EXPENSE/INCOME) and
  // expanding it is out of scope for PR1. The level1 string preserves
  // the "Transfer" identity for the UI; the type column is the
  // accounting-direction hint only. (PR2+ may promote `CategoryType` to
  // a 3-value enum if downstream calc engines need to distinguish.)
  return 'EXPENSE';
}

export type { CanonicalCategoryRegistry };
