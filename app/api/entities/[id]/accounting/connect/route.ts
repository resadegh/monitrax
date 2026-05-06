/**
 * Phase 41f.2 — POST /api/entities/[id]/accounting/connect
 *
 * Initiates the Xero OAuth flow for a personal LegalEntity. Returns
 * the Xero authorize URL the client redirects the user to. State is
 * HMAC-signed (stateless — works across Vercel function instances per
 * `lib/integrations/xero/state.ts`) and binds the callback to
 * `(entityId, userId)`.
 *
 * No `AccountingIntegration` row is created here — we wait for the
 * callback (with valid code + verified state) so we never persist
 * a half-finished connection. CLAUDE.md §12.11 N/A — no row writes.
 *
 * Returns 503 with `XERO_NOT_CONFIGURED` when env vars are unset
 * (mirrors the AI-advisor not-configured pattern from Phase 41h.3).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { listEntitiesForUser } from '@/lib/services/legalEntityService';
import { resolveXeroConfig, buildAuthorizeUrl } from '@/lib/integrations/xero';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withPermission<RouteContext>(
  'entity.write',
  async (_request: NextRequest, auth, context) => {
    try {
      const { id } = await context!.params;

      // Ownership check (defence-in-depth).
      const entities = await listEntitiesForUser(auth.userId);
      const entity = entities.find((e) => e.id === id);
      if (!entity) {
        return NextResponse.json(
          { error: 'Entity not found.' },
          { status: 404 },
        );
      }

      const resolution = resolveXeroConfig();
      if (!resolution.configured) {
        return NextResponse.json(
          {
            error: 'Xero integration is not configured.',
            code: 'XERO_NOT_CONFIGURED',
            missing: resolution.missing,
          },
          { status: 503 },
        );
      }

      const authorizeUrl = buildAuthorizeUrl(
        entity.id,
        auth.userId,
        resolution.config,
      );

      return NextResponse.json({ authorizeUrl });
    } catch (error) {
      console.error('Xero connect initiation error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
);
