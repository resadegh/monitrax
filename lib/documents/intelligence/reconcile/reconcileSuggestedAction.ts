/**
 * Phase 50 D.2 — Record reconciliation (the DIE judgement layer's "have I
 * already got this?" check for CREATE_* actions).
 *
 * Generalises the receipt→expense dedup (shipped in `/api/expenses` via
 * `dedupeReceipt`, D.1's sibling at the record level) into ONE canonical lookup
 * the document-confirm flow uses for every record type it can create from a
 * document — expense, income, loan. Before creating a record from a recognised
 * document, the confirm route asks this whether a matching record already
 * exists; if so it links the document to the existing record instead of writing
 * a duplicate.
 *
 * SSOT: this is the single place "is this document's record already in the
 * system?" is decided, so no confirm path can silently duplicate. It only READS
 * (findFirst) — the caller (confirm route) applies the verdict (link vs create),
 * keeping the write side in one place.
 *
 * Match keys (deliberately conservative — a false "duplicate" is worse than a
 * missed one, since the user is in the confirm loop and can always create):
 *   - EXPENSE: same user + same linking scope + the canonical near-duplicate
 *     decision (MON-037 RC-B, lib/utils/reconciliation.ts `isNearDuplicateEntry`:
 *     normalised name equality OR token-containment — "Battery" ⊂ "Battery
 *     System" — AND amount within 10%). Replaces the exact-string + exact-amount
 *     match that let one battery cost mint three name-variant rows.
 *   - INCOME:  same user + same amount + same name + same type.
 *   - LOAN:    same user + same name + same principal.
 */

import { prisma } from '@/lib/db';
import { isNearDuplicateEntry } from '@/lib/utils/reconciliation';

export type ReconcileRecordType = 'EXPENSE' | 'INCOME' | 'LOAN';

export interface ReconcileResult {
  /** True when a matching record already exists for this document's action. */
  duplicate: boolean;
  /** The existing record's id when `duplicate` is true. */
  existingId?: string;
}

const NO_MATCH: ReconcileResult = { duplicate: false };

function asAmount(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function asName(data: Record<string, unknown>): string {
  return String(data.vendor || data.name || '').trim();
}

/**
 * Find an existing record that the document's CREATE_* action would duplicate.
 * Returns `{ duplicate: false }` when there's nothing to match on (e.g. no
 * amount) so the caller proceeds with a normal create.
 */
export async function reconcileSuggestedAction(
  userId: string,
  type: ReconcileRecordType,
  data: Record<string, unknown>,
): Promise<ReconcileResult> {
  const amount = asAmount(data.amount);
  const name = asName(data);
  if (amount === null || !name) return NO_MATCH;

  if (type === 'EXPENSE') {
    const propertyId = data.propertyId ? String(data.propertyId) : undefined;
    const loanId = data.loanId ? String(data.loanId) : undefined;
    const assetId = data.assetId ? String(data.assetId) : undefined;
    // MON-037 RC-B: fetch the linking scope's candidates, then apply the ONE
    // near-duplicate decision (name equality/containment + ≤10% amount) —
    // the exact-string + exact-amount findFirst missed name variants of the
    // same cost ("Battery" vs "Battery System") and estimate-vs-actual drift.
    const candidates = await prisma.expense.findMany({
      where: {
        userId,
        ...(propertyId ? { propertyId } : {}),
        ...(loanId ? { loanId } : {}),
        ...(assetId ? { assetId } : {}),
      },
      select: { id: true, name: true, vendorName: true, amount: true },
      orderBy: { createdAt: 'asc' },
    });
    const existing =
      candidates.find((e) => isNearDuplicateEntry({ name, amount }, e)) ?? null;
    return existing ? { duplicate: true, existingId: existing.id } : NO_MATCH;
  }

  if (type === 'INCOME') {
    const incomeType = data.type ? String(data.type).toUpperCase() : undefined;
    const existing = await prisma.income.findFirst({
      where: {
        userId,
        amount,
        name,
        ...(incomeType ? { type: incomeType as never } : {}),
      },
      select: { id: true },
    });
    return existing ? { duplicate: true, existingId: existing.id } : NO_MATCH;
  }

  // LOAN — principal is the amount-equivalent; match on name + principal.
  const principal = asAmount(data.principal) ?? amount;
  const existing = await prisma.loan.findFirst({
    where: { userId, name, principal },
    select: { id: true },
  });
  return existing ? { duplicate: true, existingId: existing.id } : NO_MATCH;
}
