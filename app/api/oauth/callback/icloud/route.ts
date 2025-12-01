/**
 * Phase 19.1: iCloud OAuth Callback (Sign in with Apple)
 * POST /api/oauth/callback/icloud - Handle Apple OAuth callback
 * Note: Apple uses POST with form_post response mode
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Local enum to avoid Prisma generation issues
const StorageProviderType = {
  MONITRAX: 'MONITRAX',
  GOOGLE_DRIVE: 'GOOGLE_DRIVE',
  ICLOUD: 'ICLOUD',
  ONEDRIVE: 'ONEDRIVE',
} as const;

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';

/**
 * Get the base URL from environment or derive from request
 */
function getBaseUrl(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const code = formData.get('code') as string;
    const idToken = formData.get('id_token') as string;
    const state = formData.get('state') as string;
    const error = formData.get('error') as string;

    // Handle error from Apple
    if (error) {
      console.error('Apple OAuth error:', error);
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=access_denied', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=missing_params', request.url)
      );
    }

    // Decode and validate state
    const stateData = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf-8')
    );

    const { userId, provider, timestamp } = stateData;

    // Check state is not too old (5 minutes)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=state_expired', request.url)
      );
    }

    if (provider !== 'icloud') {
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=invalid_provider', request.url)
      );
    }

    // Generate client secret JWT for Apple
    // Note: Apple requires a JWT signed with your private key
    // This is a simplified version - production would need proper JWT signing
    const clientSecret = await generateAppleClientSecret();

    // Exchange code for tokens
    const baseUrl = getBaseUrl(request);
    const tokenResponse = await fetch(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: clientSecret,
        redirect_uri: `${baseUrl}/api/oauth/callback/icloud`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Apple token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Parse user info from id_token (JWT)
    let email: string | undefined;
    if (idToken) {
      try {
        const [, payload] = idToken.split('.');
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
        email = decoded.email;
      } catch {
        console.warn('Failed to decode Apple id_token');
      }
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + (expires_in || 3600) * 1000);

    // Save or update storage provider config
    await prisma.storageProviderConfig.upsert({
      where: { userId },
      create: {
        userId,
        provider: StorageProviderType.ICLOUD,
        isActive: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        config: {
          email,
          connectedAt: new Date().toISOString(),
        },
      },
      update: {
        provider: StorageProviderType.ICLOUD,
        isActive: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        config: {
          email,
          connectedAt: new Date().toISOString(),
        },
      },
    });

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/dashboard/settings/storage?connected=icloud', request.url)
    );
  } catch (error) {
    console.error('iCloud OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings/storage?error=callback_failed', request.url)
    );
  }
}

// Also support GET for error redirects
export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings/storage?error=${error}`, request.url)
    );
  }

  return NextResponse.redirect(
    new URL('/dashboard/settings/storage?error=invalid_request', request.url)
  );
}

/**
 * Generate Apple client secret JWT
 * In production, this should use your Apple private key to sign the JWT
 */
async function generateAppleClientSecret(): Promise<string> {
  // This is a placeholder - production implementation would:
  // 1. Load private key from environment/secrets manager
  // 2. Create JWT with proper claims
  // 3. Sign with ES256 algorithm

  // For now, return empty string (will fail in production)
  // Real implementation would use jose or jsonwebtoken library
  console.warn('Apple client secret generation not fully implemented');
  return process.env.APPLE_CLIENT_SECRET || '';
}
