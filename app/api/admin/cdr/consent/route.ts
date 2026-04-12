/**
 * Phase M.4.2: Admin CDR Consent Management API
 *
 * GET  /api/admin/cdr/consent — List all CDR consents across users
 * POST /api/admin/cdr/consent — Admin actions: revoke consent, delete CDR data on behalf of user
 *
 * Per CLAUDE.md §13: CDR data is NEVER displayed raw. Only consent metadata
 * (status, scope, dates) is shown — no account numbers, balances, or transactions.
 *
 * All admin consent actions are audited via createAuditLog().
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { createAuditLog } from '@/lib/security/auditLog';
import { deleteCDRData, handleConsentRevocation } from '@/lib/services/cdrDataLifecycle';

/**
 * GET /api/admin/cdr/consent
 * List all CDR consents across users with pagination and filtering.
 */
export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status'); // ACTIVE, REVOKED, EXPIRED
    const skip = (page - 1) * limit;

    // Fetch Basiq connections with consent info (no raw CDR data)
    const where = status ? { status: status as any } : {};

    const [connections, total] = await Promise.all([
      prisma.basiqConnection.findMany({
        where,
        select: {
          id: true,
          userId: true,
          institutionName: true,
          status: true,
          consentExpiresAt: true,
          consentScope: true,
          lastSyncedAt: true,
          createdAt: true,
          user: {
            select: { email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.basiqConnection.count({ where }),
    ]);

    // Also fetch CDRConsent records
    const [cdrConsents, cdrTotal] = await Promise.all([
      prisma.cDRConsent.findMany({
        select: {
          id: true,
          userId: true,
          consentStatus: true,
          scope: true,
          grantedAt: true,
          expiresAt: true,
          revokedAt: true,
          revokedReason: true,
          createdAt: true,
          user: {
            select: { email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }).catch(() => []),
      prisma.cDRConsent.count().catch(() => 0),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        basiqConnections: connections,
        cdrConsents,
        pagination: {
          page,
          limit,
          totalConnections: total,
          totalConsents: cdrTotal,
          totalPages: Math.ceil(Math.max(total, cdrTotal) / limit),
        },
      },
    });
  } catch (error) {
    console.error('[Admin CDR Consent] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch consent data' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cdr/consent
 * Admin consent management actions.
 *
 * Actions:
 *   { action: 'revoke_user_consent', userId: string }
 *     — Revoke all consents and delete CDR data for a user
 *   { action: 'revoke_org_consent', organizationClientId: string }
 *     — Revoke a specific org client consent
 *   { action: 'delete_user_cdr_data', userId: string }
 *     — Delete all CDR data for a user (admin-initiated)
 */
export async function POST(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  // Only SUPER_ADMIN can manage consent on behalf of users
  if (!hasPermission(authResult.context.role, 'admins:update')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'SUPER_ADMIN required for consent management' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'revoke_user_consent': {
        const { userId } = body;
        if (!userId) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'userId is required' } },
            { status: 400 }
          );
        }

        const result = await deleteCDRData(userId, 'consent_revoked');

        createAuditLog({
          userId: authResult.context.adminId,
          action: 'CDR_CONSENT_REVOKED',
          status: 'SUCCESS',
          entityType: 'AdminConsentAction',
          entityId: userId,
          metadata: {
            adminAction: 'revoke_user_consent',
            targetUserId: userId,
            adminEmail: authResult.context.email,
            deletedAccounts: result.deletedAccounts,
            deletedTransactions: result.deletedTransactions,
          },
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          data: { message: 'User consent revoked and CDR data deleted', result },
        });
      }

      case 'revoke_org_consent': {
        const { organizationClientId, userId } = body;
        if (!organizationClientId || !userId) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'organizationClientId and userId are required' } },
            { status: 400 }
          );
        }

        const result = await handleConsentRevocation(userId, organizationClientId);

        createAuditLog({
          userId: authResult.context.adminId,
          action: 'CDR_CONSENT_REVOKED',
          status: 'SUCCESS',
          entityType: 'AdminConsentAction',
          entityId: organizationClientId,
          metadata: {
            adminAction: 'revoke_org_consent',
            targetUserId: userId,
            adminEmail: authResult.context.email,
          },
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          data: { message: 'Organization consent revoked', result },
        });
      }

      case 'delete_user_cdr_data': {
        const { userId } = body;
        if (!userId) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'userId is required' } },
            { status: 400 }
          );
        }

        const result = await deleteCDRData(userId, 'user_requested');

        createAuditLog({
          userId: authResult.context.adminId,
          action: 'CDR_DATA_DELETED',
          status: 'SUCCESS',
          entityType: 'AdminConsentAction',
          entityId: userId,
          metadata: {
            adminAction: 'delete_user_cdr_data',
            targetUserId: userId,
            adminEmail: authResult.context.email,
            deletedAccounts: result.deletedAccounts,
            deletedTransactions: result.deletedTransactions,
          },
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          data: { message: 'CDR data deleted for user', result },
        });
      }

      default:
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Use: revoke_user_consent, revoke_org_consent, delete_user_cdr_data' } },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Admin CDR Consent Action] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to process consent action' } },
      { status: 500 }
    );
  }
}
