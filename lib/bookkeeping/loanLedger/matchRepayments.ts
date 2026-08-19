/**
 * Phase 51.1 — Loan repayment matching engine (build increment 3).
 *
 * Bridges the two ledgers: an offset-account `UnifiedTransaction` OUT-flow ↔ a
 * loan's `REPAYMENT_RECEIVED` row. Per the research (PocketSmith reference +
 * Xero/YNAB confirmation), we match the ACTUAL loan-ledger transaction against
 * the ACTUAL offset outflow — never a predicted/fixed amount — because
 * interest-only repayments vary monthly (days, offset, rate). Match signal:
 * amount + date proximity + direction; **ambiguous/weak matches are left for the
 * user to review (lower confidence), never silently auto-applied.**
 *
 * On confirm: the loan repayment is LINKED, and the offset outflow is marked a
 * transfer (`isTransfer=true`) so its principal is excluded from spending; the
 * interest portion (taken from the actual INTEREST_CHARGED figure) becomes the
 * deductible expense — that derivation lands with the Repayments tab (increment 4).
 *
 * See docs/blueprint/PHASE_51_LOAN_LEDGER_AND_CATEGORISATION.md.
 */

import prisma from '@/lib/db';
import { resolveLinkPropertyId } from '@/lib/bookkeeping/propertyLink';
import { LoanMatchStatus } from '@prisma/client';
import { confirmedTransferFields } from '@/lib/bookkeeping/transferCategorisation';

export interface RepaymentRow {
  id: string;
  date: Date;
  amount: number; // absolute
}

export interface OutflowRow {
  id: string;
  date: Date;
  amount: number; // absolute
}

export interface MatchSuggestion {
  loanTransactionId: string;
  matchedTransactionId: string;
  confidence: number; // 0-1
  reason: string; // human cue for the confirm queue
}

export interface MatchOptions {
  /** Max |date difference| in days for a candidate. PocketSmith-style small window. */
  dateToleranceDays?: number;
  /** Dollars of amount difference tolerated for a *weak* (review) match. Exact = high confidence. */
  nearAmountDollars?: number;
}

const DEFAULTS: Required<MatchOptions> = { dateToleranceDays: 4, nearAmountDollars: 5 };

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/**
 * Pure matcher. Greedily pairs each repayment to its best unused offset outflow.
 * Returns suggestions ONLY where a candidate is within tolerance — anything else
 * stays unmatched (the "leave unmarked when ambiguous" rule). Confidence tiers:
 *   - exact amount + same day            → 0.98
 *   - exact amount + within window       → 0.9 - 0.06·days (≥ 0.66)
 *   - near amount (≤ nearAmountDollars)  → 0.5 (review — "needs a look")
 * Ambiguity (≥2 equally-good exact candidates) caps confidence at 0.6 so the UI
 * surfaces it for review rather than pre-selecting it.
 */
export function matchLoanRepayments(
  repayments: RepaymentRow[],
  outflows: OutflowRow[],
  options: MatchOptions = {}
): MatchSuggestion[] {
  const { dateToleranceDays, nearAmountDollars } = { ...DEFAULTS, ...options };
  const used = new Set<string>();
  const suggestions: MatchSuggestion[] = [];

  // Match the most date-stable first (sorted) for determinism.
  const sorted = [...repayments].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const rp of sorted) {
    const exact = outflows.filter(
      (o) => !used.has(o.id) && Math.abs(o.amount - rp.amount) < 0.005 && daysBetween(o.date, rp.date) <= dateToleranceDays
    );
    const candidates = exact.length > 0
      ? exact
      : outflows.filter(
          (o) =>
            !used.has(o.id) &&
            Math.abs(o.amount - rp.amount) <= nearAmountDollars &&
            daysBetween(o.date, rp.date) <= dateToleranceDays
        );

    if (candidates.length === 0) continue; // unmatched — left for the ledger, no suggestion

    // Best = closest in date.
    candidates.sort((a, b) => daysBetween(a.date, rp.date) - daysBetween(b.date, rp.date));
    const best = candidates[0];
    used.add(best.id);

    const days = Math.round(daysBetween(best.date, rp.date));
    const isExact = Math.abs(best.amount - rp.amount) < 0.005;
    let confidence: number;
    let reason: string;
    if (isExact && days === 0) {
      confidence = 0.98;
      reason = 'Exact match · same day';
    } else if (isExact) {
      confidence = Math.max(0.66, 0.9 - 0.06 * days);
      reason = `Exact amount · ${days} day${days === 1 ? '' : 's'} apart`;
    } else {
      confidence = 0.5;
      const diff = Math.abs(best.amount - rp.amount);
      reason = `Amount differs by $${diff.toFixed(2)} — interest-only repayment varies`;
    }
    // Ambiguity: more than one exact candidate → don't pre-select.
    if (isExact && exact.length > 1) {
      confidence = Math.min(confidence, 0.6);
      reason = `${exact.length} possible matches · ${reason.toLowerCase()}`;
    }

    suggestions.push({ loanTransactionId: rp.id, matchedTransactionId: best.id, confidence, reason });
  }

  return suggestions;
}

/**
 * Orchestration: compute + persist SUGGESTED matches for a loan's unmatched
 * repayments against its offset account's unmatched outflows. §12.11-safe — only
 * writes rows this path manages and only those still UNMATCHED (never clobbers a
 * user's LINKED/DISMISSED decision).
 */
