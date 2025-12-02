import { NextRequest, NextResponse } from 'next/server';
import { handleOAuthCallback, findOrCreateOAuthUser } from '@/lib/auth/oauth';
import { createTrackedSession } from '@/lib/session';

/**
 * POST /api/auth/callback/apple
 * Handle Apple OAuth callback (Apple uses form_post response mode)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const code = formData.get('code') as string;
    const state = formData.get('state') as string;
    const error = formData.get('error') as string;

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validation
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/signin?error=missing_parameters', request.url)
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Handle OAuth callback - exchange code for tokens and get user info
    const oauthResult = await handleOAuthCallback('apple', code, state);

    if (!oauthResult.success || !oauthResult.user || !oauthResult.tokens) {
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(oauthResult.error || 'oauth_failed')}`, request.url)
      );
    }

    // Find or create user
    const userResult = await findOrCreateOAuthUser(oauthResult.user, oauthResult.tokens);

    if (userResult.error || !userResult.userId) {
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(userResult.error || 'user_creation_failed')}`, request.url)
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
    const redirectUrl = new URL('/dashboard', request.url);

    // Set auth token as cookie
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('auth_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Apple OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/signin?error=internal_error', request.url)
    );
  }
}

/**
 * GET /api/auth/callback/apple
 * Apple may also use GET in some cases
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
        new URL(`/signin?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Validation
    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/signin?error=missing_parameters', request.url)
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Handle OAuth callback - exchange code for tokens and get user info
    const oauthResult = await handleOAuthCallback('apple', code, state);

    if (!oauthResult.success || !oauthResult.user || !oauthResult.tokens) {
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(oauthResult.error || 'oauth_failed')}`, request.url)
      );
    }

    // Find or create user
    const userResult = await findOrCreateOAuthUser(oauthResult.user, oauthResult.tokens);

    if (userResult.error || !userResult.userId) {
      return NextResponse.redirect(
        new URL(`/signin?error=${encodeURIComponent(userResult.error || 'user_creation_failed')}`, request.url)
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
    const redirectUrl = new URL('/dashboard', request.url);

    // Set auth token as cookie
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set('auth_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Apple OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/signin?error=internal_error', request.url)
    );
  }
}
