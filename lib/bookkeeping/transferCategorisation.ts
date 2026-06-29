/**
 * SSOT for the field-set written when a transaction is confirmed as a
 * transfer / internal money movement — including loan repayments.
 *
 * Marking a transfer is TWO things at once:
 *   1. an EXCLUSION — `isTransfer=true` so the money is out of spend/income
 *      (CLAUDE.md §19.1: a transfer is neither earned nor spent), AND
 *   2. a CATEGORISATION + CONFIRMATION — it must also set `categoryLevel1`
 *      ('Transfer'), `userCorrectedCategory=true` and `confidenceScore=1.0`
 *      so the row leaves the "Uncategorised", "Not confirmed yet" and
 *      low-confidence-band review surfaces.
 *
 * Before this helper the five transfer-marking paths each set a DIFFERENT
 * subset of those fields (the loan-link paths set only `isTransfer`), so a
 * loan repayment that was correctly marked `isTransfer=true` still rendered
 * as "Uncategorised / Not confirmed yet" in the Activity band-lens. One
 * canonical definition (CLAUDE.md §12.2.1 — one source for one concept)
 * keeps every path consistent.
 *
 * @param opts.level2 sub-category — 'Loan repayment' for loan-ledger links,
 *                    defaults to 'Internal' for plain account-to-account moves.
 */
export function confirmedTransferFields(opts?: { level2?: string }) {
  return {
    isTransfer: true,
    categoryLevel1: 'Transfer',
    categoryLevel2: opts?.level2 ?? 'Internal',
    userCorrectedCategory: true,
    confidenceScore: 1.0,
  } as const;
}

// =============================================================================
// Transfer-DESCRIPTION recognition — the SSOT for "does this description look
// like an internal transfer?" (CLAUDE.md §12.2.1)
// =============================================================================

/**
 * THE single source for transfer-DESCRIPTION recognition. Before this, three
 * divergent vocabularies disagreed and none was canonical, so every new bank
 * description format slipped through one of them — the recurring "transfers
 * aren't auto-recognised" bug:
 *   - the cascade rule `transfer_internal` (lib/tie/categorisation.ts) matched
 *     only `transfer (to|from|between)` — keyword BEFORE the direction word, so
 *     "To Reza Sadegh 20may Transfer" (keyword at the END) was NOT recognised
 *     and rendered Uncategorised;
 *   - `lib/tie/ingestion.ts` had its own `^transfer (to|from)` (anchored at the
 *     start) list whose `isTransferTransaction()` had no callers;
 *   - `lib/cashflow/forecasting.ts` has a broad `/transfer/i` list (forecaster
 *     only — a transfer-OR-loan concern, deliberately separate).
 *
 * Scope: answers ONLY "is the free-text description a transfer?" — a SUGGESTION
 * signal used at categorisation time. It does NOT set `isTransfer` (the
 * spend/income exclusion flag), which is only ever written on explicit user
 * confirmation (§19.1 + the "AI suggests, user confirms" autonomy contract), so
 * broadening recall here can never silently exclude real spend.
 *
 * Word-boundaried to keep false positives low: `\btransfer\b` matches
 * "... Transfer" / "Transfer to ..." / "Internal Transfer" but NOT
 * "TransferWise". Direct-debit/credit is EXCLUDED — most direct debits are bill
 * payments (real expenses), not internal transfers.
 */
export const TRANSFER_DESCRIPTION_PATTERNS: readonly RegExp[] = [
  /\btransfer\b/i, // "Transfer", "Transfer to X", "To X ... Transfer", "Balance Transfer"
  /\b(tfr|trf)\b/i, // common bank abbreviations
  /\binternal\s+(transfer|account|tfr|trf)\b/i, // "Internal transfer / account"
  /\binter[-\s]?account\b/i, // "Inter-account", "Inter account"
  /\bosko\b/i, // Osko (NPP) — almost always a person-to-person/account move
  /\bpay\s?id\b/i, // PayID
  /\bpay\s+(anyone|someone)\b/i, // "Pay Anyone" / "Pay Someone"
  /\bbpay\b/i, // BPAY
] as const;

/**
 * True when the description reads like an internal transfer / account-to-account
 * move. Used by the categorisation cascade to SUGGEST the `Transfers` category
 * (one-tap confirm) — not to exclude from spend.
 */
export function isTransferDescription(text: string | null | undefined): boolean {
  if (!text) return false;
  return TRANSFER_DESCRIPTION_PATTERNS.some((re) => re.test(text));
}
