/**
 * OAuth Provider Integration - Phase 05
 *
 * Provides OAuth2/OIDC integration stubs for Google, Apple, and Microsoft.
 * Ready for production implementation with environment configuration.
 */

// =============================================================================
// TYPES
// =============================================================================

export type OAuthProvider = 'google' | 'apple' | 'microsoft' | 'facebook';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

export interface OAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  provider: OAuthProvider;
  providerAccountId: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface OAuthResult {
  success: boolean;
  user?: OAuthUser;
  tokens?: OAuthTokens;
  error?: string;
}

// =============================================================================
// PROVIDER CONFIGURATIONS
// =============================================================================

export const OAUTH_PROVIDERS: Record<OAuthProvider, OAuthConfig> = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '/api/auth/callback/google',
    scopes: ['openid', 'email', 'profile'],
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID || '',
    clientSecret: process.env.APPLE_CLIENT_SECRET || '',
    redirectUri: process.env.APPLE_REDIRECT_URI || '/api/auth/callback/apple',
    scopes: ['name', 'email'],
    authorizationUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    userInfoUrl: '', // Apple returns user info in ID token
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || '/api/auth/callback/microsoft',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID || '',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || '/api/auth/callback/facebook',
    scopes: ['email', 'public_profile'],
    authorizationUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/v18.0/me?fields=id,name,email,first_name,last_name,picture',
  },
};

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

// In-memory state store for CSRF protection (use Redis in production)
const stateStore = new Map<string, { provider: OAuthProvider; createdAt: Date; redirectTo?: string }>();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate OAuth state parameter for CSRF protection
 */
export function generateOAuthState(provider: OAuthProvider, redirectTo?: string): string {
  const state = `${provider}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  stateStore.set(state, { provider, createdAt: new Date(), redirectTo });
  return state;
}

/**
 * Validate OAuth state parameter
 */
export function validateOAuthState(state: string): { valid: boolean; provider?: OAuthProvider; redirectTo?: string } {
  const stored = stateStore.get(state);
  if (!stored) {
    return { valid: false };
  }

  // Check expiry
  if (Date.now() - stored.createdAt.getTime() > STATE_EXPIRY_MS) {
    stateStore.delete(state);
    return { valid: false };
  }

  stateStore.delete(state);
  return { valid: true, provider: stored.provider, redirectTo: stored.redirectTo };
}

// =============================================================================
// AUTHORIZATION URL GENERATION
// =============================================================================

/**
 * Get OAuth authorization URL
 */
export function getAuthorizationUrl(provider: OAuthProvider, redirectTo?: string): string {
  const config = OAUTH_PROVIDERS[provider];
  const state = generateOAuthState(provider, redirectTo);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });

  // Provider-specific parameters
  if (provider === 'google') {
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  }

  if (provider === 'apple') {
    params.set('response_mode', 'form_post');
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

// =============================================================================
// TOKEN EXCHANGE (Stubs - implement with actual API calls)
// =============================================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string
): Promise<{ success: boolean; tokens?: OAuthTokens; error?: string }> {
  const config = OAUTH_PROVIDERS[provider];

  if (!config.clientId || !config.clientSecret) {
    return { success: false, error: `${provider} OAuth not configured` };
  }

  try {
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[OAuth] Token exchange failed for ${provider}:`, error);
      return { success: false, error: `Token exchange failed: ${response.statusText}` };
    }

    const data = await response.json();

    return {
      success: true,
      tokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        idToken: data.id_token,
        expiresIn: data.expires_in || 3600,
        tokenType: data.token_type || 'Bearer',
      },
    };
  } catch (error) {
    console.error(`[OAuth] Token exchange error for ${provider}:`, error);
    return { success: false, error: `Token exchange failed: ${(error as Error).message}` };
  }
}

/**
 * Get user info from OAuth provider
 */
