/**
 * Phase 38 PR 3 — Share Pass token utilities.
 *
 * Tokens are URL-safe random strings used as the bearer credential for
 * a `SharePackage`. The recipient holding the token can read the share
 * (no other auth required). This is identical in security model to
 * password-reset links / unsubscribe tokens / Calendly meeting links.
 *
 * Hardening:
 *   • 32 bytes ≈ 256 bits of entropy → infeasible to enumerate
 *   • Base64URL-encoded → safe in URLs, copy-pasteable
 *   • Generated server-side via `crypto.randomBytes` — never user-supplied
 *   • Stored verbatim in `SharePackage.token` with a UNIQUE index
 *   • All access through the token is audit-logged (CDR §13.5)
 */

import { randomBytes } from 'crypto';

/**
 * Generate a fresh share token. 32 random bytes → 43-char URL-safe string
 * (e.g. "Yt-3qK7m9b2nLp5rV8x1aZ4cE6gJ_wD0sH"-ish).
 *
 * Collision probability across 1 trillion shares is < 10^-50; we still
 * rely on the unique index for absolute safety, and retry once if a
 * collision is ever observed (it never will be).
 */
export function generateShareToken(): string {
  return randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build the public-facing URL for a share token.
 *
 * Reads `NEXT_PUBLIC_APP_URL` if set (preferred for production); otherwise
 * falls back to the request's origin if available, else a relative path.
 * The relative-path fallback is correct for client-side rendering — the
 * browser resolves it against the current host.
 */
export function buildShareUrl(token: string, origin?: string | null): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    origin?.replace(/\/$/, '') ??
    '';
  return `${base}/share/${token}`;
}

/**
 * Fixed default share-expiry: 30 days. Reza decision 2026-05-01.
 * Configurable per share via the modal's "Access expires in" picker
 * (7 / 30 / 90 days), but 30 is the accepted default.
 */
export const DEFAULT_SHARE_EXPIRY_DAYS = 30;

/**
 * Compute an expiry timestamp `daysFromNow` days into the future.
 * Server-generated — never trust a client-supplied `expiresAt`.
 */
export function computeExpiry(daysFromNow: number = DEFAULT_SHARE_EXPIRY_DAYS): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.floor(daysFromNow)));
  return d;
}

/**
 * Australian financial year label for watermarks.
 * Matches the format used by the Vault hero + the export endpoint.
 */
export function getCurrentAUFinancialYearLabel(now = new Date()): string {
  const month = now.getMonth();
  const year = now.getFullYear();
  const fyStart = month >= 6 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `FY ${fyStart}–${String(fyEnd).slice(2)}`;
}

/**
 * Build the default watermark text shown on the recipient page footer.
 * Owner name + FY label + ISO timestamp gives the accountant + auditor
 * unambiguous provenance.
 */
export function buildDefaultWatermark(ownerName: string): string {
  return `Generated from Monitrax · ${getCurrentAUFinancialYearLabel()} · ${ownerName}`;
}
