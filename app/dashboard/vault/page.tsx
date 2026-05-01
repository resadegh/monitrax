import { redirect } from 'next/navigation';

/**
 * Phase 38 PR 1 — friendly alias for `/dashboard/documents`.
 *
 * The sidebar entry "My Vault" links directly to `/dashboard/documents`
 * (the canonical route). This route exists so users who type
 * `/dashboard/vault` in the URL bar, or who follow an internal link
 * that uses the warmer name, still arrive at the right place.
 *
 * Server-side `redirect()` from `next/navigation` issues a 307 and
 * preserves any query string. No client JS required.
 */
export default function VaultAliasPage() {
  redirect('/dashboard/documents');
}
