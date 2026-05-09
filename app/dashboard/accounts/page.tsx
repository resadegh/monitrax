/**
 * /dashboard/accounts — redirect to /dashboard/balances (Phase 36 Phase 2d).
 *
 * The legacy My Accounts list page has been retired. All account data,
 * Cash / Credit / Debt sections, Connect Bank, and Add Account UI
 * now live on `/dashboard/balances`. This page redirects any straggler
 * traffic (bookmarks, deep links, search-engine cache) to the new home.
 *
 * The matchRoutes alias in `lib/navigation/trailNav.tsx` keeps the
 * sidebar highlight correct for any remaining old-URL traffic.
 *
 * Query-param patterns like `?action=connect-basiq` / `?action=add`
 * are handled at the Balances page directly (Phase 36 Phase 2b);
 * source-side hrefs were flipped to `/dashboard/balances?action=...`
 * in the same PR that shipped this redirect.
 *
 * @see docs/blueprint/PHASE_36_MY_ACCOUNTS_SIMPLIFICATION.md §8 Phase 2d
 */

import { redirect } from 'next/navigation';

export default function AccountsRedirectPage() {
  redirect('/dashboard/balances');
}
