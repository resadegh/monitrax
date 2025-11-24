/**
 * Refresh Token Rotation - Phase 05
 *
 * Implements secure refresh token management with rotation on use.
 * Tokens are bound to device fingerprints for added security.
 */

import { randomBytes, createHash } from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  deviceFingerprint: string;
  familyId: string; // Token family for rotation tracking
  expiresAt: Date;
  createdAt: Date;
  rotatedAt: Date | null;
  isRevoked: boolean;
  revokedAt: Date | null;
  revokedReason?: string;
}

export interface CreateRefreshTokenInput {
  userId: string;
  deviceFingerprint: string;
  expiresInDays?: number;
  familyId?: string; // For rotation - inherit family from parent
}

export interface RefreshTokenResult {
  token: string;
  tokenId: string;
  expiresAt: Date;
}

export interface ValidateRefreshTokenResult {
  valid: boolean;
  userId?: string;
  tokenId?: string;
  familyId?: string;
  error?: string;
  requiresRotation?: boolean;
}

export interface RotateRefreshTokenResult {
  success: boolean;
  newToken?: RefreshTokenResult;
  error?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export const REFRESH_TOKEN_CONFIG = {
  defaultExpiryDays: 30,
  maxExpiryDays: 90,
  tokenLength: 64,
  rotationGracePeriodMs: 60 * 1000, // 1 minute grace for concurrent requests
  maxTokensPerUser: 10,
  maxTokensPerFamily: 5,
};

// =============================================================================
// IN-MEMORY STORE (Redis-ready architecture)
// =============================================================================

// In production, replace with Redis or database
const refreshTokenStore = new Map<string, RefreshToken>();
const userTokenIndex = new Map<string, Set<string>>(); // userId -> tokenIds
const familyTokenIndex = new Map<string, Set<string>>(); // familyId -> tokenIds

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return randomBytes(REFRESH_TOKEN_CONFIG.tokenLength).toString('base64url');
}

/**
 * Generate a unique token ID
 */
function generateTokenId(): string {
  return `rt_${randomBytes(16).toString('hex')}`;
}

/**
 * Generate a family ID for token rotation tracking
 */
function generateFamilyId(): string {
  return `fam_${randomBytes(8).toString('hex')}`;
}

/**
 * Hash a token for secure storage
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Generate device fingerprint from request headers
 */
export function generateDeviceFingerprint(
  userAgent: string,
  ip: string,
  additionalData?: string
): string {
  const data = `${userAgent}|${ip}|${additionalData || ''}`;
  return createHash('sha256').update(data).digest('hex').substring(0, 32);
}

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

/**
 * Create a new refresh token
 */
export async function createRefreshToken(
  input: CreateRefreshTokenInput
): Promise<RefreshTokenResult> {
  const {
    userId,
    deviceFingerprint,
    expiresInDays = REFRESH_TOKEN_CONFIG.defaultExpiryDays,
    familyId = generateFamilyId(),
  } = input;

  // Enforce user token limit
  const userTokens = userTokenIndex.get(userId) || new Set();
  if (userTokens.size >= REFRESH_TOKEN_CONFIG.maxTokensPerUser) {
    // Revoke oldest token
    const oldestTokenId = Array.from(userTokens)[0];
    if (oldestTokenId) {
      await revokeRefreshToken(oldestTokenId, 'Max tokens exceeded');
    }
  }

  const token = generateToken();
  const tokenId = generateTokenId();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + Math.min(expiresInDays, REFRESH_TOKEN_CONFIG.maxExpiryDays) * 24 * 60 * 60 * 1000
  );

  const refreshToken: RefreshToken = {
    id: tokenId,
    userId,
    tokenHash,
    deviceFingerprint,
    familyId,
    expiresAt,
    createdAt: new Date(),
    rotatedAt: null,
    isRevoked: false,
    revokedAt: null,
  };

  // Store token
  refreshTokenStore.set(tokenId, refreshToken);

  // Update indexes
  if (!userTokenIndex.has(userId)) {
    userTokenIndex.set(userId, new Set());
  }
  userTokenIndex.get(userId)!.add(tokenId);

  if (!familyTokenIndex.has(familyId)) {
    familyTokenIndex.set(familyId, new Set());
  }
  familyTokenIndex.get(familyId)!.add(tokenId);

  return {
    token: `${tokenId}.${token}`,
    tokenId,
    expiresAt,
  };
}

/**
 * Validate a refresh token
 */
