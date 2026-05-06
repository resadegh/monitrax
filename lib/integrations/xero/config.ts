/**
 * Phase 41f.2 — Xero integration config.
 *
 * Reads OAuth credentials + redirect URI from env vars. Returns a
 * graceful "not configured" status when env vars are unset so the
 * UI can render a friendly notice instead of crashing (mirrors the
 * GEMINI_API_KEY pattern from Phase 41h.3).
 *
 * Required env vars (production):
 * - `XERO_CLIENT_ID`           — Xero app client id
 * - `XERO_CLIENT_SECRET`       — Xero app client secret
 * - `XERO_OAUTH_REDIRECT_URI`  — full URL of the callback route
 *                                (e.g. `https://app.monitrax.com.au/api/integrations/xero/callback`)
 *
 * Optional:
 * - `XERO_OAUTH_STATE_SECRET`  — HMAC secret for stateless state tokens.
 *                                Falls back to a derived value from
 *                                `NEXTAUTH_SECRET` or throws in production.
 *
 * Per CLAUDE.md §13.6 the secret values are non-CDR business credentials
 * (Xero data is not under CDR open-banking scope). They live in Vercel
 * env vars + are mirrored into Secret Manager when the cutover lands.
 */

import 'server-only';

export interface XeroConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
}

export type XeroConfigResolution =
  | { configured: true; config: XeroConfig }
  | { configured: false; missing: string[] };

const REQUIRED_VARS = ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_OAUTH_REDIRECT_URI'] as const;

/**
 * Resolve the Xero integration config from env vars. Never throws — the
 * caller decides how to surface the unconfigured state (typically a
 * 503 with `XERO_NOT_CONFIGURED` for API routes, or a friendly notice
 * for UI pages).
 */
export function resolveXeroConfig(): XeroConfigResolution {
  const missing: string[] = [];
  for (const name of REQUIRED_VARS) {
    if (!process.env[name]) missing.push(name);
  }
  if (missing.length > 0) {
    return { configured: false, missing };
  }

  const stateSecret =
    process.env.XERO_OAUTH_STATE_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    null;

  if (!stateSecret) {
    return { configured: false, missing: ['XERO_OAUTH_STATE_SECRET (or NEXTAUTH_SECRET fallback)'] };
  }

  return {
    configured: true,
    config: {
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUri: process.env.XERO_OAUTH_REDIRECT_URI!,
      stateSecret,
    },
  };
}

/**
 * Convenience boolean — true iff every required var is present.
 */
export function isXeroConfigured(): boolean {
  return resolveXeroConfig().configured;
}

/**
 * The full set of Xero scopes Phase 41f requests. v1 is read-only —
 * we never write back to Xero (per spec doc §1.1 scope boundary).
 *
 * - `offline_access`             — required for refresh tokens
 * - `accounting.reports.read`    — Balance Sheet, P&L (Phase 41f.3)
 * - `accounting.transactions.read` — bank tx summary (deferred to v2; here
 *                                    so the consent screen is consistent)
 * - `accounting.contacts.read`   — supplier/customer names for narrative
 */
export const XERO_SCOPES = [
  'offline_access',
  'accounting.reports.read',
  'accounting.transactions.read',
  'accounting.contacts.read',
] as const;

export const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
export const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
export const XERO_REVOKE_URL = 'https://identity.xero.com/connect/revocation';
export const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';
