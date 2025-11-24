/**
 * Authentication Context
 * Defines the authenticated user context and extraction utilities
 */

import { NextRequest } from 'next/server';
import { verifyToken, extractTokenFromHeader } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';
import { UserRole } from './permissions';

// ============================================
// AUTH CONTEXT TYPE
// ============================================

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  tenantId: string; // In single-user mode, tenant = user
}

// ============================================
// CONTEXT EXTRACTION
// ============================================

/**
 * Extract authentication context from request
 * Returns null if not authenticated
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return null;
    }

    const payload = verifyToken(token);

    if (!payload || !payload.userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
      },
    });

    if (!user) {
      log.warn('User not found for valid token', { userId: payload.userId });
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      tenantId: user.id, // In single-user mode, tenant = user
    };
  } catch (error) {
    log.error('Auth context extraction failed', error as Error);
    return null;
  }
}

/**
 * Get auth context or throw an error
 * Use this when authentication is required
 */
export async function requireAuthContext(request: NextRequest): Promise<AuthContext> {
  const context = await getAuthContext(request);

  if (!context) {
    throw new Error('Authentication required');
  }

  return context;
}
