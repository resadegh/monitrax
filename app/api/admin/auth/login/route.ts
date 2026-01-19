/**
 * Phase 33: Admin Login API
 *
 * POST /api/admin/auth/login
 * Handles admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import {
  verifyPassword,
  createAdminSession,
  isAccountLocked,
  recordFailedLogin,
  resetFailedLoginCount,
  extractClientIp,
  extractUserAgent,
} from '@/lib/admin/auth';
import { ADMIN_ERROR_CODES, SECURITY_CONSTANTS } from '@/lib/admin/constants';

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
    const body = await request.json();
    const { email, password, mfaCode } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: ADMIN_ERROR_CODES.INVALID_REQUEST,
            message: 'Email and password are required',
          },
        },
        { status: 400 }
      );
    }

    // Find admin by email
    const admin = await prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!admin) {
      return NextResponse.json(
        {
          error: {
            code: ADMIN_ERROR_CODES.INVALID_CREDENTIALS,
            message: 'Invalid email or password',
          },
        },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (await isAccountLocked(admin.id)) {
      return NextResponse.json(
        {
          error: {
            code: ADMIN_ERROR_CODES.ACCOUNT_LOCKED,
            message: 'Account is locked. Please try again later.',
          },
        },
        { status: 403 }
      );
    }

    // Check if account is active
    if (!admin.isActive) {
      return NextResponse.json(
        {
          error: {
            code: ADMIN_ERROR_CODES.ACCOUNT_INACTIVE,
            message: 'Account is inactive',
          },
        },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, admin.passwordHash);
    if (!isPasswordValid) {
      const { locked, remainingAttempts } = await recordFailedLogin(admin.id);

      return NextResponse.json(
        {
          error: {
            code: ADMIN_ERROR_CODES.INVALID_CREDENTIALS,
            message: locked
              ? 'Account locked due to too many failed attempts'
              : `Invalid email or password. ${remainingAttempts} attempts remaining.`,
          },
        },
        { status: 401 }
      );
    }

    // Check MFA if enabled
    if (admin.mfaEnabled) {
      if (!mfaCode) {
        return NextResponse.json(
          {
            requireMfa: true,
            error: {
              code: ADMIN_ERROR_CODES.MFA_REQUIRED,
              message: 'MFA code is required',
            },
          },
          { status: 200 }
        );
      }

      // TODO: Verify MFA code
      // For now, accept any 6-digit code
      if (!/^\d{6}$/.test(mfaCode)) {
        return NextResponse.json(
          {
            error: {
              code: ADMIN_ERROR_CODES.MFA_INVALID,
              message: 'Invalid MFA code',
            },
          },
          { status: 401 }
        );
      }
    }

    // Reset failed login count
    await resetFailedLoginCount(admin.id);

    // Create session
    const clientIp = extractClientIp(request);
    const userAgent = extractUserAgent(request);
    const sessionResult = await createAdminSession(admin.id, clientIp, userAgent);

    if (!sessionResult.success || !sessionResult.session) {
      return NextResponse.json(
        {
          error: {
            code: ADMIN_ERROR_CODES.INTERNAL_ERROR,
            message: 'Failed to create session',
          },
        },
        { status: 500 }
      );
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: clientIp,
      },
    });

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });

    // Set session cookie
    response.cookies.set('admin_session', sessionResult.session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SECURITY_CONSTANTS.SESSION_DURATION_MS / 1000,
      path: '/admin',
    });

    return response;
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
