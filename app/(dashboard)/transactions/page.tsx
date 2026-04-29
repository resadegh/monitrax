/**
 * Legacy /transactions URL.
 *
 * Phase 36: All Transaction Explorer functionality (categorisation, link
 * dialog, import wizard, filters, pagination) has moved to /dashboard/activity
 * with an Apple-style visual redesign — same hooks, same handlers, same
 * dialogs. This file is kept as a permanent redirect so any bookmark or
 * internal link targeting /transactions continues to work.
 *
 * Do NOT add UI here. Edit the new home: app/dashboard/activity/page.tsx
 */

import { redirect } from 'next/navigation';

export default function TransactionsRedirect() {
  redirect('/dashboard/activity');
}
