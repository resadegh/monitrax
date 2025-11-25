import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl, isProviderConfigured } from '@/lib/auth/oauth';

/**
 * GET /api/auth/oauth/microsoft
 * Initiate Microsoft OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    // Check if provider is configured
    if (!isProviderConfigured('microsoft')) {
      return NextResponse.json(
        { error: 'Microsoft OAuth is not configured' },
        { status: 503 }
      );
    }

    // Get optional redirect parameter
    const searchParams = request.nextUrl.searchParams;
    const redirectTo = searchParams.get('redirectTo') || '/dashboard';

    // Generate authorization URL
    const authUrl = getAuthorizationUrl('microsoft', redirectTo);

    // Redirect to Microsoft OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Microsoft OAuth' },
      { status: 500 }
    );
  }
}
