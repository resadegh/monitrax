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
 * Match keys (Mechanism A, MON-084/085 — the ONE classifier's source-signature
 * policy; docs/architecture/CALC_SSOT_WALL.md):
 *   - EXPENSE: same user, candidates ACROSS scopes; normalised-name equality or
 *     the canonical near-duplicate decision (token-containment + ≤10% amount),
 *     gated by scope compatibility — same scope, or one side scopeless
 *     (General). Two differently-scoped rows never converge.
 *   - INCOME:  same user + same type, candidates across scopes; same
 *     signature matching + scope-compatibility rule (the old exact
 *     `amount+name+type` match never caught a declared row's reconciled twin).
 *   - LOAN:    same user + same name + same principal (unchanged).
 */

import { prisma } from '@/lib/db';
import { classifyIntake } from '@/lib/intake/classifyIntake';
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
    const propertyId = data.propertyId ? String(data.propertyId) : null;
    const loanId = data.loanId ? String(data.loanId) : null;
    const assetId = data.assetId ? String(data.assetId) : null;
    // MON-037 RC-B → Mechanism A (MON-085): candidates are the user's expenses
    // ACROSS scopes; the ONE classifier's source-signature policy applies the
    // near-duplicate decision (name equality/containment + ≤10% amount) with
    // the scope-compatibility rule — same scope, or one side scopeless
    // (General). The old scope-filtered query meant a "Battery" on HOME and a
    // "Battery" on General were never compared, so the same real cost minted
    // scoped/scopeless siblings; two DIFFERENTLY-scoped rows (insurance on
    // property A vs property B) remain distinct and never converge.
    const candidates = await prisma.expense.findMany({
      where: { userId },
      select: { id: true, name: true, vendorName: true, amount: true, propertyId: true, loanId: true, assetId: true },
      orderBy: { createdAt: 'asc' },
    });
    const match = classifyIntake({
      kind: 'expense',
      source: 'DOCUMENT_IMPORT',
      declaredFrequency: 'MONTHLY', // frequency is irrelevant to stream matching
      streamPolicy: 'source-signature',
      candidate: { name, amount, scopeKey: propertyId ?? loanId ?? assetId ?? null },
      existingRows: candidates.map((e) => ({
        id: e.id,
        name: e.name,
        vendorName: e.vendorName,
        amount: e.amount,
        scopeKey: e.propertyId ?? e.loanId ?? e.assetId ?? null,
      })),
    }).streamMatch;
    if (!match) return NO_MATCH;
    // The doc-import EXPENSE contract stays AMOUNT-BOUNDED (deliberately
    // conservative — same name at a FAR amount is two real costs, e.g. two
    // different battery purchases; the user is in the confirm loop and can
    // always create). The ONE canonical decision re-checks the bound; income
    // deliberately has no such bound — a declared row and its reconciled twin
    // legitimately differ in amount.
    const matchedRow = candidates.find((e) => e.id === match.id);
    if (!matchedRow || !isNearDuplicateEntry({ name, amount }, matchedRow)) return NO_MATCH;
    return { duplicate: true, existingId: match.id };
  }

  if (type === 'INCOME') {
    const incomeType = data.type ? String(data.type).toUpperCase() : undefined;
    // Mechanism A (MON-084/076): the old exact `amount+name+type` findFirst
    // never matched a declared row against its reconciled twin (amounts
    // differ), so document confirms minted duplicate income sources. The ONE
    // classifier's source-signature policy matches on normalised name (exact
    // or near-duplicate) within the same type, with the scope-compatibility
    // rule (propertyId/investmentAccountId scope must agree or one side be
    // scopeless) — so Lot-1 vs Lot-2 rent never converge.
    const candidates = await prisma.income.findMany({
      where: { userId, ...(incomeType ? { type: incomeType as never } : {}) },
      select: { id: true, name: true, amount: true, propertyId: true, investmentAccountId: true },
      orderBy: { createdAt: 'asc' },
    });
    const scopeKey = data.propertyId
      ? String(data.propertyId)
      : data.investmentAccountId
        ? String(data.investmentAccountId)
        : null;
    const match = classifyIntake({
      kind: 'income',
      source: 'DOCUMENT_IMPORT',
      declaredFrequency: 'MONTHLY', // frequency is irrelevant to stream matching
      streamPolicy: 'source-signature',
      candidate: { name, amount, scopeKey },
      existingRows: candidates.map((i) => ({
        id: i.id,
        name: i.name,
        amount: i.amount,
        scopeKey: i.propertyId ?? i.investmentAccountId ?? null,
      })),
    }).streamMatch;
    return match ? { duplicate: true, existingId: match.id } : NO_MATCH;
  }

  // LOAN — principal is the amount-equivalent; match on name + principal.
  const principal = asAmount(data.principal) ?? amount;
  const existing = await prisma.loan.findFirst({
    where: { userId, name, principal },
    select: { id: true },
  });
  return existing ? { duplicate: true, existingId: existing.id } : NO_MATCH;
}
