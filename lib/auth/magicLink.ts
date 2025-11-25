/**
 * Magic Link Authentication
 * Phase 10: Passwordless authentication via email
 */

import { prisma } from '@/lib/db';
import * as crypto from 'crypto';
import { generateToken } from '@/lib/auth';
import { logAuth } from '@/lib/security/auditLog';
import { log } from '@/lib/utils/logger';

// ============================================
// TYPES
// ============================================

export interface MagicLinkRequest {
  email: string;
  redirectTo?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface MagicLinkVerification {
  token: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface MagicLinkResult {
  success: boolean;
  token?: string;
  userId?: string;
  error?: string;
}

// ============================================
// CONFIGURATION
// ============================================

const MAGIC_LINK_EXPIRY = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_HOUR = 5;

// ============================================
// MAGIC LINK GENERATION
// ============================================

/**
 * Generate a secure magic link token
 */
function generateMagicLinkToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create a magic link for passwordless login
 */
export async function createMagicLink(request: MagicLinkRequest): Promise<{
  success: boolean;
  token?: string;
  expiresAt?: Date;
  error?: string;
}> {
  const { email, redirectTo, ipAddress, userAgent } = request;

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      await logAuth({
        action: 'LOGIN',
        status: 'FAILURE',
        ipAddress,
        userAgent,
        metadata: { reason: 'user_not_found', email },
      });

      // Return success to prevent email enumeration
      return {
        success: true,
      };
    }

    // Check rate limiting - max 5 attempts per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await prisma.magicLink.count({
      where: {
        userId: user.id,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentAttempts >= MAX_ATTEMPTS_PER_HOUR) {
      await logAuth({
        userId: user.id,
        action: 'LOGIN',
        status: 'BLOCKED',
        ipAddress,
        userAgent,
        metadata: { reason: 'rate_limit_exceeded', attempts: recentAttempts },
      });

      return {
        success: false,
        error: 'Too many magic link requests. Please try again later.',
      };
    }

    // Generate token and expiry
    const token = generateMagicLinkToken();
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY);

    // Store magic link in database
    await prisma.magicLink.create({
      data: {
        userId: user.id,
        token,
        email: user.email,
        expiresAt,
        redirectTo,
        ipAddress,
        userAgent,
      },
    });

    await logAuth({
      userId: user.id,
      action: 'LOGIN',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { method: 'magic_link_request' },
    });

    return {
      success: true,
      token,
      expiresAt,
    };
  } catch (error) {
    log.error('Failed to create magic link', error as Error);
    return {
      success: false,
      error: 'Failed to create magic link',
    };
  }
}

/**
 * Verify magic link and log user in
 */
export async function verifyMagicLink(
  verification: MagicLinkVerification
): Promise<MagicLinkResult> {
  const { token, ipAddress, userAgent } = verification;

  try {
    // Find magic link
    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
    });

    if (!magicLink) {
      await logAuth({
        action: 'LOGIN',
        status: 'FAILURE',
        ipAddress,
        userAgent,
        metadata: { reason: 'invalid_magic_link' },
      });

      return {
        success: false,
        error: 'Invalid or expired magic link',
      };
    }

    // Check if already used
    if (magicLink.usedAt) {
      await logAuth({
        userId: magicLink.userId,
        action: 'LOGIN',
        status: 'FAILURE',
        ipAddress,
        userAgent,
        metadata: { reason: 'magic_link_already_used' },
      });

      return {
        success: false,
        error: 'This magic link has already been used',
      };
    }

    // Check if expired
    if (magicLink.expiresAt < new Date()) {
      await logAuth({
        userId: magicLink.userId,
        action: 'LOGIN',
        status: 'FAILURE',
        ipAddress,
        userAgent,
        metadata: { reason: 'magic_link_expired' },
      });

      return {
        success: false,
        error: 'This magic link has expired',
      };
    }

    // Mark as used
    await prisma.magicLink.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    // Generate JWT token
    const jwtToken = generateToken({
      userId: magicLink.user.id,
      email: magicLink.user.email,
    });

    // Update last login
    await prisma.user.update({
      where: { id: magicLink.userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    await logAuth({
      userId: magicLink.userId,
      action: 'LOGIN',
      status: 'SUCCESS',
      ipAddress,
      userAgent,
      metadata: { method: 'magic_link' },
    });

    return {
      success: true,
      token: jwtToken,
      userId: magicLink.userId,
    };
  } catch (error) {
    log.error('Failed to verify magic link', error as Error);
    return {
      success: false,
      error: 'Failed to verify magic link',
    };
  }
}

/**
 * Clean up expired magic links
 */
export async function cleanupExpiredMagicLinks(): Promise<number> {
  try {
    const result = await prisma.magicLink.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            usedAt: { not: null },
            createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days old
          },
        ],
      },
    });

    log.info('Cleaned up expired magic links', { count: result.count });
    return result.count;
  } catch (error) {
    log.error('Failed to cleanup magic links', error as Error);
    return 0;
  }
}

/**
 * Revoke all magic links for a user
 */
export async function revokeMagicLinks(userId: string): Promise<number> {
  try {
    const result = await prisma.magicLink.deleteMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    await logAuth({
      userId,
      action: 'LOGIN',
      status: 'SUCCESS',
      metadata: { action: 'magic_links_revoked', count: result.count },
    });

    return result.count;
  } catch (error) {
    log.error('Failed to revoke magic links', error as Error);
    return 0;
  }
}

/**
 * Get magic link statistics for a user
 */
export async function getMagicLinkStats(userId: string): Promise<{
  totalRequests: number;
  usedLinks: number;
  expiredLinks: number;
  activeLinks: number;
}> {
  const [total, used, expired, active] = await Promise.all([
    prisma.magicLink.count({ where: { userId } }),
    prisma.magicLink.count({ where: { userId, usedAt: { not: null } } }),
    prisma.magicLink.count({
      where: { userId, expiresAt: { lt: new Date() }, usedAt: null },
    }),
    prisma.magicLink.count({
      where: { userId, expiresAt: { gt: new Date() }, usedAt: null },
    }),
  ]);

  return {
    totalRequests: total,
    usedLinks: used,
    expiredLinks: expired,
    activeLinks: active,
  };
}
