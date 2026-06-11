/**
 * Confidence-based bulk confirmation of AI categorisations.
 *
 * Canonical service for the Activity page "AI bookkeeper" card (Phase 49 —
 * Activity redesign, 2026-06-11). Confirming an AI category:
 *   1. Promotes the transaction's confidenceScore to 1.0 — the codebase's
 *      established "user validated this" convention (same value the
 *      bulk-categorise route writes; the UI's confidence dots key off
 *      confidenceScore < 0.9, so confirmed rows naturally drop out of the
 *      review surfaces).
 *   2. Reinforces the Phase 13 learning surface: the merchant's mapping is
 *      stamped lastConfirmedAt / confidence 1.0 so the next import auto-files
 *      this merchant at high confidence.
 *
 * Deliberately NOT done here:
 *   - No category mutation — confirmation accepts the AI's triple as-is.
 *     (Corrections go through PATCH /api/unified-transactions/[id] or
 *     bulk-categorise, which set userCorrectedCategory.)
 *   - No TransactionEdit rows — nothing user-visible changed on the row.
 *   - USER-source merchant mappings are never overwritten (a deliberate
 *     per-merchant rule the user set via PATCH outranks a bulk confirm).
 *
 * Confidence bands (mirrors classifyByConfidence in aiCategorisation.ts):
 *   high   ≥ 0.90 — auto-accepted at import; no confirmation needed
 *   medium ≥ 0.70 and < 0.90 — the bulk-confirm sweet spot
 *   low    > 0 and < 0.70 — confirmable, but per-row review is encouraged
 */

import prisma from '@/lib/db';

export type ConfidenceBand = 'medium' | 'low';

export interface ConfidenceSummary {
  /** Categorised, confidence ≥ 0.9 (auto-filed; includes user-confirmed 1.0). */
  high: number;
  /** Categorised, unconfirmed, 0.7 ≤ confidence < 0.9. */
  medium: number;
  /** Categorised, unconfirmed, 0 < confidence < 0.7. */
  low: number;
  /** No category at all — the existing review-queue / picker flows own these. */
  uncategorised: number;
}

const BAND_RANGES: Record<ConfidenceBand, { gte: number; lt: number }> = {
  medium: { gte: 0.7, lt: 0.9 },
  low: { gte: 0.000001, lt: 0.7 },
};

/** Hard cap per call — same spirit as bulk-categorise's MAX_BULK, sized for one import. */
const MAX_CONFIRM = 500;

export async function getConfidenceSummary(userId: string): Promise<ConfidenceSummary> {
  const [high, medium, low, uncategorised] = await Promise.all([
    prisma.unifiedTransaction.count({
      where: { userId, categoryLevel1: { not: null }, confidenceScore: { gte: 0.9 } },
    }),
    prisma.unifiedTransaction.count({
      where: {
        userId,
        categoryLevel1: { not: null },
        userCorrectedCategory: false,
        confidenceScore: { gte: BAND_RANGES.medium.gte, lt: BAND_RANGES.medium.lt },
      },
    }),
    prisma.unifiedTransaction.count({
      where: {
        userId,
        categoryLevel1: { not: null },
        userCorrectedCategory: false,
        confidenceScore: { gte: BAND_RANGES.low.gte, lt: BAND_RANGES.low.lt },
      },
    }),
    prisma.unifiedTransaction.count({
      where: { userId, categoryLevel1: null, isTransfer: false },
    }),
  ]);

  return { high, medium, low, uncategorised };
}

export interface BulkConfirmResult {
  confirmedCount: number;
  merchantsLearned: number;
}

/**
 * Confirm AI categorisations in bulk — either a whole confidence band or an
 * explicit id list (the per-row "Looks right" chip sends a single id).
 *
 * CLAUDE.md §12.11 guards:
 *   - UnifiedTransaction updateMany touches ONLY confidenceScore, and only on
 *     rows where userCorrectedCategory=false AND confidenceScore sits in an
 *     AI-authored band (< 0.9) — user-entered data is structurally out of
 *     reach of the where clause.
 *   - MerchantMapping updates skip source='USER' rows entirely.
 */
export async function bulkConfirmCategorisations(
  userId: string,
  input: { band?: ConfidenceBand; transactionIds?: string[] }
): Promise<BulkConfirmResult> {
  const baseWhere = {
    userId,
    categoryLevel1: { not: null },
    userCorrectedCategory: false,
    // Never re-stamp already-confirmed/high rows, and never touch rows
    // without an AI confidence at all (rule-based / manual entries).
    confidenceScore: input.band
      ? { gte: BAND_RANGES[input.band].gte, lt: BAND_RANGES[input.band].lt }
      : { gt: 0, lt: 0.9 },
  } as const;

  const targets = await prisma.unifiedTransaction.findMany({
    where: input.transactionIds?.length
      ? { ...baseWhere, id: { in: input.transactionIds.slice(0, MAX_CONFIRM) } }
      : baseWhere,
    select: {
      id: true,
      merchantStandardised: true,
      categoryLevel1: true,
      categoryLevel2: true,
      subcategory: true,
      confidenceScore: true,
    },
    take: MAX_CONFIRM,
  });

  if (targets.length === 0) {
    return { confirmedCount: 0, merchantsLearned: 0 };
  }

  let merchantsLearned = 0;

  await prisma.$transaction(async (txnCtx) => {
    await txnCtx.unifiedTransaction.updateMany({
      where: { id: { in: targets.map((t) => t.id) }, userId },
      data: { confidenceScore: 1.0 },
    });

    // Phase 13 learning reinforcement — one upsert per distinct merchant,
    // using THAT merchant's confirmed category (unlike bulk-categorise,
    // which applies a single user-chosen category to the whole batch).
    const byMerchant = new Map<string, (typeof targets)[number]>();
    for (const t of targets) {
      const key = t.merchantStandardised?.toLowerCase();
      if (key && !byMerchant.has(key)) byMerchant.set(key, t);
    }

    for (const [merchantRaw, t] of byMerchant) {
      if (!t.categoryLevel1 || !t.merchantStandardised) continue;
      const existing = await txnCtx.merchantMapping.findUnique({
        where: { userId_merchantRaw: { userId, merchantRaw } },
        select: { id: true, source: true },
      });
      if (existing?.source === 'USER') continue; // user rule outranks bulk confirm
      if (existing) {
        await txnCtx.merchantMapping.update({
          where: { id: existing.id },
          data: {
            categoryLevel1: t.categoryLevel1,
            categoryLevel2: t.categoryLevel2 ?? null,
            subcategory: t.subcategory ?? null,
            confidence: 1.0,
            lastConfirmedAt: new Date(),
            usageCount: { increment: 1 },
          },
        });
      } else {
        await txnCtx.merchantMapping.create({
          data: {
            userId,
            merchantRaw,
            merchantStandardised: t.merchantStandardised,
            categoryLevel1: t.categoryLevel1,
            categoryLevel2: t.categoryLevel2 ?? null,
            subcategory: t.subcategory ?? null,
            confidence: 1.0,
            source: 'AI',
            lastConfirmedAt: new Date(),
            usageCount: 1,
          },
        });
      }
      merchantsLearned++;
    }
  });

  return { confirmedCount: targets.length, merchantsLearned };
}
