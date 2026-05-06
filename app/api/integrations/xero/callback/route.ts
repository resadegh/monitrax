/**
 * Phase 41f.2 — GET /api/integrations/xero/callback
 *
 * Single registered Xero OAuth redirect URI. Xero redirects the user's
 * browser here with `?code=...&state=...` after the consent screen.
 * We:
 *   1. Verify the HMAC state token (rejects expired / tampered). The
 *      signed state IS the auth anchor — only `/connect` (which is
 *      `withPermission('entity.write')`-gated) can issue a valid state.
 *   2. Confirm the entity belongs to the userId embedded in state
 *      (defence-in-depth; same ownership pattern as the rest of
 *      `/api/entities/[id]/*`).
 *   3. Exchange the code for access + refresh tokens.
 *   4. List Xero tenants this token can read; v1 picks the first tenant
 *      (multi-tenant handling deferred to v2 — UNCOMPUTED:
 *      UC-XERO-MULTI-ENTITY-SAME-TENANT).
 *   5. Upsert the `AccountingIntegration` row (USER_ENTITY scope) with
 *      tokens + tenant metadata.
 *   6. Redirect back to the connect-bookkeeping page with a success or
 *      error param the UI renders.
 *
 * Browser-redirect routes can't use the standard `Authorization: Bearer`
 * pattern (the Xero redirect doesn't carry our API token). The HMAC
 * state token + 15-minute TTL + state-issuance gated by entity.write
 * permission together form the authentication.
 *
 * CLAUDE.md §12.11: this route does an upsert. The `where` clause is
 * `{ scope: 'USER_ENTITY', legalEntityId, provider: 'XERO' }` — narrow
 * enough that we only ever touch the row uniquely owned by
 * `(legalEntityId, provider)` in the USER_ENTITY scope. If a row
 * exists, it was created by this code path; overwriting the OAuth-
 * token columns is the intent.
 */

