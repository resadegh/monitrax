import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback, findOrCreateOAuthUser } from '@/lib/auth/oauth';
import { createTrackedSession } from '@/lib/session';

/**
 * GET /api/auth/callback/facebook
 * Handle Facebook OAuth callback
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
        new URL(`/auth/login?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validation
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/auth/login?error=missing_parameters', request.url)
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Handle OAuth callback - exchange code for tokens and get user info
    const oauthResult = await handleOAuthCallback('facebook', code, state);

    if (!oauthResult.success || !oauthResult.user || !oauthResult.tokens) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(oauthResult.error || 'oauth_failed')}`, request.url)
      );
    }

    // Find or create user
    const userResult = await findOrCreateOAuthUser(oauthResult.user, oauthResult.tokens);

    if (userResult.error || !userResult.userId) {
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(userResult.error || 'user_creation_failed')}`, request.url)
      );
    }

    // Create tracked session
    const session = await createTrackedSession({
      userId: userResult.userId,
      ipAddress,
      userAgent,
      deviceName: userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop',
    });

    // Redirect to dashboard with token
    // In production, you'd set an httpOnly cookie instead of passing token in URL
    const redirectUrl = new URL('/dashboard', request.url);

    // Set auth token as cookie (more secure than URL parameter)
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('auth_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/auth/login?error=internal_error', request.url)
    );
  }
}
