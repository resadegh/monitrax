/**
 * Phase 51.1 — Loan-statement import (build increment 2).
 *
 * Parses a loan's OWN statement (QIF/CSV now → Basiq CDR `loan-interest` /
 * `loan-repayment` later) into the quarantined `LoanTransaction` ledger. These
 * rows NEVER enter categorisation or the spending view — that machinery operates
 * on `UnifiedTransaction` only. The matching engine (increment 3) later bridges
 * an offset-account `UnifiedTransaction` outflow to a `REPAYMENT_RECEIVED` row
 * here, and the tax split takes interest from the actual `INTEREST_CHARGED`
 * figure (offset makes a rate × balance estimate wrong — ATO).
 *
 * Reuses the existing canonical parsers (`lib/bank/parsers/*`) and the dedup
 * normalisation helper — no new parsing/normalisation logic (§12.1/§12.2).
 *
 * See docs/blueprint/PHASE_51_LOAN_LEDGER_AND_CATEGORISATION.md.
 */

import { createHash } from 'crypto';
import prisma from '@/lib/db';
import { parseQIF, isValidQIF } from '@/lib/bank/parsers/qif';
import { parseCSV } from '@/lib/bank/parsers/csv';
import { normaliseDescription } from '@/lib/bookkeeping/normaliseDescription';
import type { ParsedFile, RawTransaction } from '@/lib/bank/types';
import { LoanTransactionKind, TransactionDirection, TransactionSource } from '@prisma/client';

/**
 * Classify a parsed loan-statement row into a ledger kind. Keyword-first
 * (statement descriptions are explicit — "Interest charged", "Loan repayment",
 * "Redraw", "Account fee"), with a direction fallback: on a loan account a
 * credit (money IN) reduces the balance owed → repayment; a debit (money OUT /
 * charged) increases it → interest/fee.
 */
export function classifyLoanRow(raw: Pick<RawTransaction, 'description' | 'direction' | 'amount'>): LoanTransactionKind {
  const d = (raw.description ?? '').toLowerCase();
  if (/\bredraw\b/.test(d)) return LoanTransactionKind.REDRAW;
  if (/\binterest\b/.test(d)) return LoanTransactionKind.INTEREST_CHARGED;
  if (/\bfee\b|\bcharge\b/.test(d)) return LoanTransactionKind.FEE;
  if (/\brepay|\bpayment\b|\bdeposit\b|\bcredit\b/.test(d)) return LoanTransactionKind.REPAYMENT_RECEIVED;
  // Direction fallback.
  const dir = raw.direction ?? (typeof raw.amount === 'number' && raw.amount < 0 ? 'OUT' : 'IN');
  if (dir === 'IN') return LoanTransactionKind.REPAYMENT_RECEIVED;
  if (dir === 'OUT') return LoanTransactionKind.INTEREST_CHARGED;
  return LoanTransactionKind.OTHER;
}

/**
 * Deterministic dedup key for a loan-ledger row — hash(loanId + ISO date +
 * 2dp amount + normalised description). Mirrors the UnifiedTransaction dedup
 * approach so a re-imported overlapping statement doesn't double-up the ledger.
 */
export function computeLoanRowHash(input: {
  loanId: string;
  date: Date;
  amount: number;
  description?: string | null;
}): string {
  const desc = normaliseDescription(input.description);
  const key = `${input.loanId}|${input.date.toISOString().slice(0, 10)}|${input.amount.toFixed(2)}|${desc}`;
  return createHash('md5').update(key).digest('hex');
}

export interface MappedLoanRow {
  date: Date;
  amount: number;
  direction: TransactionDirection;
  kind: LoanTransactionKind;
  description: string | null;
  balanceAfter: number | null;
  contentHash: string;
}

/** Pure mapping: ParsedFile → loan-ledger rows (no DB, fully unit-testable). */
export function mapLoanStatement(loanId: string, parsed: ParsedFile): MappedLoanRow[] {
  const rows: MappedLoanRow[] = [];
  for (const t of parsed.transactions) {
    if (!t.date || typeof t.amount !== 'number') continue;
    const amount = Math.abs(t.amount);
    const direction: TransactionDirection =
      (t.direction as TransactionDirection | undefined) ?? (t.amount < 0 ? TransactionDirection.OUT : TransactionDirection.IN);
    rows.push({
      date: t.date,
      amount,
      direction,
      kind: classifyLoanRow(t),
      description: t.description ?? null,
      balanceAfter: typeof t.balance === 'number' ? t.balance : null,
      contentHash: computeLoanRowHash({ loanId, date: t.date, amount, description: t.description }),
    });
  }
  return rows;
}

/** Pick the parser by extension / content sniff (QIF vs CSV). */
export function parseLoanStatement(fileName: string, content: string): { parsed: ParsedFile; source: TransactionSource } {
  if (fileName.toLowerCase().endsWith('.qif') || isValidQIF(content)) {
    return { parsed: parseQIF(content), source: TransactionSource.QIF };
  }
  return { parsed: parseCSV(content), source: TransactionSource.CSV };
}

export interface LoanImportResult {
  total: number; // rows parsed + mappable
  imported: number; // rows written
  skipped: number; // duplicates skipped
  byKind: Partial<Record<LoanTransactionKind, number>>;
}

/**
 * Import a loan statement into the loan's ledger. Dedups against rows already in
 * the ledger for this loan (by contentHash), then bulk-creates the rest. The
 * caller (the API route) verifies loan ownership first.
 */
export async function importLoanStatement(args: {
  userId: string;
  loanId: string;
  fileName: string;
  content: string;
  importBatchId?: string;
}): Promise<LoanImportResult> {
  const { userId, loanId, fileName, content, importBatchId } = args;
  const { parsed, source } = parseLoanStatement(fileName, content);
  const mapped = mapLoanStatement(loanId, parsed);

  const existing = await prisma.loanTransaction.findMany({
    where: { loanId, userId },
    select: { contentHash: true },
  });
  const seen = new Set(existing.map((e) => e.contentHash).filter((h): h is string => Boolean(h)));

  const toCreate: Array<{
    userId: string;
    loanId: string;
    date: Date;
    amount: number;
    direction: TransactionDirection;
    kind: LoanTransactionKind;
    description: string | null;
    balanceAfter: number | null;
    contentHash: string;
    source: TransactionSource;
    importBatchId?: string;
  }> = [];
  const byKind: Partial<Record<LoanTransactionKind, number>> = {};
  let skipped = 0;

  for (const r of mapped) {
    if (seen.has(r.contentHash)) {
      skipped++;
      continue;
    }
    seen.add(r.contentHash);
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    toCreate.push({ ...r, userId, loanId, source, importBatchId });
  }

  if (toCreate.length > 0) {
    await prisma.loanTransaction.createMany({ data: toCreate });
  }

  return { total: mapped.length, imported: toCreate.length, skipped, byKind };
}