export async function suggestMatchesForLoan(userId: string, loanId: string): Promise<MatchSuggestion[]> {
  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId },
    select: { id: true, offsetAccountId: true },
  });
  if (!loan?.offsetAccountId) return []; // no offset linked → nothing to match against

  const repayments = await prisma.loanTransaction.findMany({
    where: { userId, loanId, kind: 'REPAYMENT_RECEIVED', matchStatus: 'UNMATCHED' },
    select: { id: true, date: true, amount: true },
  });
  if (repayments.length === 0) return [];

  const outflows = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      accountId: loan.offsetAccountId,
      direction: 'OUT',
      isTransfer: false,
      matchedLoanRepayment: null, // not already linked to a loan
    },
    select: { id: true, date: true, amount: true },
  });

  const suggestions = matchLoanRepayments(
    repayments.map((r) => ({ id: r.id, date: r.date, amount: Math.abs(r.amount) })),
    outflows.map((o) => ({ id: o.id, date: o.date, amount: Math.abs(o.amount) }))
  );

  // Persist as SUGGESTED (guarded: only rows still UNMATCHED).
  await prisma.$transaction(
    suggestions.map((s) =>
      prisma.loanTransaction.updateMany({
        where: { id: s.loanTransactionId, userId, matchStatus: 'UNMATCHED' },
        data: { matchStatus: 'SUGGESTED', matchConfidence: s.confidence, matchedTransactionId: s.matchedTransactionId },
      })
    )
  );

  return suggestions;
}

/**
 * Confirm or dismiss a suggested match.
 *  - accept: LINKED; mark the offset outflow `isTransfer=true` (principal excluded
 *    from spending). §12.11-safe — only flips a SUGGESTED row this user owns.
 *  - reject: DISMISSED; clears the link.
 */
export async function resolveRepaymentMatch(
  userId: string,
  loanTransactionId: string,
  accept: boolean
): Promise<{ ok: boolean }> {
  const row = await prisma.loanTransaction.findFirst({
    where: { id: loanTransactionId, userId },
    select: { id: true, matchStatus: true, matchedTransactionId: true },
  });
  if (!row || row.matchStatus !== LoanMatchStatus.SUGGESTED) return { ok: false };

  if (accept) {
    await prisma.$transaction(async (tx) => {
      await tx.loanTransaction.update({ where: { id: row.id }, data: { matchStatus: 'LINKED' } });
      if (row.matchedTransactionId) {
        // Mark the funding offset outflow as a transfer (out of spending).
        await tx.unifiedTransaction.updateMany({
          where: { id: row.matchedTransactionId, userId },
          // Loan repayment confirmed → fully categorise + confirm it so it
          // leaves the Uncategorised / Not-confirmed review surfaces (§12.2.1).
          data: confirmedTransferFields({ level2: 'Loan repayment' }),
        });
      }
    });
  } else {
    await prisma.loanTransaction.update({
      where: { id: row.id },
      data: { matchStatus: 'DISMISSED', matchedTransactionId: null, matchConfidence: null },
    });
  }
  return { ok: true };
}

/**
 * Phase 51.2 — confirm a loan-repayment ↔ transaction link from the ACTIVITY
 * reconcile surface (the user picked a specific offset/funding transaction in the
 * Link dialog). Unlike `resolveRepaymentMatch` (loan-side, requires a prior
 * SUGGESTED row), this links an explicit (loanTransaction, transaction) pair the
 * resolution engine surfaced — works whether the ledger row was UNMATCHED or
 * SUGGESTED.
 *
 * Effect: LoanTransaction → LINKED (+ matchedTransactionId); the funding
 * UnifiedTransaction → isTransfer=true (principal out of spending) + loanId set
 * (GRDCS link to the loan). §12.11-safe — both sides scoped to rows this user
 * owns; the action IS the user's explicit confirmation in the dialog.
 */
export async function linkRepaymentToTransaction(
  userId: string,
  loanTransactionId: string,
  transactionId: string
): Promise<{ ok: boolean }> {
  const [row, txn] = await Promise.all([
    prisma.loanTransaction.findFirst({
      where: { id: loanTransactionId, userId, kind: 'REPAYMENT_RECEIVED' },
      select: { id: true, loanId: true },
    }),
    prisma.unifiedTransaction.findFirst({
      where: { id: transactionId, userId },
      select: { id: true },
    }),
  ]);
  if (!row || !txn) return { ok: false };

  // MON-168: resolve the loan's property attribution via the ONE rule.
  const linkPropertyId = await resolveLinkPropertyId(userId, { loanId: row.loanId });

  await prisma.$transaction(async (tx) => {
    await tx.loanTransaction.update({
      where: { id: row.id },
      data: {
        matchStatus: LoanMatchStatus.LINKED,
        matchedTransactionId: transactionId,
        matchConfidence: 1,
      },
    });
    await tx.unifiedTransaction.updateMany({
      where: { id: transactionId, userId },
      // Loan repayment linked → fully categorise + confirm (§12.2.1) so it
      // doesn't linger as "Uncategorised / Not confirmed yet".
      // MON-168: stamp the loan's property so the pack can attribute the row.
      data: {
        ...confirmedTransferFields({ level2: 'Loan repayment' }),
        loanId: row.loanId,
        propertyId: linkPropertyId,
      },
    });
  });
  return { ok: true };
}
