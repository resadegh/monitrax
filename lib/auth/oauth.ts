/**
 * OAuth Provider Integration - Phase 05
 *
 * Provides OAuth2/OIDC integration stubs for Google, Apple, and Microsoft.
 * Ready for production implementation with environment configuration.
 */

// =============================================================================
// TYPES
// =============================================================================

export type OAuthProvider = 'google' | 'apple' | 'microsoft';

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

  // TODO: Implement actual token exchange
  // This is a stub - in production, make HTTP request to tokenUrl
  console.log(`[OAuth] Token exchange for ${provider} with code: ${code.substring(0, 10)}...`);

  return {
    success: false,
    error: `${provider} OAuth token exchange not yet implemented`,
  };
}

/**
 * Get user info from OAuth provider
 */
export async function getOAuthUserInfo(
  provider: OAuthProvider,
  accessToken: string
): Promise<{ success: boolean; user?: OAuthUser; error?: string }> {
  const config = OAUTH_PROVIDERS[provider];

  if (!config.userInfoUrl && provider !== 'apple') {
    return { success: false, error: `${provider} user info URL not configured` };
  }

  // TODO: Implement actual user info fetch
  // This is a stub - in production, make HTTP request to userInfoUrl
  console.log(`[OAuth] Fetching user info for ${provider}`);

  return {
    success: false,
    error: `${provider} OAuth user info fetch not yet implemented`,
  };
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
  const userResult = await getOAuthUserInfo(provider, tokenResult.tokens.accessToken);
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
  oauthUser: OAuthUser
): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement account linking logic
  // Store OAuth account association in database
  console.log(`[OAuth] Linking ${oauthUser.provider} account to user ${userId}`);

  return {
    success: false,
    error: 'OAuth account linking not yet implemented',
  };
}

/**
 * Unlink OAuth account from user
 */
export async function unlinkOAuthAccount(
  userId: string,
  provider: OAuthProvider
): Promise<{ success: boolean; error?: string }> {
  // TODO: Implement account unlinking logic
  console.log(`[OAuth] Unlinking ${provider} account from user ${userId}`);

  return {
    success: false,
    error: 'OAuth account unlinking not yet implemented',
  };
}
