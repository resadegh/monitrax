/**
 * /dashboard/loans — redirect to /dashboard/balances (Phase 36 Phase 2e).
 *
 * The legacy Loans list page has been retired. The Debt section on
 * `/dashboard/balances` now hosts the full loan list, with the inline
 * `<LoanDetailDialog>` (Phase 36 Phase 2a, PR #601) covering detail
 * drill-in.
 *
 * Sub-routes are PRESERVED and continue to work:
 *   - `/dashboard/loans/[id]` — loan detail full-page view (intact)
 *   - `/dashboard/loans/[id]/strategy` — debt-strategy planner (intact)
 *
 * Only the bare list page (`/dashboard/loans`) redirects. Any deep link
 * to a specific loan continues to render its dedicated detail page.
 *
 * Query-param patterns like `?action=add` are handled at the Balances
 * page directly (Phase 36 Phase 2b); source-side hrefs were flipped
 * to `/dashboard/balances?action=add-loan` in the same PR.
 *
 * @see docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md §8 Phase 2e
 */

import { redirect } from 'next/navigation';

export default function LoansRedirectPage() {
  redirect('/dashboard/balances');
}
