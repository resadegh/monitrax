import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

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
 * Generate a JWT token
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
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
 * Get the current user from a request's Authorization header
 * For use in API routes
 */
export async function getCurrentUser(request?: Request): Promise<CurrentUser | null> {
  try {
    // If request is provided, use authorization header
    if (request) {
      const authHeader = request.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        return null;
      }

      const payload = verifyToken(token);
      if (!payload) {
        return null;
      }

      return {
        id: payload.userId,
        email: payload.email,
      };
    }

    // Fallback: try to get from cookies (for server components)
    // This requires dynamic import to avoid issues in non-Next.js contexts
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const token = cookieStore.get('auth_token')?.value;

      if (!token) {
        return null;
      }

      const payload = verifyToken(token);
      if (!payload) {
        return null;
      }

      return {
        id: payload.userId,
        email: payload.email,
      };
    } catch {
      return null;
    }
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
