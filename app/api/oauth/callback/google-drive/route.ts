/**
 * Phase 19.1: Google Drive OAuth Callback
 * GET /api/oauth/callback/google-drive - Handle OAuth callback
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StorageProviderType } from '@prisma/client';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle error from Google
  if (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings/storage?error=access_denied', request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/dashboard/settings/storage?error=missing_params', request.url)
    );
  }

  try {
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

    if (provider !== 'google_drive') {
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=invalid_provider', request.url)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/google-drive`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get user info from Google
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    let email: string | undefined;
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      email = userInfo.email;
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // Save or update storage provider config
    await prisma.storageProviderConfig.upsert({
      where: { userId },
      create: {
        userId,
        provider: StorageProviderType.GOOGLE_DRIVE,
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
        provider: StorageProviderType.GOOGLE_DRIVE,
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
      new URL('/dashboard/settings/storage?connected=google_drive', request.url)
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings/storage?error=callback_failed', request.url)
    );
  }
}
