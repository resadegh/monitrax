/**
 * API Route Middleware — GCP Identity Platform
 *
 * Verifies GCP/Firebase ID tokens for API route authentication.
 * Auto-syncs GCP users to the local database on first request.
 *
 * This is the legacy-style withAuth middleware used by most API routes.
 * For new routes, prefer using `getAuthContext()` from `lib/auth/context.ts`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyGCPIdToken } from '@/lib/auth/gcpTokenVerifier';
import { syncGCPUser } from '@/lib/auth/gcpIdentity';
import type { GCPTokenClaims } from '@/lib/auth/gcpIdentity';
import { prisma } from '@/lib/db';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * Middleware to verify GCP/Firebase ID token and attach user to request.
 */
export async function withAuth(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the GCP/Firebase ID token
  const claims = await verifyGCPIdToken(token);

  if (!claims) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Look up or auto-sync the local user
  const localUser = await findOrSyncUser(claims, request);

  if (!localUser) {
    return NextResponse.json({ error: 'User sync failed' }, { status: 401 });
  }

  // Attach user to request
  const authReq = request as AuthenticatedRequest;
  authReq.user = {
    userId: localUser.id,
    email: localUser.email,
  };

  return handler(authReq);
}

// ============================================
// INTERNAL HELPERS
// ============================================

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

async function findOrSyncUser(
  claims: GCPTokenClaims,
  request: NextRequest
): Promise<{ id: string; email: string } | null> {
  // Fast path: look up by GCP UID
  const oauthAccount = await prisma.oAuthAccount.findFirst({
    where: {
      provider: 'gcp-identity',
      providerUserId: claims.uid,
    },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  if (oauthAccount) {
    return oauthAccount.user;
  }

  // Slow path: auto-sync
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  try {
    const syncResult = await syncGCPUser({
      claims,
      ipAddress,
      userAgent,
    });

    return { id: syncResult.userId, email: syncResult.email };
  } catch {
    return null;
  }
}
