/**
 * POST /api/auth/gcp/verify
 *
 * Verify a GCP Identity Platform ID token without syncing.
 * Returns the decoded token claims if valid.
 *
 * Use cases:
 * - Client-side token validation before sync
 * - Health checks to verify GCP integration is working
 * - Debugging token issues during migration
 *
 * Request:
 *   Authorization: Bearer <gcp-id-token>
 *
 * Response:
 *   { success: true, data: { uid, email, emailVerified, signInProvider } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyGCPIdToken, extractGCPTokenFromHeader } from '@/lib/auth/gcpTokenVerifier';
import { isGCPIdentityConfigured } from '@/lib/auth/gcpIdentity';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

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

  // Return verified claims (without sensitive data)
  return NextResponse.json(
    {
      success: true,
      data: {
        uid: claims.uid,
        email: claims.email,
        emailVerified: claims.emailVerified,
        displayName: claims.displayName || null,
        signInProvider: claims.signInProvider || null,
        tokenExpiry: new Date(claims.exp * 1000).toISOString(),
      },
      error: null,
      meta: {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      },
    },
    { status: 200 }
  );
}
