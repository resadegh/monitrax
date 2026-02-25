/**
 * POST /api/auth/gcp/sync
 *
 * Sync a GCP Identity Platform user to the local Monitrax database.
 *
 * Flow:
 * 1. Client authenticates with GCP Identity Platform (Firebase Auth)
 * 2. Client sends the GCP ID token to this endpoint
 * 3. Server verifies the token against Google's public keys
 * 4. Server creates or links the local user account
 * 5. Server returns a Monitrax JWT for subsequent API calls
 *
 * This enables a gradual migration: the client can start using
 * GCP Identity Platform for login while the backend continues
 * to use Monitrax JWTs for all API authorization.
 *
 * Request:
 *   Authorization: Bearer <gcp-id-token>
 *
 * Response:
 *   { success: true, data: { userId, gcpUid, token, isNewUser, email, name } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyGCPIdToken, extractGCPTokenFromHeader } from '@/lib/auth/gcpTokenVerifier';
import { syncGCPUser, isGCPIdentityConfigured, GCPIdentityError } from '@/lib/auth/gcpIdentity';
import { log } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check if GCP Identity is configured
    if (!isGCPIdentityConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GCP_NOT_CONFIGURED',
            message: 'GCP Identity Platform is not configured',
            details: null,
          },
          meta: {
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startTime,
          },
        },
        { status: 503 }
      );
    }

    // Extract the GCP ID token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    const idToken = extractGCPTokenFromHeader(authHeader);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'GCP ID token required in Authorization header (Bearer <token>)',
            details: null,
          },
          meta: {
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startTime,
          },
        },
        { status: 401 }
      );
    }

    // Verify the GCP ID token
    const claims = await verifyGCPIdToken(idToken);

    if (!claims) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'GCP ID token verification failed',
            details: null,
          },
          meta: {
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startTime,
          },
        },
        { status: 401 }
      );
    }

    // Extract client info for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Sync the GCP user to the local database
    const result = await syncGCPUser({
      claims,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          userId: result.userId,
          gcpUid: result.gcpUid,
          token: result.token,
          isNewUser: result.isNewUser,
          email: result.email,
          name: result.name,
        },
        error: null,
        meta: {
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        },
      },
      { status: result.isNewUser ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof GCPIdentityError) {
      log.warn('GCP sync failed with known error', {
        code: error.code,
        message: error.message,
      });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: null,
          },
          meta: {
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startTime,
          },
        },
        { status: 400 }
      );
    }

    log.error('GCP sync unexpected error', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: null,
        },
        meta: {
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        },
      },
      { status: 500 }
    );
  }
}
