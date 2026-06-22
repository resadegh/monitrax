/**
 * Phase 52 — seed the categorisation KB with curated AU merchants (build 52.4).
 *
 * Inserts the `AU_MERCHANT_SEEDS` as graduated, trusted shared signatures so the
 * READ path is useful on day one. Idempotent: `createMany({ skipDuplicates })`
 * never clobbers an existing row (a re-seed only adds new merchants; accumulated
 * user votes on an existing pattern are untouched). `isGlobal` is sticky
 * (recordContribution), so later votes can't demote a seed.
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §7 (52.4).
 */

import prisma from '@/lib/db';
import { SignatureMatchType, SignatureSource } from '@prisma/client';
import { scrubToSignature } from './scrubSignature';
import { encodeCategoryPath } from './categoryPath';
import { AU_MERCHANT_SEEDS } from './seedData';

/** Synthetic prior strength for a seed (resists a single later disagreement). */
const SEED_WEIGHT = 5;

export interface SeedResult {
  total: number; // seeds in the curated list
  created: number; // newly inserted this run
  skipped: number; // already present (idempotent)
  rejected: number; // scrubbed to nothing (should be 0 for a clean list)
}

export async function seedCategorisationKb(region = 'AU'): Promise<SeedResult> {
  const rows: {
    region: string;
    pattern: string;
    matchType: SignatureMatchType;
    categoryVotes: Record<string, number>;
    topCategory: string;
    confidence: number;
    distinctUserCount: number;
    isGlobal: boolean;
    source: SignatureSource;
  }[] = [];
  let rejected = 0;

  for (const s of AU_MERCHANT_SEEDS) {
    const scrub = scrubToSignature(s.merchant);
    if (!scrub.ok) {
      rejected++;
      continue;
    }
    const path = encodeCategoryPath(s.level1, s.level2, null);
    rows.push({
      region,
      pattern: scrub.pattern,
      matchType: SignatureMatchType.EXACT,
      categoryVotes: { [path]: SEED_WEIGHT },
      topCategory: path,
      confidence: 1.0,
      distinctUserCount: 0,
      isGlobal: true, // curated → usable immediately (bypasses k-anonymity, which is for user data)
      source: SignatureSource.SEED,
    });
  }

  const res = await prisma.transactionSignature.createMany({ data: rows, skipDuplicates: true });

  return {
    total: AU_MERCHANT_SEEDS.length,
    created: res.count,
    skipped: rows.length - res.count,
    rejected,
  };
}