export async function getOAuthUserInfo(
  provider: OAuthProvider,
  accessToken: string,
  idToken?: string
): Promise<{ success: boolean; user?: OAuthUser; error?: string }> {
  const config = OAUTH_PROVIDERS[provider];

  try {
    // Apple returns user info in ID token
    if (provider === 'apple' && idToken) {
      return parseAppleIdToken(idToken);
    }

    if (!config.userInfoUrl) {
      return { success: false, error: `${provider} user info URL not configured` };
    }

    const response = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`[OAuth] User info fetch failed for ${provider}:`, response.statusText);
      return { success: false, error: `User info fetch failed: ${response.statusText}` };
    }

    const data = await response.json();

    // Parse provider-specific response
    let user: OAuthUser;

    if (provider === 'google') {
      user = {
        id: data.sub,
        email: data.email,
        emailVerified: data.email_verified || false,
        name: data.name,
        firstName: data.given_name,
        lastName: data.family_name,
        picture: data.picture,
        provider: 'google',
        providerAccountId: data.sub,
      };
    } else if (provider === 'microsoft') {
      user = {
        id: data.id,
        email: data.mail || data.userPrincipalName,
        emailVerified: true, // Microsoft accounts are verified
        name: data.displayName,
        firstName: data.givenName,
        lastName: data.surname,
        provider: 'microsoft',
        providerAccountId: data.id,
      };
    } else if (provider === 'facebook') {
      user = {
        id: data.id,
        email: data.email,
        emailVerified: true, // Facebook accounts are verified
        name: data.name,
        firstName: data.first_name,
        lastName: data.last_name,
        picture: data.picture?.data?.url,
        provider: 'facebook',
        providerAccountId: data.id,
      };
    } else {
      return { success: false, error: 'Unsupported provider' };
    }

    return { success: true, user };
  } catch (error) {
    console.error(`[OAuth] User info error for ${provider}:`, error);
    return { success: false, error: `User info fetch failed: ${(error as Error).message}` };
  }
}

/**
 * Parse Apple ID token to extract user info
 */
function parseAppleIdToken(idToken: string): { success: boolean; user?: OAuthUser; error?: string } {
  try {
    // ID token is a JWT - decode the payload
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return { success: false, error: 'Invalid ID token format' };
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    const user: OAuthUser = {
      id: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === 'true' || payload.email_verified === true,
      provider: 'apple',
      providerAccountId: payload.sub,
    };

    return { success: true, user };
  } catch (error) {
    console.error('[OAuth] Apple ID token parsing error:', error);
    return { success: false, error: 'Failed to parse Apple ID token' };
  }
}

// =============================================================================
// FULL OAUTH FLOW
// =============================================================================

/**
 * Complete OAuth flow: exchange code and get user info
 */
