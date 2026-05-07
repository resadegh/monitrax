/**
 * Phase 42 PR1 — Deterministic description normaliser + hash.
 *
 * The canonical hash function used to detect duplicate transactions across
 * separate QIF / CSV / OFX imports. Same inputs always produce the same
 * 32-char hex hash. Mirrored in the migration SQL backfill — keep them in
 * sync (see `prisma/migrations/20260509200000_phase_42_pr1_foundation/migration.sql`).
 *
 * Why this is the single source of truth:
 *   - The migration backfill computes the hash for every existing
 *     QIF/CSV/OFX row at deploy time
 *   - Every new row written by the import pipelines (CSV, QIF, OFX)
 *     computes the hash via this helper at write time
 *   - A future PR1.1 promotes the (accountId, date, amount, hash) index
 *     to UNIQUE; if the two implementations drift, that promotion fails
 *
 * BASIQ rows have their own canonical dedup key (`basiqTransactionId`)
 * and skip this. MANUAL rows are user-explicit and skip this. We compute
 * the hash for QIF / CSV / OFX only.
 *
 * Per CLAUDE.md §12.2 SSOT — there is exactly one place that defines
 * "what does it mean for two transactions to be the same?" — and it lives
 * in this file.
 */

import { createHash } from 'node:crypto';

const NON_ALPHANUM_RE = /[^a-z0-9]+/g;
const WHITESPACE_RE = /\s+/g;

/**
 * Normalise a free-form description into a canonical string suitable for
 * hashing. Deterministic — same input → same output, always.
 *
 * Steps (mirror in `migration.sql` backfill):
 *   1. lowercase
 *   2. replace non-alphanumeric runs with a single space
 *   3. collapse whitespace runs to a single space
 *   4. trim
 *   5. truncate to 64 chars (long memo lines don't change identity)
 */
export function normaliseDescription(input: string | null | undefined): string {
  if (!input) return '';
  const lowered = input.toLowerCase();
  const stripped = lowered.replace(NON_ALPHANUM_RE, ' ');
  const collapsed = stripped.replace(WHITESPACE_RE, ' ').trim();
  return collapsed.slice(0, 64);
}

/**
 * Compute the canonical description hash for a transaction.
 *
 * Prefers `merchantStandardised` (more stable across re-uploads) and
 * falls back to `description`. Empty/null inputs hash to a known
 * sentinel ("d41d..." — md5 of empty string) which the dedup check at
 * the API layer treats as a non-match (we never collapse two
 * description-less transactions into a duplicate).
 */
export function computeDescriptionHash(input: {
  merchantStandardised?: string | null;
  description?: string | null;
}): string {
  const source = input.merchantStandardised ?? input.description ?? '';
  const normalised = normaliseDescription(source);
  return createHash('md5').update(normalised).digest('hex');
}

/**
 * Sources whose rows participate in the cross-batch dedup index.
 * BASIQ has `basiqTransactionId` (its own canonical key); MANUAL is
 * user-explicit; RECEIPT (PR3) has its own match-against-existing flow.
 */
export const DEDUP_SOURCES = ['QIF', 'CSV', 'OFX'] as const;
export type DedupSource = (typeof DEDUP_SOURCES)[number];

export function isDedupSource(source: string): source is DedupSource {
  return (DEDUP_SOURCES as readonly string[]).includes(source);
}
