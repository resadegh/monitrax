/**
 * Neobrain — auto-apply a user's confirmed categorisation to similar rows.
 *
 * When a user manually categorises a transaction on the reconciliation surface
 * (the link dialog → POST /api/transactions/[id]/link), Neobrain propagates that
 * *user-confirmed* decision to OTHER still-uncategorised transactions from the
 * exact same merchant + same direction. This is the "categorise once, the rest
 * are picked up" behaviour (Reza directive 2026-06-27).
 *
 * Why this is consistent with the autonomy model (CLAUDE.md §18.7.4 / Reza
 * 2026-06-18 "AI suggests, user confirms"): we are NOT auto-executing an AI
 * *guess* — we are extending the user's OWN just-made decision to identical
 * rows. The four guardrails below bound the blast radius, and the caller
 * surfaces an "Applied to N · Undo" affordance so the sweep is visible +
 * reversible (never silent).
 *
 * GUARDRAILS (all four must hold for a row to be swept):
 *   1. EXACT standardised-merchant match (never fuzzy/contains) — "Anthropic"
 *      never bleeds into "Anthropic Logistics".
 *   2. SAME direction (IN/OUT) — a refund from the same merchant is income and
 *      is never swept into an expense category.
 *   3. STILL UNCATEGORISED + UNLINKED only — never overwrites a category the
 *      user already set, and never touches transfers/investments.
 *   4. SCOPED to the authenticated user (§12.11) + excludes the source row and
 *      any rows the caller already handled (e.g. an explicit multi-select batch).
 *
 * SSOT (§12.2.1): the `data` payload is the SAME object the caller writes to the
 * primary row, so the propagated rows are categorised identically — no second
 * formula, no drift.
 */
import { prisma } from '@/lib/db';
import type { Prisma, TransactionDirection } from '@prisma/client';

export interface SimilarApplyResult {
  /** Ids of the rows that were auto-categorised (for the Undo affordance). */
  appliedIds: string[];
  /** Convenience count = appliedIds.length. */
  count: number;
}

/**
 * Pure builder for the "similar uncategorised sibling" Prisma where-clause —
 * encodes the four guardrails so they can be unit-tested without a DB. Returns
 * `null` when there is no merchant to match on (no sweep).
 */
export function buildSimilarUncategorisedWhere(params: {
  userId: string;
  sourceTransactionId: string;
  merchantStandardised: string | null | undefined;
  direction: TransactionDirection;
  excludeIds?: string[];
}): Prisma.UnifiedTransactionWhereInput | null {
  const { userId, sourceTransactionId, merchantStandardised, direction, excludeIds = [] } = params;
  if (!merchantStandardised) return null; // Guardrail 1 — no merchant, no match.

  const notIn = Array.from(new Set([sourceTransactionId, ...excludeIds]));
  return {
    userId, // Guardrail 4 — only this user's rows.
    merchantStandardised, // Guardrail 1 — exact merchant.
    direction, // Guardrail 2 — same direction.
    // Guardrail 3 — still uncategorised + unlinked + not transfer/investment.
    OR: [{ categoryLevel1: null }, { categoryLevel1: '' }],
    expenseId: null,
    incomeId: null,
    loanId: null,
    isTransfer: false,
    isInvestmentContribution: false,
    id: { notIn },
  };
}

export async function applyCategoryToSimilarUnified(params: {
  userId: string;
  /** The row the user explicitly categorised — always excluded from the sweep. */
  sourceTransactionId: string;
  /** Standardised merchant of the source row; no merchant → no sweep. */
  merchantStandardised: string | null | undefined;
  /** Direction of the source row; siblings must match exactly. */
  direction: TransactionDirection;
  /** The exact categorisation payload to apply (same as the primary write). */
  // Unchecked variant — callers set scalar FK columns directly (incomeId,
  // expenseId, loanId), exactly as the existing batch updateMany does.
  data: Prisma.UnifiedTransactionUncheckedUpdateManyInput;
  /** Rows the caller already handled (e.g. an explicit batch) — excluded. */
  excludeIds?: string[];
}): Promise<SimilarApplyResult> {
  const { userId, sourceTransactionId, merchantStandardised, direction, data, excludeIds } = params;

  const where = buildSimilarUncategorisedWhere({
    userId,
    sourceTransactionId,
    merchantStandardised,
    direction,
    excludeIds,
  });
  if (!where) return { appliedIds: [], count: 0 };

  const siblings = await prisma.unifiedTransaction.findMany({
    where,
    select: { id: true },
  });

  if (siblings.length === 0) return { appliedIds: [], count: 0 };

  const appliedIds = siblings.map((s) => s.id);
  await prisma.unifiedTransaction.updateMany({
    where: { id: { in: appliedIds } },
    data,
  });

  return { appliedIds, count: appliedIds.length };
}

/**
 * Neobrain suggestion lookup — the read side of the same learning store.
 *
 * Given a set of standardised merchant names, returns a merchant → learned
 * categoryLevel1 map from the user's own `merchantMapping` (the private store
 * that manual categorisation writes). The reconciliation list uses this to show
 * a "Suggested" pill on an uncategorised row whose merchant Neobrain has seen
 * before (e.g. categorised in a prior session) — one tap to accept.
 *
 * One query for the whole page (no N+1). SSOT (§12.2.1): reads the SAME
 * merchantMapping the link route writes — no parallel suggestion store.
 */
export async function getLearnedCategorySuggestions(
  userId: string,
  merchants: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const distinct = Array.from(
    new Set(merchants.filter((m): m is string => !!m && m.trim().length > 0)),
  );
  if (distinct.length === 0) return new Map();

  const mappings = await prisma.merchantMapping.findMany({
    where: { userId, merchantStandardised: { in: distinct } },
    select: { merchantStandardised: true, categoryLevel1: true },
  });

  const out = new Map<string, string>();
  for (const m of mappings) {
    if (m.merchantStandardised && m.categoryLevel1) {
      out.set(m.merchantStandardised, m.categoryLevel1);
    }
  }
  return out;
}
