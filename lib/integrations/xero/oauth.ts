/**
 * Phase 41f.2 — Xero OAuth 2.0 helper (RFC 6749).
 *
 * Pure `fetch`-based — zero new dependencies (the official `xero-node`
 * SDK was evaluated and rejected per CLAUDE.md §12.7+§12.8 minimum-
 * custom-code rule; the OAuth flow is so standard that the SDK is
 * overkill for v1; we'll re-evaluate if 41f.3 BS/P&L parsing
 * outgrows our typed wrappers).
 *
 * Surface:
 * - `buildAuthorizeUrl(entityId, userId, config)` → string
 * - `exchangeCodeForTokens(code, config)` → tokens + expiresAt
 * - `refreshAccessToken(refreshToken, config)` → fresh tokens
 * - `revokeRefreshToken(refreshToken, config)` → void
 * - `listConnectedTenants(accessToken)` → tenant list
 *
 * Per Phase 41f §1.1 scope boundary: this module READS only. We
 * never write back to Xero.
 */

import 'server-only';
import {
  type XeroConfig,
  XERO_AUTHORIZE_URL,
  XERO_TOKEN_URL,
  XERO_REVOKE_URL,
  XERO_CONNECTIONS_URL,
  XERO_SCOPES,
} from './config';
import { issueOAuthState } from './state';

export interface XeroTokens {
  accessToken: string;
  refreshToken: string;
  /** ms epoch when access token expires (refresh required after this). */
  accessTokenExpiresAt: number;
  /** Scope string Xero confirmed back; should match XERO_SCOPES. */
  scope: string;
}

export interface XeroTenant {
  id: string;          // Xero connection id
  tenantId: string;    // Xero tenant (organisation) id
  tenantType: string;  // typically "ORGANISATION"
  tenantName: string;
  createdAt: string;
}

/**
 * Build the Xero authorize URL the user is redirected to. The state
 * token encodes `(entityId, userId)` HMAC-signed so the callback can
 * route the resulting tokens to the right `LegalEntity`.
 */
export function buildAuthorizeUrl(
  entityId: string,
  userId: string,
  config: XeroConfig,
): string {
  const state = issueOAuthState(entityId, userId, config.stateSecret);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: XERO_SCOPES.join(' '),
    state,
  });
  return `${XERO_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange the OAuth `code` for an access + refresh token. RFC 6749
 * §4.1.3.
 */
export async function exchangeCodeForTokens(
  code: string,
  config: XeroConfig,
): Promise<XeroTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  });
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
    },
    body: body.toString(),
  });
  return parseTokenResponse(res);
}

/**
 * Refresh an expired access token using the long-lived refresh token.
 * Xero rotates refresh tokens — the response carries a NEW refresh
 * token that supersedes the one passed in. Callers MUST persist both.
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: XeroConfig,
): Promise<XeroTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
    },
    body: body.toString(),
  });
  return parseTokenResponse(res);
}

/**
 * Revoke the refresh token on Xero's side (best-effort — failure does
 * not block our local soft-delete of the integration row). RFC 7009.
 */
export async function revokeRefreshToken(
  refreshToken: string,
  config: XeroConfig,
): Promise<void> {
  const body = new URLSearchParams({ token: refreshToken });
  await fetch(XERO_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(config.clientId, config.clientSecret),
    },
    body: body.toString(),
  });
  // Xero returns 200 on success and 200 on already-revoked. We don't
  // check the status — the local soft-delete is the source of truth
  // for "no longer connected".
}

/**
 * List the Xero tenants this access token can read. Phase 41f v1
 * picks the first tenant; multi-tenant selection is deferred to v2
 * (see UNCOMPUTED register entry UC-XERO-MULTI-ENTITY-SAME-TENANT).
 */
export async function listConnectedTenants(
  accessToken: string,
): Promise<XeroTenant[]> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new XeroOAuthError(`Tenant list failed: ${res.status}`, res.status);
  }
  const json = (await res.json()) as Array<{
    id: string;
    tenantId: string;
    tenantType: string;
    tenantName: string;
    createdDateUtc: string;
  }>;
  return json.map((t) => ({
    id: t.id,
    tenantId: t.tenantId,
    tenantType: t.tenantType,
    tenantName: t.tenantName,
    createdAt: t.createdDateUtc,
  }));
}

// =============================================================================
// internal helpers
// =============================================================================

export class XeroOAuthError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'XeroOAuthError';
  }
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function parseTokenResponse(res: Response): Promise<XeroTokens> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    throw new XeroOAuthError(
      `Xero token endpoint returned ${res.status}: ${detail.slice(0, 200)}`,
      res.status,
    );
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number; // seconds
    token_type: string;
    scope: string;
  };
  if (!json.access_token || !json.refresh_token) {
    throw new XeroOAuthError('Xero token response missing access/refresh token');
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessTokenExpiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope ?? XERO_SCOPES.join(' '),
  };
}

