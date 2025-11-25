import { NextResponse } from 'next/server';
import { getConfiguredProviders } from '@/lib/auth/oauth';

/**
 * GET /api/auth/providers
 * Get list of configured OAuth providers
 */
export async function GET() {
  try {
    const providers = getConfiguredProviders();

    return NextResponse.json({
      providers,
      available: {
        google: providers.includes('google'),
        facebook: providers.includes('facebook'),
        apple: providers.includes('apple'),
        microsoft: providers.includes('microsoft'),
      },
    });
  } catch (error) {
    console.error('Get providers error:', error);
    return NextResponse.json(
      { error: 'Failed to get configured providers' },
      { status: 500 }
    );
  }
}
