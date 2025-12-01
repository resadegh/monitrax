/**
 * Phase 19.1: OneDrive OAuth Callback
 * GET /api/oauth/callback/onedrive - Handle Microsoft OAuth callback
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StorageProviderType } from '@prisma/client';

const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0/me';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle error from Microsoft
  if (error) {
    console.error('Microsoft OAuth error:', error, errorDescription);
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

    if (provider !== 'onedrive') {
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=invalid_provider', request.url)
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/onedrive`,
        grant_type: 'authorization_code',
        scope: 'files.readwrite user.read offline_access',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Microsoft token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/dashboard/settings/storage?error=token_exchange_failed', request.url)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch(MICROSOFT_GRAPH_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    let email: string | undefined;
    let displayName: string | undefined;
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      email = userInfo.mail || userInfo.userPrincipalName;
      displayName = userInfo.displayName;
    }

    // Calculate token expiry
    const tokenExpiry = new Date(Date.now() + expires_in * 1000);

    // Save or update storage provider config
    await prisma.storageProviderConfig.upsert({
      where: { userId },
      create: {
        userId,
        provider: StorageProviderType.ONEDRIVE,
        isActive: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        config: {
          email,
          displayName,
          connectedAt: new Date().toISOString(),
        },
      },
      update: {
        provider: StorageProviderType.ONEDRIVE,
        isActive: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiry,
        config: {
          email,
          displayName,
          connectedAt: new Date().toISOString(),
        },
      },
    });

    // Redirect back to settings with success
    return NextResponse.redirect(
      new URL('/dashboard/settings/storage?connected=onedrive', request.url)
    );
  } catch (error) {
    console.error('OneDrive OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings/storage?error=callback_failed', request.url)
    );
  }
}
