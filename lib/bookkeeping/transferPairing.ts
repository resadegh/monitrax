/**
 * Phase 42 PR6.5i — Transfer auto-pairing.
 *
 * Per Reza directive 2026-05-08: when a user marks a transaction as
 * Transfer with a destination account (via the swipe-right
 * `<TransferDestinationSheet />` flow), the system should auto-find
 * and tag the *matching* arrival transaction on the destination
 * account so analytics/aggregators don't double-count.
 *
 * Architecture (per CLAUDE.md §12.3 — SSOT + single calc engine):
 *   - This file is the **only** place that pairs transfer
 *     transactions. PATCH endpoint composes it; no parallel logic
 *     anywhere else.
 *   - Aggregators (`lib/calculations/*`) are unchanged — they read
 *     `Expense` / `Income` / `Loan` rows, NOT `UnifiedTransaction`,
 *     so pairing is a data-normalisation concern, not a calc one.
 *     The Activity summary tiles in `lib/tie/analytics.ts` already
 *     filter `!tx.isTransfer` so once both sides are tagged, both
 *     drop out of those totals automatically.
 *   - Per CLAUDE.md §12.10 — pairing is best-effort: if the matching
 *     tx isn't found OR multiple candidates exist, we leave the
 *     destination side alone. The source-side tag is the canonical
 *     `isTransfer=true` mark; pairing is an optimisation, not a
 *     correctness requirement.
 *
 * Matching criteria (strict — keeps false-pair rate near zero):
 *   1. Same `userId`
 *   2. `accountId === source.transferToAccountId` (it's on the
 *      destination account)
 *   3. Opposite `direction` (source OUT → destination IN, or vice
 *      versa)
 *   4. Absolute amount matches within $0.01 tolerance
 *   5. Date within ± `MATCH_WINDOW_DAYS` of source date
 *   6. Not already marked `isTransfer=true` (don't re-pair)
 *   7. Not linked to any Expense/Income/Loan (not yet categorised
 *      as something else)
 *
 * If exactly **one** candidate matches all 7 criteria, we tag it
 * symmetrically. If zero or multiple → skip and let the user mark
 * the other side manually. This avoids the false-pair class of
 * bugs where the wrong CC payment gets paired with the wrong bank
 * withdrawal.
 */

import prisma from '@/lib/db';
import type { UnifiedTransaction, TransactionDirection } from '@prisma/client';

/** Match window in days (± from source date). */
export const TRANSFER_PAIR_WINDOW_DAYS = 3;

/** Amount tolerance in dollars. */
export const TRANSFER_PAIR_AMOUNT_TOLERANCE = 0.01;

interface TxLite {
  id: string;
  userId: string;
  accountId: string;
  date: Date;
  amount: number;
  direction: TransactionDirection;
  isTransfer: boolean;
  expenseId: string | null;
  incomeId: string | null;
  loanId: string | null;
}

/**
 * Pure matching predicate — given a source tx and a list of
 * candidates, return the candidates that satisfy all pairing
 * criteria. Exported for tests.
 */
export function filterPairCandidates(
  source: TxLite,
  destinationAccountId: string,
  candidates: TxLite[],
  now: Date = new Date(),
): TxLite[] {
  const sourceTime = source.date.getTime();
  const windowMs = TRANSFER_PAIR_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const sourceAbs = Math.abs(source.amount);
  const oppositeDirection: TransactionDirection = source.direction === 'IN' ? 'OUT' : 'IN';

  return candidates.filter((c) => {
    // (1) same user
    if (c.userId !== source.userId) return false;
    // (2) on destination account
    if (c.accountId !== destinationAccountId) return false;
    // (3) opposite direction
    if (c.direction !== oppositeDirection) return false;
    // (4) absolute amount within tolerance.
    // Compare in CENTS to dodge JS float precision (e.g. 100.01 - 100
    // = 0.0100000000000005 which fails a naive > 0.01 check).
    const diffCents = Math.round(Math.abs(Math.abs(c.amount) - sourceAbs) * 100);
    const toleranceCents = Math.round(TRANSFER_PAIR_AMOUNT_TOLERANCE * 100);
    if (diffCents > toleranceCents) return false;
    // (5) date within window
    const dt = Math.abs(c.date.getTime() - sourceTime);
    if (dt > windowMs) return false;
    // (6) not already a transfer
    if (c.isTransfer) return false;
    // (7) not already linked to an entity
    if (c.expenseId || c.incomeId || c.loanId) return false;
    // exclude self-match (defensive — should never hit because
    // accountId differs, but cheap guard)
    if (c.id === source.id) return false;
    // unused param silencing
    void now;
    return true;
  });
}

/**
 * Side-effect: find the matching destination-side tx and mark it
 * `isTransfer=true` with `transferToAccountId={source.accountId}`.
 *
 * - Returns the paired tx ID if a unique match was found and tagged.
 * - Returns `null` if zero matches OR multiple matches (we don't
 *   guess — Reza directive 2026-05-08 "no false pairs").
 *
 * Idempotent: re-running on a tx that's already been paired is a
 * no-op because criterion (6) excludes already-tagged candidates.
 *
 * Per CLAUDE.md §12.11 — the only `prisma.update` here is on the
 * uniquely-matched destination tx, which is owned by the same
 * `userId` (criterion 1) and not yet tagged (criterion 6). Safe.
 */
export async function pairTransferIfPossible(
  sourceId: string,
  destinationAccountId: string,
): Promise<string | null> {
  const source = await prisma.unifiedTransaction.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      userId: true,
      accountId: true,
      date: true,
      amount: true,
      direction: true,
      isTransfer: true,
      expenseId: true,
      incomeId: true,
      loanId: true,
    },
  });
  if (!source) return null;

  // Pre-filter at DB level — narrow candidate set before applying
  // the strict matching predicate. Index-friendly: userId + date
  // range + accountId.
  const sourceTime = source.date.getTime();
  const windowMs = TRANSFER_PAIR_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const dateLow = new Date(sourceTime - windowMs);
  const dateHigh = new Date(sourceTime + windowMs);
  const oppositeDirection: TransactionDirection = source.direction === 'IN' ? 'OUT' : 'IN';

  const dbCandidates = await prisma.unifiedTransaction.findMany({
    where: {
      userId: source.userId,
      accountId: destinationAccountId,
      direction: oppositeDirection,
      isTransfer: false,
      expenseId: null,
      incomeId: null,
      loanId: null,
      date: { gte: dateLow, lte: dateHigh },
    },
    select: {
      id: true,
      userId: true,
      accountId: true,
      date: true,
      amount: true,
      direction: true,
      isTransfer: true,
      expenseId: true,
      incomeId: true,
      loanId: true,
    },
  });

  const matches = filterPairCandidates(source, destinationAccountId, dbCandidates);

  if (matches.length !== 1) {
    // Zero or multiple — don't guess. User can mark the other
    // side manually. Reza directive: no false pairs.
    return null;
  }

  const match = matches[0];
  await prisma.unifiedTransaction.update({
    where: { id: match.id },
    data: {
      isTransfer: true,
      transferToAccountId: source.accountId,
      categoryLevel1: 'Transfer',
      categoryLevel2: 'Internal',
    },
  });
  return match.id;
}
