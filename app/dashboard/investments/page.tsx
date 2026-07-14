/**
 * /dashboard/investments — redirect to /dashboard/investments/accounts (MON-046).
 *
 * The Investments section is a tabbed area (accounts / holdings / super /
 * transactions) with no page at the bare `/dashboard/investments` path, so any
 * link to the bare route 404'd. Four callers pointed here — the CFO "Investment
 * Opportunities" tile, `components/documents/DocumentList.tsx`, and the sidebar
 * nav (`lib/navigation/trailNav.tsx` ×2) — every one a dead-end (CLAUDE.md §6.7
 * "no dead-ends"). This landing redirects bare-route traffic to the canonical
 * Accounts tab, fixing all callers at the source (§12.1 root-cause, not
 * per-caller patching). Mirrors the `/dashboard/accounts` → `/dashboard/balances`
 * redirect pattern.
 *
 * Surfaced by the MON-044 dead-link Ratchet (tests/dashboard/cfoTileLinks.test.ts).
 */

import { redirect } from 'next/navigation';

export default function InvestmentsRedirectPage() {
  redirect('/dashboard/investments/accounts');
}
