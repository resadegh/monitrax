/**
 * Phase 54.2d — backfill: re-categorise EXISTING uncategorised transactions.
 *
 * The engine improvements this session (P1/P2 merchant-noise denoising, the KB
 * cascade, grounding) all run at IMPORT time — they never re-touch rows already
 * in the ledger. So a transaction imported before the changes (e.g. the noisy
 * "16:49hjs North Parramattanorthmead") keeps its old name and no suggestion.
 * This backfill lets the user re-run the smarts over their existing rows.
 *
 * TWO passes:
 *   1. DETERMINISTIC (always, free) — re-normalises `merchantStandardised` via the
 *      P1/P2 denoiser (so "16:49hjs …" → "Hungry Jacks", which then matches the
 *      rules + the read-time suggestion) and FILLS an empty category ONLY from a
 *      non-AI (RULE/USER/KB) high-confidence match. `skipAiOnMiss: true` here, so
 *      this pass can never trigger an LLM bill.
 *   2. AI TAIL (opt-in, `useAI: true`, Reza 2026-07-01: "cost-bounded") — the rows
 *      STILL unknown are grouped by de-identified signature so all rows of one
 *      merchant share a SINGLE Gemini call, capped at `MAX_AI_MERCHANTS_PER_RUN`
 *      distinct merchants per run. Each result is written to every row of that
 *      merchant as an unconfirmed SUGGESTION (`userCorrectedCategory` untouched) —
 *      never auto-filed (§54.2). No-op when `KB_GEMINI_ENABLED` is off.
 *
 * NEVER overwrites a category the user set (§12.11): both passes only touch rows
 * STILL uncategorised + unlinked + not transfer/investment, and the guard is
 * re-asserted at WRITE time. The durable "no repeat AI call for similar" comes from
 * the user CONFIRMING a suggestion (→ private merchantMapping + shared-KB vote that
 * graduates to a global prior at k users) — an unconfirmed guess is never cached as
 * if trusted (anti-echo-chamber, §54.2).
 *
 * SSOT (§12.2.1): reuses `categoriseTransaction` (the one cascade), the one
 * `renormaliseMerchant` denoiser, `scrubToSignature` (the one de-identifier) and
 * `geminiCategoriseOnMiss` (the one AI-on-miss engine) — no parallel logic.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { renormaliseMerchant } from '@/lib/bank/normalisation';
import { categoriseTransaction } from '@/lib/tie/categorisation';
import { scrubToSignature } from '@/lib/categorisation/kb/scrubSignature';
import { geminiCategoriseOnMiss, type GeminiCategoryResult } from '@/lib/categorisation/kb/geminiOnMiss';
import type { UnifiedTransaction, MerchantMapping } from '@/lib/tie/types';

/** Matches the import-time auto-accept threshold — deterministic matches only. */
const AUTO_FILL_MIN_CONFIDENCE = 0.9;
/** Bound a single re-scan (user can run it again); protects against a runaway. */
const MAX_ROWS_PER_RUN = 2000;
/**
 * COST BOUND for the opt-in AI tail (Reza 2026-07-01: "cost-bounded"). We make at
 * most this many Gemini calls per run — ONE per DISTINCT unknown merchant
 * signature (every row sharing a signature reuses the single result), and never
 * more than this many distinct merchants. A user can run it again to continue;
 * `aiCapped` in the result tells the UI when the tail was truncated (no silent
 * caps). This is what keeps a full-ledger AI re-scan from ever being an unbounded
 * LLM bill.
 */
const MAX_AI_MERCHANTS_PER_RUN = 50;

export interface RecategoriseResult {
  /** Uncategorised rows examined. */
  scanned: number;
  /** Rows that got a category filled (deterministic, non-AI). */
  recategorised: number;
  /** Rows whose merchant name was cleaned by re-normalisation. */
  renamed: number;
  /**
   * Rows that received an AI-proposed category SUGGESTION (opt-in tail only).
   * These stay `userCorrectedCategory = false` — a suggestion the user confirms,
   * NEVER auto-filed (§54.2). 0 when `useAI` is off or Gemini-on-miss is disabled.
   */
  aiSuggested: number;
  /** Distinct unknown merchants a Gemini call was made for (the cost signal). */
  aiMerchantsQueried: number;
  /** True when more distinct unknowns existed than `MAX_AI_MERCHANTS_PER_RUN`. */
  aiCapped: boolean;
}

export interface RecategoriseOptions {
  /**
   * Opt-in AI tail. When true, after the free deterministic pass, the rows STILL
   * unknown are grouped by de-identified signature and each DISTINCT merchant gets
   * ONE Gemini call (cost-bounded by `MAX_AI_MERCHANTS_PER_RUN`); the result is
   * written to every row of that merchant as an unconfirmed SUGGESTION. Requires
   * `KB_GEMINI_ENABLED` server-side (else the tail is a no-op). Default false — the
   * button's deterministic behaviour is unchanged unless AI is explicitly requested.
   */
  useAI?: boolean;
}

