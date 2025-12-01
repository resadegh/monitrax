/**
 * Phase 19.1: Storage Provider OAuth Connection
 * POST /api/settings/storage/connect/[provider] - Initiate OAuth flow
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// OAuth configuration (would be in environment variables)
const OAUTH_CONFIG = {
  google_drive: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/google-drive`,
  },
  icloud: {
    // iCloud uses Sign in with Apple + CloudKit
    clientId: process.env.APPLE_CLIENT_ID,
    authUrl: 'https://appleid.apple.com/auth/authorize',
    scopes: ['name', 'email'],
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/icloud`,
  },
  onedrive: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    scopes: [
      'files.readwrite',
      'user.read',
      'offline_access',
    ],
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback/onedrive`,
  },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await params;
    const providerConfig = OAUTH_CONFIG[provider as keyof typeof OAUTH_CONFIG];

    if (!providerConfig) {
      return NextResponse.json(
        { error: 'Unknown storage provider' },
        { status: 400 }
      );
    }

    if (!providerConfig.clientId) {
      return NextResponse.json(
        {
          error: `${provider} integration is not configured. Please contact support.`,
          configured: false,
        },
        { status: 503 }
      );
    }

    // Generate state parameter for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        userId: user.id,
        provider,
        timestamp: Date.now(),
      })
    ).toString('base64url');

    // Build OAuth URL
    let authUrl: string;

    switch (provider) {
      case 'google_drive':
        authUrl = buildGoogleAuthUrl(providerConfig, state);
        break;
      case 'icloud':
        authUrl = buildAppleAuthUrl(providerConfig, state);
        break;
      case 'onedrive':
        authUrl = buildMicrosoftAuthUrl(providerConfig, state);
        break;
      default:
        return NextResponse.json(
          { error: 'Provider not supported' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      authUrl,
      provider,
    });
  } catch (error) {
    console.error('Failed to initiate OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth connection' },
      { status: 500 }
    );
  }
}

function buildGoogleAuthUrl(
  config: typeof OAUTH_CONFIG.google_drive,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${config.authUrl}?${params.toString()}`;
}

function buildAppleAuthUrl(
  config: typeof OAUTH_CONFIG.icloud,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.redirectUri,
    response_type: 'code id_token',
    scope: config.scopes.join(' '),
    state,
    response_mode: 'form_post',
  });

  return `${config.authUrl}?${params.toString()}`;
}

function buildMicrosoftAuthUrl(
  config: typeof OAUTH_CONFIG.onedrive,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId!,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    prompt: 'select_account',
  });

  return `${config.authUrl}?${params.toString()}`;
}
