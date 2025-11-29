import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback, findOrCreateOAuthUser } from '@/lib/auth/oauth';
import { createTrackedSession } from '@/lib/session';
import { generateToken } from '@/lib/auth';
import prisma from '@/lib/db';

/**
 * GET /api/auth/callback/google
 * Handle Google OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validation
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/login?error=missing_parameters', request.url)
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Handle OAuth callback - exchange code for tokens and get user info
    const oauthResult = await handleOAuthCallback('google', code, state);

    if (!oauthResult.success || !oauthResult.user || !oauthResult.tokens) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(oauthResult.error || 'oauth_failed')}`, request.url)
      );
    }

    // Find or create user
    const userResult = await findOrCreateOAuthUser(oauthResult.user, oauthResult.tokens);

    if (userResult.error || !userResult.userId) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(userResult.error || 'user_creation_failed')}`, request.url)
      );
    }

    // Get user data for token
    const user = await prisma.user.findUnique({
      where: { id: userResult.userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=user_not_found', request.url)
      );
    }

    // Create tracked session
    await createTrackedSession({
      userId: userResult.userId,
      ipAddress,
      userAgent,
      deviceName: userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop',
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Redirect to OAuth success page with token (client will store in localStorage)
    const redirectUrl = new URL('/oauth-callback', request.url);
    redirectUrl.searchParams.set('token', token);
    redirectUrl.searchParams.set('user', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    }));

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=internal_error', request.url)
    );
  }
}