/**
 * Pure write-policy for one AI SUGGESTION (the §54.2-critical decision, unit-tested).
 * Writes the AI's proposed category (+ confidence) so the review card pre-fills the
 * guess — and, when a grounded pass named the merchant, cleans the display name too.
 * CRITICALLY it NEVER sets `userCorrectedCategory`: the row stays in the review queue
 * for the user to confirm. AI never auto-files (§54.2). Returns empty data when the
 * AI produced no usable level1 (caller writes nothing).
 */
export function planAiSuggestionWrite(
  currentStandardised: string | null | undefined,
  ai: Pick<
    GeminiCategoryResult,
    'categoryLevel1' | 'categoryLevel2' | 'subcategory' | 'confidence' | 'merchantGuess'
  > | null,
): { data: Record<string, unknown>; suggested: boolean } {
  if (!ai || !ai.categoryLevel1) return { data: {}, suggested: false };
  const data: Record<string, unknown> = {
    categoryLevel1: ai.categoryLevel1,
    categoryLevel2: ai.categoryLevel2 ?? null,
    subcategory: ai.subcategory ?? null,
    confidenceScore: ai.confidence,
  };
  // A grounded pass ("this looks like Hungry Jacks") also cleans the display name —
  // cosmetic + non-destructive (the row is still uncategorised, category unconfirmed).
  const guess = ai.merchantGuess?.trim();
  if (guess && guess.length > 0 && guess !== currentStandardised) {
    data.merchantStandardised = guess;
  }
  return { data, suggested: true };
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

/**
 * The §12.11 guard — the ONLY rows this backfill may ever write to.
 *
 * "Uncategorised" is the CANONICAL definition the Activity list uses
 * (app/api/unified-transactions/route.ts:121): `userCorrectedCategory != true`
 * — NOT `categoryLevel1 = null`. The import cascade sets `categoryLevel1` on
 * EVERY row (fallback → 'Other'), so a row the user sees as "Uncategorised" has
 * a category value the user simply hasn't confirmed. Guarding on
 * `categoryLevel1 null` (the original 54.2d guard) fetched ZERO of these rows —
 * that was the "nothing to tidy" bug. We never touch a user-confirmed row
 * (`userCorrectedCategory = true`), and only overwrite the AI's own unconfirmed
 * guess with a better deterministic match.
 */
function uncategorisedGuard(userId: string): Prisma.UnifiedTransactionWhereInput {
  return {
    userId,
    userCorrectedCategory: { not: true },
    expenseId: null,
    incomeId: null,
    loanId: null,
    isTransfer: { not: true },
    isInvestmentContribution: { not: true },
  };
}

/** A row still uncategorised after the deterministic pass — an AI-tail candidate. */
interface UnknownRow {
  id: string;
  rawForAi: string;
  currentStandardised: string | null;
}

/** A category-free result used to drive `planBackfillWrite` for a NAME-ONLY pass. */
const NAME_ONLY_RESULT = {
  source: 'FALLBACK',
  confidence: 0,
  categoryLevel1: '',
  categoryLevel2: null,
  subcategory: null,
} as const;

/**
 * Cosmetic merchant-NAME tidy-up across ALL of a user's rows, REGARDLESS of
 * category (Reza 2026-07-01: "broaden the tidy up"). Re-runs the P1/P2 denoiser
 * and updates `merchantStandardised` only when it changed.
 *
 * NON-DESTRUCTIVE + §12.11-safe: it touches ONLY the DERIVED display name — never
 * user-entered data (category, amount, links) and never `userCorrectedCategory`.
 * So cleaning a row the user already confirmed just fixes how its name READS
 * ("16 49hjs North Parramatta" → "Hungry Jacks") without altering their category.
 * Reuses the tested rename policy in `planBackfillWrite` (§12.2.1). Returns the
 * number of rows whose name was cleaned.
 */
export async function renameAllMerchants(userId: string): Promise<number> {
  const rows = await prisma.unifiedTransaction.findMany({
    where: { userId },
    select: { id: true, merchantRaw: true, description: true, merchantStandardised: true },
  });
  let renamed = 0;
  for (const row of rows) {
    const cleaned = renormaliseMerchant(row.merchantRaw || row.description || '');
    const plan = planBackfillWrite(row.merchantStandardised, cleaned, NAME_ONLY_RESULT);
    if (!plan.renamed) continue;
    await prisma.unifiedTransaction.update({
      where: { id: row.id },
      data: { merchantStandardised: cleaned },
    });
    renamed++;
  }
  return renamed;
}

export async function recategoriseUncategorised(
  userId: string,
  opts: RecategoriseOptions = {},
): Promise<RecategoriseResult> {
  // Pass A — cosmetic name tidy-up across ALL rows regardless of category
  // (Reza 2026-07-01: "broaden the tidy up"). Name-only + non-destructive, so a
  // row the user confirmed long ago also gets its noisy name cleaned. Runs FIRST
  // so Pass B reads the already-cleaned names (no double rename-write).
  const renamed = await renameAllMerchants(userId);

  // Pass B — deterministic CATEGORY fill on the still-uncategorised rows (names
  // are already tidy from Pass A).
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
  if (rows.length === 0) {
    return { scanned: 0, recategorised: 0, renamed, aiSuggested: 0, aiMerchantsQueried: 0, aiCapped: false };
  }

  // Cascade layer 1 — the user's private + global merchant mappings (one query).
  const merchantMappings = (await prisma.merchantMapping.findMany({
    where: { OR: [{ userId }, { userId: null }] },
  })) as unknown as MerchantMapping[];

  let recategorised = 0;
  const stillUnknown: UnknownRow[] = [];

  for (const row of rows) {
    const rawForAi = row.merchantRaw || row.description || '';
    const cleaned = renormaliseMerchant(rawForAi);

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

    // Names were tidied in Pass A, so only the CATEGORY fill matters here.
    if (plan.recategorised) {
      // §12.11 — re-assert the guard at WRITE time (updateMany, not update): the row
      // must STILL be uncategorised/unlinked, so a category the user set between the
      // read and the write is never clobbered.
      const written = await prisma.unifiedTransaction.updateMany({
        where: { id: row.id, ...uncategorisedGuard(userId) },
        data: plan.data,
      });
      if (written.count > 0) recategorised++;
    } else {
      // Deterministic layers missed → an AI-tail candidate (name already cleaned).
      stillUnknown.push({ id: row.id, rawForAi, currentStandardised: cleaned || row.merchantStandardised });
    }
  }

  const ai = opts.useAI
    ? await aiSuggestDistinctUnknowns(userId, stillUnknown)
    : { aiSuggested: 0, aiMerchantsQueried: 0, aiCapped: false };

  return { scanned: rows.length, recategorised, renamed, ...ai };
}

/**
 * The opt-in, cost-bounded AI tail. Groups the still-unknown rows by
 * de-identified signature so all rows of one merchant share a SINGLE Gemini call
 * (Reza 2026-07-01: "no need for another call for similar transactions"), caps the
 * number of DISTINCT merchants queried per run (`MAX_AI_MERCHANTS_PER_RUN`), and
 * writes each result to every row of that merchant as an unconfirmed SUGGESTION.
 *
 * COST + SAFETY:
 *   - One call per distinct signature, ≤ MAX_AI_MERCHANTS_PER_RUN calls per run.
 *   - Only a DE-IDENTIFIED signature ever reaches the LLM (`scrubToSignature`);
 *     rows that scrub to nothing (transfers/PII) are skipped (never sent).
 *   - Never auto-files: the write sets a category SUGGESTION with
 *     `userCorrectedCategory` untouched (§54.2). Durable "no repeat call" comes
 *     from the user CONFIRMING (→ private merchantMapping + shared-KB vote that
 *     graduates to a global prior at k users) — an unconfirmed guess is never
 *     cached as if trusted (anti-echo-chamber).
 *   - No-op when `KB_GEMINI_ENABLED` is off (`geminiCategoriseOnMiss` → null).
 */
async function aiSuggestDistinctUnknowns(
  userId: string,
  unknown: UnknownRow[],
): Promise<{ aiSuggested: number; aiMerchantsQueried: number; aiCapped: boolean }> {
  // Group by de-identified signature; carry a representative raw + all row ids.
  const groups = new Map<string, { rawForAi: string; rows: UnknownRow[] }>();
  for (const row of unknown) {
    const scrub = scrubToSignature(row.rawForAi);
    if (!scrub.ok) continue; // transfer/PII/no merchant token — never send to AI
    const g = groups.get(scrub.pattern);
    if (g) g.rows.push(row);
    else groups.set(scrub.pattern, { rawForAi: row.rawForAi, rows: [row] });
  }

  const distinct = [...groups.values()];
  const aiCapped = distinct.length > MAX_AI_MERCHANTS_PER_RUN;
  const toQuery = distinct.slice(0, MAX_AI_MERCHANTS_PER_RUN);

  let aiSuggested = 0;
  let aiMerchantsQueried = 0;

  for (const group of toQuery) {
    const result = await geminiCategoriseOnMiss(group.rawForAi);
    aiMerchantsQueried++;
    const plan = planAiSuggestionWrite(group.rows[0].currentStandardised, result);
    if (!plan.suggested) continue;

    // §12.11 — guard re-asserted at write time; only still-uncategorised rows of
    // this merchant get the suggestion. Never sets userCorrectedCategory (§54.2).
    const ids = group.rows.map((r) => r.id);
    const written = await prisma.unifiedTransaction.updateMany({
      where: { id: { in: ids }, ...uncategorisedGuard(userId) },
      data: plan.data,
    });
    aiSuggested += written.count;
  }

  return { aiSuggested, aiMerchantsQueried, aiCapped };
}
