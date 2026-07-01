/**
 * Phase 54.2d — backfill: re-categorise EXISTING uncategorised transactions.
 *
 * The engine improvements this session (P1/P2 merchant-noise denoising, the KB
 * cascade, grounding) all run at IMPORT time — they never re-touch rows already
 * in the ledger. So a transaction imported before the changes (e.g. the noisy
 * "16:49hjs North Parramattanorthmead") keeps its old name and no suggestion.
 * This backfill lets the user re-run the smarts over their existing rows.
 *
 * SAFE + COST-FREE by design:
 *   - DETERMINISTIC layers only (`skipAiOnMiss: true`) — a full-ledger re-scan can
 *     never trigger an unbounded LLM/grounding bill. The paid AI tail stays an
 *     import-time / on-demand concern.
 *   - Re-normalises `merchantStandardised` via the P1/P2 denoiser (so "16:49hjs …"
 *     → "Hungry Jacks", which then matches the rules + the read-time suggestion).
 *   - NEVER overwrites a category the user set (§12.11): only touches rows that are
 *     STILL uncategorised + unlinked + not transfer/investment, and only FILLS an
 *     empty category from a non-AI (RULE/USER/KB) high-confidence match. AI is
 *     skipped here, so nothing is ever auto-filed from a guess (§54.2).
 *
 * SSOT (§12.2.1): reuses `categoriseTransaction` (the one cascade) + the one
 * `renormaliseMerchant` denoiser — no parallel categorisation logic.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { renormaliseMerchant } from '@/lib/bank/normalisation';
import { categoriseTransaction } from '@/lib/tie/categorisation';
import type { UnifiedTransaction, MerchantMapping } from '@/lib/tie/types';

/** Matches the import-time auto-accept threshold — deterministic matches only. */
const AUTO_FILL_MIN_CONFIDENCE = 0.9;
/** Bound a single re-scan (user can run it again); protects against a runaway. */
const MAX_ROWS_PER_RUN = 2000;

export interface RecategoriseResult {
  /** Uncategorised rows examined. */
  scanned: number;
  /** Rows that got a category filled (deterministic, non-AI). */
  recategorised: number;
  /** Rows whose merchant name was cleaned by re-normalisation. */
  renamed: number;
}

/**
 * Pure write-policy for one row (the §12.11-critical decision, unit-tested).
 * - Always cleans the merchant name when re-normalisation changed it.
 * - Fills the category ONLY from a deterministic (RULE/USER/KB) match at/above
 *   the auto-accept threshold. NEVER from an AI/FALLBACK source (AI never
 *   auto-files, §54.2; and the backfill skips the LLM entirely anyway).
 */
export function planBackfillWrite(
  currentStandardised: string | null | undefined,
  cleaned: string,
  result: {
    source: string;
    confidence: number;
    categoryLevel1: string;
    categoryLevel2: string | null;
    subcategory: string | null;
  }
): { data: Record<string, unknown>; renamed: boolean; recategorised: boolean } {
  const renamed = !!cleaned && cleaned !== 'Unknown' && cleaned !== currentStandardised;
  const recategorised =
    result.source !== 'AI' &&
    result.source !== 'FALLBACK' &&
    result.confidence >= AUTO_FILL_MIN_CONFIDENCE;
  const data: Record<string, unknown> = {};
  if (renamed) data.merchantStandardised = cleaned;
  if (recategorised) {
    data.categoryLevel1 = result.categoryLevel1;
    data.categoryLevel2 = result.categoryLevel2;
    data.subcategory = result.subcategory;
    data.confidenceScore = result.confidence;
  }
  return { data, renamed, recategorised };
}

/** The §12.11 guard — the ONLY rows this backfill may ever write to. */
function uncategorisedGuard(userId: string): Prisma.UnifiedTransactionWhereInput {
  return {
    userId,
    OR: [{ categoryLevel1: null }, { categoryLevel1: '' }],
    expenseId: null,
    incomeId: null,
    loanId: null,
    isTransfer: false,
    isInvestmentContribution: false,
  };
}

export async function recategoriseUncategorised(userId: string): Promise<RecategoriseResult> {
  const rows = await prisma.unifiedTransaction.findMany({
    where: uncategorisedGuard(userId),
    select: {
      id: true,
      description: true,
      merchantRaw: true,
      merchantStandardised: true,
      direction: true,
      amount: true,
      date: true,
      accountId: true,
      merchantCategoryCode: true,
    },
    take: MAX_ROWS_PER_RUN,
  });
  if (rows.length === 0) return { scanned: 0, recategorised: 0, renamed: 0 };

  // Cascade layer 1 — the user's private + global merchant mappings (one query).
  const merchantMappings = (await prisma.merchantMapping.findMany({
    where: { OR: [{ userId }, { userId: null }] },
  })) as unknown as MerchantMapping[];

  let recategorised = 0;
  let renamed = 0;

  for (const row of rows) {
    const cleaned = renormaliseMerchant(row.merchantRaw || row.description || '');

    const uni: UnifiedTransaction = {
      id: row.id,
      userId,
      accountId: row.accountId ?? '',
      date: row.date,
      amount: row.amount,
      currency: 'AUD',
      direction: row.direction,
      description: row.description,
      merchantRaw: row.merchantRaw ?? null,
      merchantStandardised: cleaned || row.merchantStandardised,
      merchantCategoryCode: row.merchantCategoryCode ?? null,
      tags: [],
      userCorrectedCategory: false,
      isRecurring: false,
      anomalyFlags: [],
      source: 'CSV',
      createdAt: row.date,
      updatedAt: row.date,
    };

    const result = await categoriseTransaction(uni, { merchantMappings, skipAiOnMiss: true });
    const plan = planBackfillWrite(row.merchantStandardised, cleaned, result);
    if (Object.keys(plan.data).length === 0) continue;

    // §12.11 — re-assert the guard at WRITE time (updateMany, not update): the row
    // must STILL be uncategorised/unlinked, so a category the user set between the
    // read and the write is never clobbered.
    const written = await prisma.unifiedTransaction.updateMany({
      where: { id: row.id, ...uncategorisedGuard(userId) },
      data: plan.data,
    });
    if (written.count > 0) {
      if (plan.renamed) renamed++;
      if (plan.recategorised) recategorised++;
    }
  }

  return { scanned: rows.length, recategorised, renamed };
}
