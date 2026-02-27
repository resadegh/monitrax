/**
 * API Route Middleware — GCP Identity Platform
 *
 * Verifies GCP/Firebase ID tokens for API route authentication.
 * Auto-syncs GCP users to the local database on first request.
 *
 * CDR Compliance (Phase 34):
 *   Every authenticated API request is logged to the AuditLog table.
 *   Metadata is sanitized to exclude CDR-protected financial data.
 *
 * This is the legacy-style withAuth middleware used by most API routes.
 * For new routes, prefer using `getAuthContext()` from `lib/auth/context.ts`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyGCPIdToken } from '@/lib/auth/gcpTokenVerifier';
import { syncGCPUser } from '@/lib/auth/gcpIdentity';
import type { GCPTokenClaims } from '@/lib/auth/gcpIdentity';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * Middleware to verify GCP/Firebase ID token and attach user to request.
 * Automatically logs every authenticated API request for CDR compliance.
 */
export async function withAuth(
  request: NextRequest,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const start = Date.now();
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  const authHeader = request.headers.get('authorization');
  const token = extractBearerToken(authHeader);

  if (!token) {
    // Log unauthenticated access attempt
    logApiRequest(undefined, method, pathname, 401, Date.now() - start, ipAddress, userAgent);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the GCP/Firebase ID token
  const claims = await verifyGCPIdToken(token);

  if (!claims) {
    logApiRequest(undefined, method, pathname, 401, Date.now() - start, ipAddress, userAgent);
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Look up or auto-sync the local user
  const localUser = await findOrSyncUser(claims, request);

  if (!localUser) {
    logApiRequest(undefined, method, pathname, 401, Date.now() - start, ipAddress, userAgent);
    return NextResponse.json({ error: 'User sync failed' }, { status: 401 });
  }

  // Attach user to request
  const authReq = request as AuthenticatedRequest;
  authReq.user = {
    userId: localUser.id,
    email: localUser.email,
  };

  // Execute the handler and log the result
  const response = await handler(authReq);
  const durationMs = Date.now() - start;

  // CDR: Log every API request (fire-and-forget — never block the response)
  logApiRequest(localUser.id, method, pathname, response.status, durationMs, ipAddress, userAgent);

  return response;
}

/**
 * Fire-and-forget API request audit log.
 * Uses sanitized metadata to ensure no CDR financial data leaks.
 */
function logApiRequest(
  userId: string | undefined,
  method: string,
  endpoint: string,
  httpStatus: number,
  durationMs: number,
  ipAddress?: string,
  userAgent?: string,
): void {
  createAuditLog({
    userId,
    action: 'API_REQUEST',
    status: httpStatus >= 200 && httpStatus < 400 ? 'SUCCESS' : 'FAILURE',
    entityType: deriveEntityType(endpoint),
    ipAddress,
    userAgent,
    metadata: sanitizeCdrMetadata({
      method,
      endpoint,
      httpStatus,
      durationMs,
    }),
  }).catch(() => {}); // never throw — audit logging must not break the app
}

/**
 * Derive a human-readable entity type from an API path.
 * e.g. /api/expenses/123 → "Expense", /api/accounts → "Account"
 */
function deriveEntityType(pathname: string): string | undefined {
  const segments = pathname.replace(/^\/api\//, '').split('/');
  const resource = segments[0];
  if (!resource) return undefined;

  const ENTITY_MAP: Record<string, string> = {
    expenses: 'Expense',
    income: 'Income',
    accounts: 'Account',
    loans: 'Loan',
    properties: 'Property',
    assets: 'Asset',
    investments: 'Investment',
    transactions: 'Transaction',
    'unified-transactions': 'Transaction',
    categories: 'Category',
    documents: 'Document',
    tax: 'Tax',
    auth: 'Auth',
    admin: 'Admin',
  };

  return ENTITY_MAP[resource] || undefined;
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