export async function handleOAuthCallback(
  provider: OAuthProvider,
  code: string,
  state: string
): Promise<OAuthResult> {
  // Validate state
  const stateValidation = validateOAuthState(state);
  if (!stateValidation.valid) {
    return { success: false, error: 'Invalid or expired state parameter' };
  }

  if (stateValidation.provider !== provider) {
    return { success: false, error: 'Provider mismatch' };
  }

  // Exchange code for tokens
  const tokenResult = await exchangeCodeForTokens(provider, code);
  if (!tokenResult.success || !tokenResult.tokens) {
    return { success: false, error: tokenResult.error };
  }

  // Get user info
  const userResult = await getOAuthUserInfo(
    provider,
    tokenResult.tokens.accessToken,
    tokenResult.tokens.idToken
  );
  if (!userResult.success || !userResult.user) {
    return { success: false, error: userResult.error };
  }

  return {
    success: true,
    user: userResult.user,
    tokens: tokenResult.tokens,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a provider is configured
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  const config = OAUTH_PROVIDERS[provider];
  return !!(config.clientId && config.clientSecret);
}

/**
 * Get list of configured providers
 */
export function getConfiguredProviders(): OAuthProvider[] {
  return (['google', 'apple', 'microsoft'] as OAuthProvider[]).filter(isProviderConfigured);
}

/**
 * Link OAuth account to existing user
 */
export async function linkOAuthAccount(
  userId: string,
  oauthUser: OAuthUser,
  tokens: OAuthTokens
): Promise<{ success: boolean; error?: string }> {
  try {
    const { prisma } = await import('@/lib/db');

    // Check if OAuth account already linked to another user
    const existing = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: oauthUser.provider,
          providerUserId: oauthUser.providerAccountId,
        },
      },
    });

    if (existing && existing.userId !== userId) {
      return {
        success: false,
        error: 'This OAuth account is already linked to another user',
      };
    }

    if (existing) {
      // Update existing link
      await prisma.oAuthAccount.update({
        where: { id: existing.id },
        data: {
          email: oauthUser.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresIn
            ? new Date(Date.now() + tokens.expiresIn * 1000)
            : null,
          tokenType: tokens.tokenType,
        },
      });
    } else {
      // Create new link
      await prisma.oAuthAccount.create({
        data: {
          userId,
          provider: oauthUser.provider,
          providerUserId: oauthUser.providerAccountId,
          email: oauthUser.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresIn
            ? new Date(Date.now() + tokens.expiresIn * 1000)
            : null,
          tokenType: tokens.tokenType,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[OAuth] Account linking error:', error);
    return {
      success: false,
      error: `Failed to link ${oauthUser.provider} account`,
    };
  }
}

/**
 * Unlink OAuth account from user
 */
export async function unlinkOAuthAccount(
  userId: string,
  provider: OAuthProvider
): Promise<{ success: boolean; error?: string }> {
  try {
    const { prisma } = await import('@/lib/db');

    const result = await prisma.oAuthAccount.deleteMany({
      where: {
        userId,
        provider,
      },
    });

    if (result.count === 0) {
      return {
        success: false,
        error: 'OAuth account not found or already unlinked',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[OAuth] Account unlinking error:', error);
    return {
      success: false,
      error: `Failed to unlink ${provider} account`,
    };
  }
}

/**
 * Find or create user from OAuth account
 */
export async function findOrCreateOAuthUser(
  oauthUser: OAuthUser,
  tokens: OAuthTokens
): Promise<{ userId: string; isNewUser: boolean; error?: string }> {
  try {
    const { prisma } = await import('@/lib/db');
    const { generateToken, hashPassword } = await import('@/lib/auth');

    // Check if OAuth account already exists
    const oauthAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: oauthUser.provider,
          providerUserId: oauthUser.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (oauthAccount) {
      // Update tokens
      await prisma.oAuthAccount.update({
        where: { id: oauthAccount.id },
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresIn
            ? new Date(Date.now() + tokens.expiresIn * 1000)
            : null,
        },
      });

      return {
        userId: oauthAccount.userId,
        isNewUser: false,
      };
    }

    // Check if user exists by email
    let user = await prisma.user.findUnique({
      where: { email: oauthUser.email },
    });

    if (user) {
      // Link OAuth account to existing user
      await prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: oauthUser.provider,
          providerUserId: oauthUser.providerAccountId,
          email: oauthUser.email,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresIn
            ? new Date(Date.now() + tokens.expiresIn * 1000)
            : null,
          tokenType: tokens.tokenType,
        },
      });

      return {
        userId: user.id,
        isNewUser: false,
      };
    }

    // Create new user
    user = await prisma.user.create({
      data: {
        email: oauthUser.email,
        name: oauthUser.name || oauthUser.email.split('@')[0],
        password: null, // OAuth users don't have passwords
        emailVerified: oauthUser.emailVerified,
        emailVerifiedAt: oauthUser.emailVerified ? new Date() : null,
      },
    });

    // Create OAuth account link
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: oauthUser.provider,
        providerUserId: oauthUser.providerAccountId,
        email: oauthUser.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresIn
          ? new Date(Date.now() + tokens.expiresIn * 1000)
          : null,
        tokenType: tokens.tokenType,
      },
    });

    return {
      userId: user.id,
      isNewUser: true,
    };
  } catch (error) {
    console.error('[OAuth] Find or create user error:', error);
    return {
      userId: '',
      isNewUser: false,
      error: 'Failed to find or create user',
    };
  }
}
