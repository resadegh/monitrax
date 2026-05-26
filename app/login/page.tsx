/**
 * `/login` → `/signin` permanent redirect.
 *
 * Phase 48 PR 1 (Foundation, 2026-05-26): the previous `/login` page was a
 * 282-line duplicate of `/signin` — same `useAuth()` calls, same form, same
 * MFA + OAuth paths, drifted copy. Consolidated to `/signin` (the canonical
 * consumer auth route — every OAuth callback at `app/api/auth/callback/*`
 * already routes there) and replaced with this redirect so existing
 * bookmarks, old marketing links, and search engines land somewhere
 * coherent. CLAUDE.md §12.1 zero-tolerance for dead code.
 *
 * The org-portal-side `/portal/login` is a SEPARATE route and is NOT
 * affected by this consolidation.
 */
import { redirect } from 'next/navigation';

export default function LegacyLoginPage() {
  redirect('/signin');
}
