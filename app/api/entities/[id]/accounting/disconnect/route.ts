/**
 * Phase 41f.2 — POST /api/entities/[id]/accounting/disconnect
 *
 * Disconnects the bookkeeping integration for this entity:
 *   1. Best-effort revoke the refresh token on Xero's side (RFC 7009).
 *   2. Soft-disconnect locally — clear tokens, set `isConnected = false`,
 *      stamp `connectionError = 'USER_DISCONNECTED'`. The row stays so
 *      historical audit + sync logs remain queryable.
 *
 * The user can also hard-delete the integration via a separate UI
 * affordance (deferred to PROD); the soft-disconnect is the safe
 * default — same pattern as Phase 32C PR4d's `softDeleteFromUserView`
 * for ConversationParticipant.
 *
 * CLAUDE.md §12.11: this PR contains an `update` on existing rows.
 * The `where` clause is `{ legalEntityId, userId, scope: 'USER_ENTITY' }`
 * so we only mutate rows owned by the calling user for this entity.
 * The columns we overwrite are `accessToken / refreshToken /
 * tokenExpiresAt / isConnected / connectionError` — all integration-
 * lifecycle state that this code path created.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listEntitiesForUser } from '@/lib/services/legalEntityService';
import prisma from '@/lib/db';
import { resolveXeroConfig, revokeRefreshToken } from '@/lib/integrations/xero';
import { logCRUD } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withPermission<RouteContext>(
  'entity.write',
  async (_request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;

      const entities = await listEntitiesForUser(auth.userId);
      const entity = entities.find((e) => e.id === id);
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      const integration = await prisma.accountingIntegration.findFirst({
        where: {
          scope: 'USER_ENTITY',
          legalEntityId: id,
          userId: auth.userId,
        },
      });

      if (!integration) {
        return NextResponse.json(
          { error: 'No bookkeeping integration to disconnect.' },
          { status: 404 },
        );
      }

      // Best-effort Xero revoke. Failures are not fatal — the local
      // soft-disconnect is the source of truth.
      const resolution = resolveXeroConfig();
      if (
        resolution.configured &&
        integration.refreshToken &&
        integration.provider === 'XERO'
      ) {
        try {
          await revokeRefreshToken(integration.refreshToken, resolution.config);
        } catch (err) {
          console.warn(
            'Xero revoke failed (non-fatal — local disconnect proceeds):',
            err,
          );
        }
      }

      await prisma.accountingIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          tokenScope: null,
          isConnected: false,
          connectionError: 'USER_DISCONNECTED',
          syncEnabled: false,
          autoSyncEnabled: false,
        },
      });

      logCRUD({
        userId: auth.userId,
        action: 'UPDATE',
        entityType: 'AccountingIntegration',
        entityId: integration.id,
        metadata: sanitizeCdrMetadata({
          provider: integration.provider,
          legalEntityId: integration.legalEntityId,
          legalEntityName: entity.name,
          legalEntityType: entity.type,
          disconnectedAt: new Date().toISOString(),
        }),
      }).catch(() => {});

      return NextResponse.json({ message: 'Disconnected.' });
    } catch (error) {
      console.error('Disconnect bookkeeping error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);
