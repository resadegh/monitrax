/**
 * MY ACCOUNTS → ACTIVITY → Review (Phase 56.8, Reza 2026-06-30)
 *
 * RETIRED as a separate surface. Per the review-IA consolidation, "Review" is
 * now the ONE transaction list filtered to uncategorised — not a second,
 * separately-designed inbox (which caused the duplicate-list drift, e.g. the
 * 69% vs 54% "% categorised" split). This route now redirects to the canonical
 * Activity surface with the review deep-link, which opens the filtered list on
 * desktop and the card-deck on mobile.
 *
 * Follow-up (56.11): delete the now-orphaned `ReviewCategoriesInbox` component.
 */

import { redirect } from 'next/navigation';

export default function ReviewCategoriesPage() {
  redirect('/dashboard/activity?review=1');
}
