/**
 * Phase 51.2 — Transaction Resolution Precedence (reconcile-surface increment).
 *
 * Reza's directive (2026-06-22): "AI recognition on categorisation for any
 * transaction should check ALL accounts for the user first to see if the
 * transaction is a transfer, or a loan repayment, etc BEFORE hitting the KB
 * engine for categorisation."
 *
 * This service answers "what IS this transaction, structurally?" by matching it
 * against the user's own accounts + ledgers — BEFORE any merchant/KB
 * categorisation. It is the missing bridge between the Phase 51 loan ledger and
 * the Activity reconcile/link dialog (which previously only matched loans by
 * `loan.minRepayment` — 0 for interest-only — so it could never recognise a
 * repayment, and fell back to batching all same-description payments together,
 * the exact problem Phase 51 set out to solve).
 *
 * Suggest-first (Reza decision 2026-06-22): we return candidates ranked by
 * confidence; the UI surfaces them and the user confirms. Exact amount + same-day
 * matches are high confidence and pre-selectable; nothing is auto-applied here.
 *
 * Resolution order (the precedence): loan repayment → internal transfer → (later)
 * investment contribution → merchant categorisation. This module covers the first
 * two; wiring it ahead of rules/KB at import time is the follow-up increment.
 *
 * See docs/blueprint/PHASE_51_LOAN_LEDGER_AND_CATEGORISATION.md.
 */

import prisma from '@/lib/db';
import { LoanMatchStatus } from '@prisma/client';

/** Date window for amount+date proximity matching (mirrors the ledger matcher). */
const DATE_WINDOW_DAYS = 4;
/** Exact-amount epsilon (dollars). */
const EXACT_EPS = 0.005;

export interface LoanRepaymentMatch {
  kind: 'LOAN_REPAYMENT';
  loanTransactionId: string;
  loanId: string;
  loanName: string;
  amount: number;
  date: string;
  interestPortion: number | null;
  confidence: number;
}

export interface TransferMatch {
  kind: 'TRANSFER';
  transactionId: string;
  accountId: string;
  accountName: string;
  amount: number;
  date: string;
  confidence: number;
}

export interface ResolutionResult {
  loanRepayments: LoanRepaymentMatch[];
  transfers: TransferMatch[];
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / 86_400_000;
}

/** exact + same day → 0.98; exact within window → 0.9 − 0.06·days (≥ 0.66). */
function confidenceFor(txnDate: Date, candidateDate: Date): number {
  const days = Math.round(daysBetween(txnDate, candidateDate));
  if (days === 0) return 0.98;
  return Math.max(0.66, 0.9 - 0.06 * days);
}

/**
 * Resolve a transaction against the user's own loans + accounts. Returns
 * loan-repayment and transfer candidates (empty arrays when none) — never throws
 * into the caller's hot path; callers treat a failure as "no resolution".
 */
export async function resolveTransactionMatches(
  userId: string,
  transactionId: string
): Promise<ResolutionResult> {
  const empty: ResolutionResult = { loanRepayments: [], transfers: [] };

  const txn = await prisma.unifiedTransaction.findFirst({
    where: { id: transactionId, userId },
    select: { id: true, amount: true, date: true, direction: true, accountId: true },
  });
  if (!txn) return empty;

  const amt = Math.abs(txn.amount);
  const lo = new Date(txn.date);
  lo.setDate(lo.getDate() - DATE_WINDOW_DAYS);
  const hi = new Date(txn.date);
  hi.setDate(hi.getDate() + DATE_WINDOW_DAYS);

  // --- 1. Loan repayment (only an OUT can be a repayment leaving an account) ---
  // Matches the imported loan ledger across ALL the user's loans by exact amount
  // + date window — this is what disambiguates same-description repayments to
  // DIFFERENT loans (the offset-account-name collision Reza hit).
  let loanRepayments: LoanRepaymentMatch[] = [];
  if (txn.direction === 'OUT') {
    const rows = await prisma.loanTransaction.findMany({
      where: {
        userId,
        kind: 'REPAYMENT_RECEIVED',
        matchStatus: { in: [LoanMatchStatus.UNMATCHED, LoanMatchStatus.SUGGESTED] },
        date: { gte: lo, lte: hi },
      },
      select: {
        id: true,
        loanId: true,
        amount: true,
        date: true,
        interestPortion: true,
        loan: { select: { name: true } },
      },
      take: 50,
    });
    loanRepayments = rows
      .filter((r) => Math.abs(Math.abs(r.amount) - amt) < EXACT_EPS)
      .map((r) => ({
        kind: 'LOAN_REPAYMENT' as const,
        loanTransactionId: r.id,
        loanId: r.loanId,
        loanName: r.loan.name,
        amount: Math.abs(r.amount),
        date: r.date.toISOString(),
        interestPortion: r.interestPortion,
        confidence: confidenceFor(txn.date, r.date),
      }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  // --- 2. Internal transfer (opposite-direction sibling in another account) ---
  const opposite = txn.direction === 'OUT' ? 'IN' : 'OUT';
  const siblings = await prisma.unifiedTransaction.findMany({
    where: {
      userId,
      accountId: { not: txn.accountId },
      direction: opposite,
      isTransfer: false,
      date: { gte: lo, lte: hi },
    },
    select: {
      id: true,
      amount: true,
      date: true,
      accountId: true,
      account: { select: { name: true } },
    },
    take: 50,
  });
  const transfers: TransferMatch[] = siblings
    .filter((r) => Math.abs(Math.abs(r.amount) - amt) < EXACT_EPS)
    .map((r) => ({
      kind: 'TRANSFER' as const,
      transactionId: r.id,
      accountId: r.accountId,
      accountName: r.account?.name ?? 'Account',
      amount: Math.abs(r.amount),
      date: r.date.toISOString(),
      confidence: confidenceFor(txn.date, r.date),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  return { loanRepayments, transfers };
}
