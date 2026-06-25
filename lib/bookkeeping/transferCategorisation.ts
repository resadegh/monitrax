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
