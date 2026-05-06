/**
 * Phase 41f.3 — Lazy token refresh for Xero integrations.
 *
 * `getValidAccessToken(integration)` returns a usable access token,
 * refreshing it via Xero's token endpoint when expired (or about to
 * expire — 60-second skew buffer). When refresh succeeds, the new
 * tokens are persisted to the same `AccountingIntegration` row.
 *
 * Refresh failures stamp `connectionError = 'TOKEN_REFRESH_FAILED'`
 * and clear `isConnected` so the UI surfaces a re-connect prompt.
 *
 * CLAUDE.md §12.10 — refresh is synchronous because the caller needs
 * the fresh token to complete its API call. The audit log around
 * the refresh is fire-and-forget.
 */

import 'server-only';
import type { AccountingIntegration } from '@prisma/client';
import prisma from '@/lib/db';
import {
  resolveXeroConfig,
  refreshAccessToken as xeroRefreshAccessToken,
  XeroOAuthError,
} from './';

/**
 * Skew buffer — refresh proactively when the token is within
 * 60 seconds of expiry. Stops races where the caller checks
 * "valid" and then the token expires before the API call lands.
 */
const REFRESH_SKEW_MS = 60_000;

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_CONFIGURED'
      | 'NO_REFRESH_TOKEN'
      | 'NOT_CONNECTED'
      | 'REFRESH_FAILED',
  ) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
}

/**
 * Returns a valid access token for the integration, refreshing if
 * necessary. Persists rotated tokens. Throws `TokenRefreshError`
 * on any failure with a typed `code` so callers can distinguish
 * configuration vs refresh-token-rotation vs Xero-server failure.
 */
export async function getValidAccessToken(
  integration: Pick<
    AccountingIntegration,
    'id' | 'isConnected' | 'accessToken' | 'refreshToken' | 'tokenExpiresAt'
  >,
): Promise<RefreshedTokens> {
  if (!integration.isConnected) {
    throw new TokenRefreshError(
      'Integration is not connected. Re-connect Xero before refreshing data.',
      'NOT_CONNECTED',
    );
  }
  if (!integration.refreshToken) {
    throw new TokenRefreshError(
      'No refresh token on file. Re-connect Xero.',
      'NO_REFRESH_TOKEN',
    );
  }

  // Fast path — current token is still valid (and not within the
  // skew buffer of expiry).
  if (
    integration.accessToken &&
    integration.tokenExpiresAt &&
    integration.tokenExpiresAt.getTime() - REFRESH_SKEW_MS > Date.now()
  ) {
    return {
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken,
      accessTokenExpiresAt: integration.tokenExpiresAt,
    };
  }

  const resolution = resolveXeroConfig();
  if (!resolution.configured) {
    throw new TokenRefreshError(
      'Xero integration is not configured.',
      'NOT_CONFIGURED',
    );
  }

  // Refresh path. Xero rotates refresh tokens — the response carries a
  // NEW refresh token that supersedes the one we sent. Both must be
  // persisted atomically.
  let fresh;
  try {
    fresh = await xeroRefreshAccessToken(integration.refreshToken, resolution.config);
  } catch (err) {
    // Stamp the failure on the integration so the UI can surface it.
    await prisma.accountingIntegration
      .update({
        where: { id: integration.id },
        data: {
          isConnected: false,
          connectionError: 'TOKEN_REFRESH_FAILED',
        },
      })
      .catch(() => {});
    const detail =
      err instanceof XeroOAuthError ? err.message : 'Xero refresh failed';
    throw new TokenRefreshError(detail, 'REFRESH_FAILED');
  }

  const expiresAt = new Date(fresh.accessTokenExpiresAt);
  await prisma.accountingIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken,
      tokenExpiresAt: expiresAt,
      tokenScope: fresh.scope,
      connectionError: null,
    },
  });

  return {
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken,
    accessTokenExpiresAt: expiresAt,
  };
}
