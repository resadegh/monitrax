/**
 * Account Lockout Service - Phase 10
 *
 * Protects against brute force attacks by locking accounts
 * after multiple failed login attempts.
 */

import { prisma } from '@/lib/db';
import { logSecurity, logAdmin } from './auditLog';
import { log } from '@/lib/utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10);
const LOCKOUT_DURATION_MINUTES = parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10);
const ATTEMPT_WINDOW_MINUTES = parseInt(process.env.ATTEMPT_WINDOW_MINUTES || '15', 10);

// =============================================================================
// TYPES
// =============================================================================

export interface LockoutStatus {
  isLocked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockoutExpiresAt?: Date;
  nextAttemptAllowedAt?: Date;
}

export interface LockoutInfo {
  userId: string;
  email: string;
  failedAttempts: number;
  lockedUntil: Date | null;
  lastAttemptAt: Date;
  lastAttemptIp: string | null;
}

// =============================================================================
// FAILED ATTEMPT TRACKING
// =============================================================================

/**
 * Record a failed login attempt
 */
export async function recordFailedLoginAttempt(
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<LockoutStatus> {
  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists - return generic locked status
      return {
        isLocked: false,
        attempts: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
      };
    }

    // Get recent failed attempts within the attempt window
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

    const recentAttempts = await prisma.loginAttempt.count({
      where: {
        userId: user.id,
        success: false,
        attemptedAt: { gte: windowStart },
      },
    });

    const newAttemptCount = recentAttempts + 1;

    // Record this attempt
    await prisma.loginAttempt.create({
      data: {
        userId: user.id,
        email,
        success: false,
        ipAddress,
        userAgent,
      },
    });

    // Check if we should lock the account
    if (newAttemptCount >= MAX_LOGIN_ATTEMPTS) {
      const lockoutExpiresAt = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);

      // Lock the account
      await prisma.user.update({
        where: { id: user.id },
        data: {
          accountLocked: true,
          accountLockedUntil: lockoutExpiresAt,
        },
      });

      await logSecurity({
        userId: user.id,
        action: 'ACCOUNT_LOCKED',
        ipAddress,
        userAgent,
        metadata: {
          reason: 'max_login_attempts',
          attempts: newAttemptCount,
          lockoutMinutes: LOCKOUT_DURATION_MINUTES,
        },
      });

      log.warn('Account locked due to failed login attempts', {
        userId: user.id,
        email,
        attempts: newAttemptCount,
        ipAddress,
      });

      return {
        isLocked: true,
        attempts: newAttemptCount,
        remainingAttempts: 0,
        lockoutExpiresAt,
      };
    }

    return {
      isLocked: false,
      attempts: newAttemptCount,
      remainingAttempts: MAX_LOGIN_ATTEMPTS - newAttemptCount,
    };
  } catch (error) {
    console.error('[Account Lockout] Failed to record login attempt:', error);
    throw error;
  }
}

/**
 * Record a successful login (clears failed attempts)
 */
export async function recordSuccessfulLogin(
  userId: string,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    // Record successful attempt
    await prisma.loginAttempt.create({
      data: {
        userId,
        email,
        success: true,
        ipAddress,
        userAgent,
      },
    });

    // Clear any lockout
    await prisma.user.update({
      where: { id: userId },
      data: {
        accountLocked: false,
        accountLockedUntil: null,
      },
    });

    // Delete old failed attempts
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);
    await prisma.loginAttempt.deleteMany({
      where: {
        userId,
        success: false,
        attemptedAt: { lt: windowStart },
      },
    });
  } catch (error) {
    console.error('[Account Lockout] Failed to record successful login:', error);
    // Don't throw - this is not critical
  }
}

// =============================================================================
// LOCKOUT CHECKING
// =============================================================================

/**
 * Check if an account is currently locked
 */
export async function isAccountLocked(email: string): Promise<LockoutStatus> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        accountLocked: true,
        accountLockedUntil: true,
      },
    });

    if (!user) {
      // Don't reveal if user exists
      return {
        isLocked: false,
        attempts: 0,
        remainingAttempts: MAX_LOGIN_ATTEMPTS,
      };
    }

    // Check if lockout has expired
    if (user.accountLocked && user.accountLockedUntil) {
      if (user.accountLockedUntil < new Date()) {
        // Lockout expired - auto-unlock
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountLocked: false,
            accountLockedUntil: null,
          },
        });

        await logSecurity({
          userId: user.id,
          action: 'ACCOUNT_UNLOCKED',
          metadata: { reason: 'lockout_expired' },
        });

        return {
          isLocked: false,
          attempts: 0,
          remainingAttempts: MAX_LOGIN_ATTEMPTS,
        };
      }

      // Still locked
      return {
        isLocked: true,
        attempts: MAX_LOGIN_ATTEMPTS,
        remainingAttempts: 0,
        lockoutExpiresAt: user.accountLockedUntil,
      };
    }

    // Not locked - check current attempt count
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

    const recentAttempts = await prisma.loginAttempt.count({
      where: {
        userId: user.id,
        success: false,
        attemptedAt: { gte: windowStart },
      },
    });

    return {
      isLocked: false,
      attempts: recentAttempts,
      remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - recentAttempts),
    };
  } catch (error) {
    console.error('[Account Lockout] Failed to check lockout status:', error);
    // Fail closed - treat as locked
    return {
      isLocked: true,
      attempts: MAX_LOGIN_ATTEMPTS,
      remainingAttempts: 0,
    };
  }
}

