/**
 * Phase 52.5c — the ONE learn-once write-back used by every genuine human
 * categorisation surface in the app.
 *
 * Why this exists: before 52.5c only the single-transaction PATCH taught the
 * shared KB. Bulk re-categorise, review-queue confirm, and the per-row
 * "✓ Looks right" affordance all wrote the PRIVATE `merchantMapping` but never
 * fed the cross-user KB — so the AI engine couldn't learn from the highest-volume
 * categorisation paths. This helper centralises the encode + gate + swallow so
 * every confirmation surface contributes through ONE path (CLAUDE.md §12.2 SSOT).
 *
 * IMPORTANT — human votes only. Do NOT call this from AI auto-accept paths
 * (import-time ≥0.9 auto-categorisation, `bulkConfirmAutoAccepted`,
 * `bulkConfirmHighBand`). Feeding the AI's own guesses back into the KB is an
 * echo chamber that would defeat the k-anonymity human-consensus design. Only
 * a genuine user confirm / edit / re-categorise is a real vote.
 *
 * Vocabulary: callers MUST pass the canonical category triple
 * (level1 / level2 / subcategory display names) — the same vocabulary the KB,
 * the rules engine, and `categoriseTransaction` use. The legacy flat-enum
 * categorisation path (`/api/transactions/[id]/link`) is deliberately NOT wired
 * here yet — see docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §8
 * (vocabulary-bridge follow-up).
 *
 * No-op when `KB_WRITE_ENABLED` is off, or when description/category is empty,
 * or when the scrubber rejects the description (PII / transfer). Fire-and-forget:
 * never blocks or throws into the caller (CLAUDE.md §12.10).
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md §4.1, §5, §7.
 */

import { recordContribution } from './recordContribution';
import { encodeCategoryPath } from './categoryPath';

export function recordKbContribution(args: {
  userId: string;
  rawDescription: string | null | undefined;
  categoryLevel1: string | null | undefined;
  categoryLevel2?: string | null;
  subcategory?: string | null;
  mcc?: string | null;
  region?: string;
}): void {
  if (!args.rawDescription || !args.categoryLevel1) return;
  recordContribution({
    userId: args.userId,
    rawDescription: args.rawDescription,
    category: encodeCategoryPath(
      args.categoryLevel1,
      args.categoryLevel2 ?? null,
      args.subcategory ?? null
    ),
    mcc: args.mcc ?? null,
    region: args.region,
  }).catch(() => {});
}
