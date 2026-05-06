/**
 * Phase 41f.2 — GET /api/entities/[id]/accounting
 *
 * Returns the current bookkeeping integration status for this entity.
 * Used by the connect-bookkeeping page to render the right state
 * (no integration / connected to Xero / token expired / etc.).
 *
 * USER_ENTITY scope only — never returns ORG-scope rows even if the
 * caller happens to also be a portal admin (the WHERE clause filters
 * on `legalEntityId + scope = USER_ENTITY`).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listEntitiesForUser } from '@/lib/services/legalEntityService';
import prisma from '@/lib/db';
import { isXeroConfigured } from '@/lib/integrations/xero';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>(
  'entity.read',
  async (_request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;

      // Defence-in-depth ownership check (matches the pattern in
      // app/api/entities/[id]/route.ts).
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
        select: {
          id: true,
          provider: true,
          providerOrganization: true,
          providerTenantId: true,
          isConnected: true,
          lastConnectedAt: true,
          connectionError: true,
          tokenExpiresAt: true,
          lastSyncAt: true,
          lastSyncStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return NextResponse.json({
        configured: isXeroConfigured(),
        entity: { id: entity.id, name: entity.name, type: entity.type },
        integration: integration ?? null,
      });
    } catch (error) {
      console.error('Get accounting integration status error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);
