/**
 * CDR Consent Management API
 * Phase 35: Consent revocation and CDR data deletion
 *
 * POST /api/cdr/consent — Revoke consent and trigger CDR data purge
 * GET  /api/cdr/consent — Get consent status for authenticated user
 *
 * Basiq §5.6: CDR data deleted when consent revoked (within 24 hours)
 * CLAUDE.md §13.2: Consent lifecycle — no consent = no data access
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import {
  handleConsentRevocation,
  deleteCDRData,
  getCDRDataSummary,
} from '@/lib/services/cdrDataLifecycle';

/**
 * GET /api/cdr/consent
 * Get consent status for the authenticated user.
 * Returns all active org-client consents and Basiq connection status.
 */
export const GET = withPermission('account.read', async (request, auth) => {
  try {
    const userId = auth.userId;

    // Get org client consents
    const orgConsents = await prisma.organizationClient.findMany({
      where: { userId },
      select: {
        id: true,
        organizationId: true,
        consentStatus: true,
        accessScopes: true,
        consentGrantedAt: true,
        consentExpiresAt: true,
        consentRevokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get CDR data summary (counts only, never raw data)
    const cdrSummary = await getCDRDataSummary(userId);

    return NextResponse.json({
      success: true,
      data: {
        consents: orgConsents,
        cdrData: cdrSummary,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching consent status:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch consent status',
        },
      },
      { status: 500 }
    );
  }
});

/**
 * POST /api/cdr/consent
 * Revoke consent and trigger CDR data deletion.
 *
 * Body:
 *   { action: 'revoke_org_consent', organizationClientId: string }
 *   OR
 *   { action: 'revoke_all', confirm: true }
 *   OR
 *   { action: 'delete_cdr_data', confirm: true }
 *
 * Basiq §5.6: Consent revocation triggers CDR data purge within 24 hours.
 */
export const POST = withPermission('account.write', async (request, auth) => {
  try {
    const userId = auth.userId;
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'revoke_org_consent': {
        // Revoke a specific org client consent
        const { organizationClientId } = body;
        if (!organizationClientId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'organizationClientId is required' } },
            { status: 400 }
          );
        }

        // Verify this consent belongs to the user
        const client = await prisma.organizationClient.findFirst({
          where: { id: organizationClientId, userId },
        });

        if (!client) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Consent record not found' } },
            { status: 404 }
          );
        }

        if (client.consentStatus === 'REVOKED') {
          return NextResponse.json(
            { success: false, error: { code: 'CONFLICT', message: 'Consent already revoked' } },
            { status: 409 }
          );
        }

        const result = await handleConsentRevocation(userId, organizationClientId);

        return NextResponse.json({
          success: true,
          data: {
            message: 'Consent revoked successfully. CDR data will be purged.',
            deletionResult: result,
          },
          meta: { timestamp: new Date().toISOString() },
        });
      }

      case 'revoke_all': {
        // Revoke all org consents for this user
        if (!body.confirm) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Confirmation required: { confirm: true }' } },
            { status: 400 }
          );
        }

        // Find and revoke all active consents
        const activeConsents = await prisma.organizationClient.findMany({
          where: { userId, consentStatus: 'GRANTED' },
          select: { id: true },
        });

        for (const consent of activeConsents) {
          await handleConsentRevocation(userId, consent.id);
        }

        return NextResponse.json({
          success: true,
          data: {
            message: `${activeConsents.length} consent(s) revoked. CDR data purged.`,
            revokedCount: activeConsents.length,
          },
          meta: { timestamp: new Date().toISOString() },
        });
      }

      case 'delete_cdr_data': {
        // User requests explicit CDR data deletion
        if (!body.confirm) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Confirmation required: { confirm: true }' } },
            { status: 400 }
          );
        }

        const result = await deleteCDRData(userId, 'user_requested');

        return NextResponse.json({
          success: true,
          data: {
            message: 'CDR data deleted successfully.',
            deletionResult: result,
          },
          meta: { timestamp: new Date().toISOString() },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Use: revoke_org_consent, revoke_all, or delete_cdr_data' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing consent action:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process consent action',
        },
      },
      { status: 500 }
    );
  }
});
