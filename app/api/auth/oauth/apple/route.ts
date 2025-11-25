import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl, isProviderConfigured } from '@/lib/auth/oauth';

/**
 * GET /api/auth/oauth/apple
 * Initiate Apple OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    // Check if provider is configured
    if (!isProviderConfigured('apple')) {
      return NextResponse.json(
        { error: 'Apple OAuth is not configured' },
        { status: 503 }
      );
    }

    // Get optional redirect parameter
    const searchParams = request.nextUrl.searchParams;
    const redirectTo = searchParams.get('redirectTo') || '/dashboard';

    // Generate authorization URL
    const authUrl = getAuthorizationUrl('apple', redirectTo);

    // Redirect to Apple OAuth
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Apple OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Apple OAuth' },
      { status: 500 }
    );
  }
}
