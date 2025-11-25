import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl, isProviderConfigured } from '@/lib/auth/oauth';

/**
 * GET /api/auth/oauth/facebook
 * Initiate Facebook OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    // Check if provider is configured
    if (!isProviderConfigured('facebook')) {
      return NextResponse.json(
        { error: 'Facebook OAuth is not configured' },
        { status: 503 }
      );
    }

    // Get optional redirect parameter
    const searchParams = request.nextUrl.searchParams;
    const redirectTo = searchParams.get('redirectTo') || '/dashboard';

    // Generate authorization URL
    const authUrl = getAuthorizationUrl('facebook', redirectTo);

    // Redirect to Facebook OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Facebook OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Facebook OAuth' },
      { status: 500 }
    );
  }
}
