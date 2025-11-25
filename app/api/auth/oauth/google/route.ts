import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl, isProviderConfigured } from '@/lib/auth/oauth';

/**
 * GET /api/auth/oauth/google
 * Initiate Google OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    // Check if provider is configured
    if (!isProviderConfigured('google')) {
      return NextResponse.json(
        { error: 'Google OAuth is not configured' },
        { status: 503 }
      );
    }

    // Get optional redirect parameter
    const searchParams = request.nextUrl.searchParams;
    const redirectTo = searchParams.get('redirectTo') || '/dashboard';

    // Generate authorization URL
    const authUrl = getAuthorizationUrl('google', redirectTo);

    // Redirect to Google OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Google OAuth' },
      { status: 500 }
    );
  }
}