// =============================================================================
// ADMIN FUNCTIONS
// =============================================================================

/**
 * Manually unlock an account (admin function)
 */
export async function unlockAccount(
  userId: string,
  adminUserId: string,
  ipAddress?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.accountLocked) {
      return { success: false, error: 'Account is not locked' };
    }

    // Unlock account
    await prisma.user.update({
      where: { id: userId },
      data: {
        accountLocked: false,
        accountLockedUntil: null,
      },
    });

    // Clear failed attempts
    await prisma.loginAttempt.deleteMany({
      where: {
        userId,
        success: false,
      },
    });

    await logAdmin({
      userId: adminUserId,
      action: 'ACCOUNT_UNLOCK',
      targetUserId: userId,
      status: 'SUCCESS',
      ipAddress,
      metadata: { reason: reason || 'manual_unlock' },
    });

    log.info('Account manually unlocked', {
      userId,
      adminUserId,
      reason,
    });

    return { success: true };
  } catch (error) {
    console.error('[Account Lockout] Failed to unlock account:', error);
    return { success: false, error: 'Failed to unlock account' };
  }
}

/**
 * Manually lock an account (admin function)
 */
export async function lockAccount(
  userId: string,
  adminUserId: string,
  durationMinutes: number = LOCKOUT_DURATION_MINUTES,
  ipAddress?: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const lockoutExpiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Lock account
    await prisma.user.update({
      where: { id: userId },
      data: {
        accountLocked: true,
        accountLockedUntil: lockoutExpiresAt,
      },
    });

    await logAdmin({
      userId: adminUserId,
      action: 'ACCOUNT_LOCK',
      targetUserId: userId,
      status: 'SUCCESS',
      ipAddress,
      metadata: {
        reason: reason || 'manual_lock',
        durationMinutes,
        lockoutExpiresAt: lockoutExpiresAt.toISOString(),
      },
    });

    log.warn('Account manually locked', {
      userId,
      adminUserId,
      reason,
      durationMinutes,
    });

    return { success: true };
  } catch (error) {
    console.error('[Account Lockout] Failed to lock account:', error);
    return { success: false, error: 'Failed to lock account' };
  }
}

/**
 * Get lockout information for a user
 */
export async function getLockoutInfo(userId: string): Promise<LockoutInfo | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        accountLocked: true,
        accountLockedUntil: true,
      },
    });

    if (!user) {
      return null;
    }

    // Get failed attempts count
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

    const [failedAttempts, lastAttempt] = await Promise.all([
      prisma.loginAttempt.count({
        where: {
          userId,
          success: false,
          attemptedAt: { gte: windowStart },
        },
      }),
      prisma.loginAttempt.findFirst({
        where: { userId },
        orderBy: { attemptedAt: 'desc' },
        select: {
          attemptedAt: true,
          ipAddress: true,
        },
      }),
    ]);

    return {
      userId: user.id,
      email: user.email,
      failedAttempts,
      lockedUntil: user.accountLockedUntil,
      lastAttemptAt: lastAttempt?.attemptedAt || new Date(),
      lastAttemptIp: lastAttempt?.ipAddress || null,
    };
  } catch (error) {
    console.error('[Account Lockout] Failed to get lockout info:', error);
    return null;
  }
}

/**
 * Get all currently locked accounts (admin function)
 */
export async function getLockedAccounts(): Promise<LockoutInfo[]> {
  try {
    const lockedUsers = await prisma.user.findMany({
      where: {
        accountLocked: true,
        accountLockedUntil: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        accountLockedUntil: true,
      },
      orderBy: { accountLockedUntil: 'asc' },
    });

    const lockoutInfos = await Promise.all(
      lockedUsers.map(async (user: { id: string; email: string; name: string; accountLocked: boolean; accountLockedUntil: Date | null }) => {
        const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MINUTES * 60 * 1000);

        const [failedAttempts, lastAttempt] = await Promise.all([
          prisma.loginAttempt.count({
            where: {
              userId: user.id,
              success: false,
              attemptedAt: { gte: windowStart },
            },
          }),
          prisma.loginAttempt.findFirst({
            where: { userId: user.id },
            orderBy: { attemptedAt: 'desc' },
            select: {
              attemptedAt: true,
              ipAddress: true,
            },
          }),
        ]);

        return {
          userId: user.id,
          email: user.email,
          failedAttempts,
          lockedUntil: user.accountLockedUntil,
          lastAttemptAt: lastAttempt?.attemptedAt || new Date(),
          lastAttemptIp: lastAttempt?.ipAddress || null,
        };
      })
    );

    return lockoutInfos;
  } catch (error) {
    console.error('[Account Lockout] Failed to get locked accounts:', error);
    return [];
  }
}

/**
 * Cleanup old login attempts (maintenance function)
 */
export async function cleanupOldLoginAttempts(olderThanDays = 30): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    const result = await prisma.loginAttempt.deleteMany({
      where: {
        attemptedAt: { lt: cutoffDate },
      },
    });

    log.info('Cleaned up old login attempts', { count: result.count, olderThanDays });

    return result.count;
  } catch (error) {
    console.error('[Account Lockout] Failed to cleanup old login attempts:', error);
    return 0;
  }
}
