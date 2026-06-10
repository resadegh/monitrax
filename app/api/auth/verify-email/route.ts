import { NextRequest, NextResponse } from 'next/server';
import { verifyGCPIdToken, extractGCPTokenFromHeader } from '@/lib/auth/gcpTokenVerifier';
import { prisma } from '@/lib/db';
import { logAuth } from '@/lib/security/auditLog';

/**
 * POST /api/auth/verify-email
 *
 * Email-verification DB true-up — GCP Identity Platform is the verification
 * SSOT (CLAUDE.md §12.7 GCP-first).
 *
 * The verification itself happens in Firebase: the user clicks the link in
 * the Firebase-sent email, the client applies the action code
 * (`applyActionCode`) and force-refreshes its ID token. This endpoint then
 * syncs the Google-signed `email_verified` claim into the local User row
 * (`emailVerified` / `emailVerifiedAt`) so DB bookkeeping matches.
 *
 * Replaces the Phase 05 in-memory token consumer, which could not work on
 * serverless: the Map storing tokens lived in one function instance while
 * verification requests landed on another (see CHANGELOG_2026_06_10).
 *
 * §12.11 note: the only write is a one-way false→true flip on two system
 * bookkeeping columns, guarded by the verified Google-signed token claim.
 */
export async function POST(request: NextRequest) {
  try {
    const token = extractGCPTokenFromHeader(request.headers.get('authorization'));

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const claims = await verifyGCPIdToken(token);

    if (!claims) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401 }
      );
    }

    if (!claims.emailVerified) {
      // The token predates verification — the client must refresh it
      // (getIdToken(true)) after applying the action code, then retry.
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Your email is not verified yet. Click the link in your inbox first.',
          },
        },
        { status: 400 }
      );
    }

    const oauthAccount = await prisma.oAuthAccount.findFirst({
      where: { provider: 'gcp-identity', providerUserId: claims.uid },
      select: { userId: true, user: { select: { emailVerified: true } } },
    });

    if (!oauthAccount) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!oauthAccount.user.emailVerified) {
      await prisma.user.update({
        where: { id: oauthAccount.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });

      logAuth({
        userId: oauthAccount.userId,
        action: 'EMAIL_VERIFIED',
        status: 'SUCCESS',
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        metadata: { provider: 'gcp-identity', gcpUid: claims.uid },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: { emailVerified: true },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Email verification sync error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
