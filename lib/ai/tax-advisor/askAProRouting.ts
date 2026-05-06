/**
 * Phase 41h.4 — Ask-a-Pro routing helper.
 *
 * Maps the AI advisor's `profession` (`'ADVISER' | 'ACCOUNTANT' |
 * 'BROKER'`) to the Phase 32C marketplace `discipline` filter.
 *
 * **Boundary alignment** (Phase 41 §5 + D-2):
 *   - ADVISER → `FINANCIAL_ADVISOR` (AFSL — personal financial
 *     advice and product recommendations)
 *   - ACCOUNTANT → `TAX_AGENT` (TPB — personal tax advice;
 *     `ACCOUNTING_FIRM` listings appear too via union below)
 *   - BROKER → `MORTGAGE_BROKER` (NCCP — credit advice + product
 *     recommendations)
 *
 * The mapping is intentionally narrow: an advisory question routes
 * to AFSL-licensed professionals, a tax question routes to
 * TPB-registered agents, a credit question routes to NCCP-authorised
 * brokers. Reviewers reject any change that broadens the mapping
 * (e.g. routing AFSL questions to TPB-only agents).
 */

export type AdvisorProfession = 'ADVISER' | 'ACCOUNTANT' | 'BROKER';

/** Disciplines as used by the Phase 32C marketplace (`app/marketplace/page.tsx`). */
export type MarketplaceDiscipline =
  | 'FINANCIAL_ADVISOR'
  | 'MORTGAGE_BROKER'
  | 'ACCOUNTING_FIRM'
  | 'TAX_AGENT';

const PROFESSION_TO_DISCIPLINE: Record<AdvisorProfession, MarketplaceDiscipline> = {
  ADVISER: 'FINANCIAL_ADVISOR',
  ACCOUNTANT: 'TAX_AGENT',
  BROKER: 'MORTGAGE_BROKER',
};

/**
 * Map an `askAProRouting.profession` to the marketplace's
 * `discipline` filter value.
 */
export function professionToDiscipline(
  profession: AdvisorProfession,
): MarketplaceDiscipline {
  return PROFESSION_TO_DISCIPLINE[profession];
}

interface AskAProDeepLinkParams {
  profession: AdvisorProfession;
  /** The user's question — pre-fills the request form on the listing detail page. */
  question?: string;
  /** AI-generated reason for the routing — provides context to the user. */
  reason?: string;
}

/**
 * Build a deep link to the marketplace, pre-filtered to the right
 * profession + carrying the user's question + AI's routing reason
 * as URL params. The marketplace listing detail page can pick these
 * up to pre-fill the request submission form.
 *
 * URL params kept short for shareability + observable in browser
 * history. Sensitive context (CDR data) is NOT placed in the URL —
 * the user opts in to sharing snapshot context inside the request
 * form, never via URL.
 */
export function buildAskAProDeepLink(params: AskAProDeepLinkParams): string {
  const search = new URLSearchParams();
  search.set('discipline', professionToDiscipline(params.profession));
  if (params.question) search.set('question', params.question);
  if (params.reason) search.set('reason', params.reason);
  return `/marketplace?${search.toString()}`;
}