export async function validateRefreshToken(
  fullToken: string,
  deviceFingerprint?: string
): Promise<ValidateRefreshTokenResult> {
  // Parse token format: tokenId.token
  const parts = fullToken.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Invalid token format' };
  }

  const [tokenId, token] = parts;
  const storedToken = refreshTokenStore.get(tokenId);

  if (!storedToken) {
    return { valid: false, error: 'Token not found' };
  }

  // Check if revoked
  if (storedToken.isRevoked) {
    // Token reuse detected - revoke entire family (security breach)
    await revokeTokenFamily(storedToken.familyId, 'Token reuse detected');
    return { valid: false, error: 'Token has been revoked - possible security breach' };
  }

  // Check expiration
  if (new Date() > storedToken.expiresAt) {
    return { valid: false, error: 'Token expired' };
  }

  // Verify token hash
  const tokenHash = hashToken(token);
  if (tokenHash !== storedToken.tokenHash) {
    return { valid: false, error: 'Invalid token' };
  }

  // Verify device fingerprint if provided
  if (deviceFingerprint && deviceFingerprint !== storedToken.deviceFingerprint) {
    return { valid: false, error: 'Device fingerprint mismatch' };
  }

  // Check if token was already rotated (but within grace period)
  const requiresRotation = storedToken.rotatedAt === null;

  return {
    valid: true,
    userId: storedToken.userId,
    tokenId: storedToken.id,
    familyId: storedToken.familyId,
    requiresRotation,
  };
}

/**
 * Rotate a refresh token (issue new token and revoke old one)
 */
export async function rotateRefreshToken(
  fullToken: string,
  deviceFingerprint: string
): Promise<RotateRefreshTokenResult> {
  const validation = await validateRefreshToken(fullToken, deviceFingerprint);

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const { userId, tokenId, familyId } = validation;

  if (!userId || !tokenId || !familyId) {
    return { success: false, error: 'Invalid token data' };
  }

  // Mark old token as rotated (not revoked - grace period for concurrent requests)
  const oldToken = refreshTokenStore.get(tokenId);
  if (oldToken) {
    oldToken.rotatedAt = new Date();

    // Schedule revocation after grace period
    setTimeout(() => {
      if (refreshTokenStore.has(tokenId)) {
        const token = refreshTokenStore.get(tokenId)!;
        token.isRevoked = true;
        token.revokedAt = new Date();
        token.revokedReason = 'Rotated';
      }
    }, REFRESH_TOKEN_CONFIG.rotationGracePeriodMs);
  }

  // Create new token in the same family
  const newToken = await createRefreshToken({
    userId,
    deviceFingerprint,
    familyId, // Inherit family for rotation tracking
  });

  return {
    success: true,
    newToken,
  };
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(
  tokenId: string,
  reason?: string
): Promise<boolean> {
  const token = refreshTokenStore.get(tokenId);
  if (!token) {
    return false;
  }

  token.isRevoked = true;
  token.revokedAt = new Date();
  token.revokedReason = reason;

  return true;
}

/**
 * Revoke all tokens in a family (security breach response)
 */
export async function revokeTokenFamily(
  familyId: string,
  reason?: string
): Promise<number> {
  const tokenIds = familyTokenIndex.get(familyId);
  if (!tokenIds) {
    return 0;
  }

  let count = 0;
  for (const tokenId of tokenIds) {
    if (await revokeRefreshToken(tokenId, reason)) {
      count++;
    }
  }

  return count;
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserRefreshTokens(
  userId: string,
  reason?: string
): Promise<number> {
  const tokenIds = userTokenIndex.get(userId);
  if (!tokenIds) {
    return 0;
  }

  let count = 0;
  for (const tokenId of tokenIds) {
    if (await revokeRefreshToken(tokenId, reason)) {
      count++;
    }
  }

  return count;
}

/**
 * Get all active refresh tokens for a user
 */
export async function getUserRefreshTokens(userId: string): Promise<RefreshToken[]> {
  const tokenIds = userTokenIndex.get(userId);
  if (!tokenIds) {
    return [];
  }

  const tokens: RefreshToken[] = [];
  for (const tokenId of tokenIds) {
    const token = refreshTokenStore.get(tokenId);
    if (token && !token.isRevoked && new Date() < token.expiresAt) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Cleanup expired tokens (call periodically)
 */
export function cleanupExpiredTokens(): number {
  const now = new Date();
  let count = 0;

  for (const [tokenId, token] of refreshTokenStore.entries()) {
    if (token.isRevoked || now > token.expiresAt) {
      refreshTokenStore.delete(tokenId);

      // Update indexes
      const userTokens = userTokenIndex.get(token.userId);
      if (userTokens) {
        userTokens.delete(tokenId);
        if (userTokens.size === 0) {
          userTokenIndex.delete(token.userId);
        }
      }

      const familyTokens = familyTokenIndex.get(token.familyId);
      if (familyTokens) {
        familyTokens.delete(tokenId);
        if (familyTokens.size === 0) {
          familyTokenIndex.delete(token.familyId);
        }
      }

      count++;
    }
  }

  return count;
}