import { NextResponse, type NextRequest } from 'next/server';
import prisma from '@/lib/db';
import {
  resolveXeroConfig,
  verifyOAuthState,
  exchangeCodeForTokens,
  listConnectedTenants,
  XeroOAuthError,
} from '@/lib/integrations/xero';
import { logCRUD } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Xero returns the user to this callback with `?error=` if they
  // declined consent on the Xero screen.
  if (error) {
    return redirectToConnectPage(null, {
      status: 'error',
      reason: error,
      detail: errorDescription ?? null,
    });
  }

  if (!code || !state) {
    return redirectToConnectPage(null, {
      status: 'error',
      reason: 'MISSING_CODE_OR_STATE',
      detail: null,
    });
  }

  const resolution = resolveXeroConfig();
  if (!resolution.configured) {
    return redirectToConnectPage(null, {
      status: 'error',
      reason: 'XERO_NOT_CONFIGURED',
      detail: null,
    });
  }

  // 1. Verify state (HMAC + expiry). The signed state IS the auth
  // anchor — only authenticated entity.write requests can issue one.
  const payload = verifyOAuthState(state, resolution.config.stateSecret);
  if (!payload) {
    return redirectToConnectPage(null, {
      status: 'error',
      reason: 'INVALID_STATE',
      detail: null,
    });
  }

  // 2. Confirm the entity belongs to the user encoded in state.
  // Defence-in-depth — same ownership pattern as the connect route.
  // If the entity was deleted between issuance and callback, we surface
  // a friendly error rather than persisting an orphan integration.
  const entity = await prisma.legalEntity.findFirst({
    where: { id: payload.entityId, userId: payload.userId },
    select: { id: true, name: true, type: true },
  });
  if (!entity) {
    return redirectToConnectPage(payload.entityId, {
      status: 'error',
      reason: 'ENTITY_NOT_FOUND',
      detail: null,
    });
  }

  // 4. Exchange code for tokens.
  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, resolution.config);
  } catch (err) {
    console.error('Xero token exchange failed:', err);
    return redirectToConnectPage(payload.entityId, {
      status: 'error',
      reason: 'TOKEN_EXCHANGE_FAILED',
      detail: err instanceof XeroOAuthError ? err.message : null,
    });
  }

  // 5. Pick the first available tenant (v1 — UC-XERO-MULTI-ENTITY-SAME-TENANT).
  let tenant;
  try {
    const tenants = await listConnectedTenants(tokens.accessToken);
    tenant = tenants[0];
    if (!tenant) {
      return redirectToConnectPage(payload.entityId, {
        status: 'error',
        reason: 'NO_TENANTS',
        detail: 'Xero returned no organisations on this account.',
      });
    }
  } catch (err) {
    console.error('Xero tenant list failed:', err);
    return redirectToConnectPage(payload.entityId, {
      status: 'error',
      reason: 'TENANT_LIST_FAILED',
      detail: err instanceof Error ? err.message : null,
    });
  }

  // 6. Upsert the AccountingIntegration row (USER_ENTITY scope).
  // We can't use Prisma's `upsert` directly because the USER_ENTITY
  // unique constraint is a partial index (raw SQL — see migration
  // 20260510100000_add_phase_41f_bookkeeping). Use findFirst + update
  // / create instead — same effective semantics.
  const existing = await prisma.accountingIntegration.findFirst({
    where: {
      scope: 'USER_ENTITY',
      legalEntityId: payload.entityId,
      provider: 'XERO',
    },
    select: { id: true },
  });

  let integrationId: string;
  if (existing) {
    await prisma.accountingIntegration.update({
      where: { id: existing.id },
      data: {
        userId: payload.userId,
        provider: 'XERO',
        providerTenantId: tenant.tenantId,
        providerOrganization: tenant.tenantName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(tokens.accessTokenExpiresAt),
        tokenScope: tokens.scope,
        isConnected: true,
        lastConnectedAt: new Date(),
        connectionError: null,
        syncDirection: 'INBOUND',
        syncEnabled: true,
      },
    });
    integrationId = existing.id;
  } else {
    const created = await prisma.accountingIntegration.create({
      data: {
        scope: 'USER_ENTITY',
        userId: payload.userId,
        legalEntityId: payload.entityId,
        provider: 'XERO',
        providerTenantId: tenant.tenantId,
        providerOrganization: tenant.tenantName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: new Date(tokens.accessTokenExpiresAt),
        tokenScope: tokens.scope,
        isConnected: true,
        lastConnectedAt: new Date(),
        syncDirection: 'INBOUND',
        syncEnabled: true,
      },
      select: { id: true },
    });
    integrationId = created.id;
  }

  logCRUD({
    userId: payload.userId,
    action: 'CREATE',
    entityType: 'AccountingIntegration',
    entityId: integrationId,
    metadata: sanitizeCdrMetadata({
      provider: 'XERO',
      legalEntityId: payload.entityId,
      legalEntityName: entity.name,
      legalEntityType: entity.type,
      tenantName: tenant.tenantName,
      // CDR-safe: tenant id is a Xero org identifier, not a customer-data
      // field. Tokens are NEVER logged.
      tenantId: tenant.tenantId,
    }),
  }).catch(() => {});

  return redirectToConnectPage(payload.entityId, { status: 'success' });
}

function redirectToConnectPage(
  entityId: string | null,
  result:
    | { status: 'success' }
    | { status: 'error'; reason: string; detail: string | null },
): NextResponse {
  // If we don't know the entity (state was malformed), bounce to the
  // entity list — the user can re-initiate the connect flow from there.
  const base = entityId
    ? `/dashboard/entities/${entityId}/connect-bookkeeping`
    : '/dashboard/entities';

  const params = new URLSearchParams();
  params.set('result', result.status);
  if (result.status === 'error') {
    params.set('reason', result.reason);
    if (result.detail) params.set('detail', result.detail);
  }

  return NextResponse.redirect(new URL(`${base}?${params.toString()}`, getBaseUrl()));
}

function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit;
  // Vercel always sets VERCEL_URL on serverful + VERCEL_PROJECT_PRODUCTION_URL
  // on production. Fallback to localhost for dev.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}
