/**
 * Authentication utilities
 *
 * GCP Identity Platform is the sole identity provider.
 * verifyToken() and getCurrentUser() verify GCP/Firebase ID tokens.
 * hashPassword/verifyPassword are retained for local password storage during migration.
 * generateToken() is retained for legacy flows still being migrated.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyGCPIdToken } from '@/lib/auth/gcpTokenVerifier';
import { prisma } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token (legacy — retained for flows still being migrated)
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify a GCP/Firebase ID token and return the local user's userId + email.
 *
 * This replaces the old Monitrax JWT verification. All API routes that call
 * verifyToken() now authenticate against GCP Identity Platform.
 *
 * Returns { userId, email } or null if the token is invalid or no local user exists.
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    // Verify the GCP/Firebase ID token
    const claims = await verifyGCPIdToken(token);
    if (!claims) {
      return null;
    }

    // Look up the local user by GCP UID via OAuthAccount link
    const oauthAccount = await prisma.oAuthAccount.findFirst({
      where: {
        provider: 'gcp-identity',
        providerUserId: claims.uid,
      },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (oauthAccount) {
      return {
        userId: oauthAccount.user.id,
        email: oauthAccount.user.email,
      };
    }

    // Fallback: look up by email (user may not have OAuthAccount yet)
    const user = await prisma.user.findUnique({
      where: { email: claims.email },
      select: { id: true, email: true },
    });

    if (user) {
      return {
        userId: user.id,
        email: user.email,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * User object returned by getCurrentUser
 */
export interface CurrentUser {
  id: string;
  email: string;
}

/**
 * Get the current user from a request's Authorization header.
 * Verifies GCP/Firebase ID tokens — no Monitrax JWTs.
 */
export async function getCurrentUser(request?: Request): Promise<CurrentUser | null> {
  try {
    if (!request) {
      return null;
    }

    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return null;
    }

    return {
      id: payload.userId,
      email: payload.email,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
