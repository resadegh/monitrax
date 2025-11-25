import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@/lib/auth/passkey';

/**
 * POST /api/auth/passkey/authenticate/options
 * Generate passkey authentication options (public endpoint for login)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Generate authentication options
    // If email is provided, limit to that user's passkeys
    const options = await generateAuthenticationOptions({
      userEmail: email,
    });

    return NextResponse.json({
      options,
    });
  } catch (error) {
    console.error('Passkey authentication options error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
