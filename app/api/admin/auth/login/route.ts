/**
 * Phase M: Admin Login API — GCP Identity Platform
 *
 * POST /api/admin/auth/login
 * Accepts a Firebase ID token (from client-side Firebase Auth login),
 * verifies admin privileges (custom claims or AdminUser DB record),
 * and returns admin context.
 *
 * The Firebase ID token is passed in the Authorization header:
 *   Authorization: Bearer <firebase-id-token>
 *
 * The client stores the token and passes it with subsequent requests.
 * No custom session tokens or cookies are created — Firebase handles
 * token refresh and expiry.
 *
 * Phase M Migration: Replaces custom AdminUser password auth with
 * GCP Identity Platform token verification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { verifyAdminGCPAuth, extractClientIp } from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { createAuditLog } from '@/lib/security/auditLog';

export async function POST(request: NextRequest) {
  // Check if portal is accessible
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED,
          message: 'Admin portal is not enabled',
        },
      },
      { status: 503 }
    );
  }

  try {
    // Verify the Firebase ID token and check admin privileges
    // verifyAdminGCPAuth extracts the token from Authorization header,
    // verifies via GCP Identity Platform, and checks admin custom claims
    // or AdminUser DB record.
    const authResult = await verifyAdminGCPAuth(request);

    if (!authResult.success || !authResult.context) {
      const clientIp = extractClientIp(request);

      // Audit failed admin login attempt
      createAuditLog({
        action: 'UNAUTHORIZED_ACCESS',
        status: 'BLOCKED',
        entityType: 'AdminLogin',
        ipAddress: clientIp,
        metadata: {
          endpoint: '/api/admin/auth/login',
          reason: authResult.error?.message || 'Unknown',
        },
      }).catch(() => {});

      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    // Update last login on AdminUser record (if exists)
    const clientIp = extractClientIp(request);
    try {
      await prisma.adminUser.update({
        where: { id: authResult.context.adminId },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: clientIp,
        },
      });
    } catch {
      // AdminUser record may not exist if using custom claims only — that's OK
    }

    // Audit successful admin login
    createAuditLog({
      userId: authResult.context.adminId,
      action: 'ADMIN_LOGIN',
      status: 'SUCCESS',
      entityType: 'AdminLogin',
      ipAddress: clientIp,
      metadata: {
        role: authResult.context.role,
        email: authResult.context.email,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      admin: {
        id: authResult.context.adminId,
        email: authResult.context.email,
        name: authResult.context.name,
        role: authResult.context.role,
      },
    });
  } catch (error) {
    console.error('[Admin Login] Error:', error);
    return NextResponse.json(
      {
        error: {
          code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
          message: 'An error occurred during login',
        },
      },
      { status: 500 }
    );
  }
}
