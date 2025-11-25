/**
 * Session Tracking Service
 * Phase 10: Enhanced session management with device tracking and revocation
 */

import { prisma } from '@/lib/db';
import { generateToken, type JWTPayload } from '@/lib/auth';
import * as crypto from 'crypto';
import { log } from '@/lib/utils/logger';
import { logAuth, logSecurity, logAdmin } from '@/lib/security/auditLog';

// ============================================
// TYPES
// ============================================

export interface CreateSessionParams {
  userId: string;
  deviceName?: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
  durationHours?: number;
}

export interface SessionInfo {
  id: string;
  userId: string;
  token: string;
  deviceName: string | null;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  isActive: boolean;
  expiresAt: Date;
  lastActivityAt: Date;
  createdAt: Date;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new session for a user
 */
export async function createSession(params: CreateSessionParams): Promise<{
  sessionId: string;
  token: string;
  expiresAt: Date;
}> {
  const {
    userId,
    deviceName,
    deviceFingerprint,
    ipAddress,
    userAgent,
    durationHours = 168, // 7 days default
  } = params;

  // Generate session token (separate from JWT)
  const sessionToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  // Create session in database
  const session = await prisma.userSession.create({
    data: {
      userId,
      token: sessionToken,
      deviceName,
      deviceFingerprint,
      ipAddress,
      userAgent,
      isActive: true,
      expiresAt,
    },
  });

  // Generate JWT with session ID
  const jwtToken = generateToken({
    userId,
    email: '', // Will be populated from user context
    sessionId: session.id,
  } as JWTPayload & { sessionId: string });

  await logAuth({
    userId,
    action: 'LOGIN',
    status: 'SUCCESS',
    ipAddress,
    userAgent,
    metadata: {
      sessionId: session.id,
      deviceName,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    sessionId: session.id,
    token: jwtToken,
    expiresAt,
  };
}

/**
 * Validate and update a session
 */
export async function validateSession(
  sessionId: string,
  ipAddress?: string
): Promise<SessionInfo | null> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await prisma.userSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });

    await logSecurity({
      userId: session.userId,
      action: 'UNAUTHORIZED_ACCESS',
      ipAddress,
      metadata: { reason: 'session_expired', sessionId },
    });

    return null;
  }

  // Check if session is active
  if (!session.isActive) {
    await logSecurity({
      userId: session.userId,
      action: 'UNAUTHORIZED_ACCESS',
      ipAddress,
      metadata: { reason: 'session_inactive', sessionId },
    });

    return null;
  }

  // Update last activity
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() },
  });

  return session as SessionInfo;
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
  sessionId: string,
  revokedBy: string,
  ipAddress?: string
): Promise<boolean> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return false;
  }

  await prisma.userSession.update({
    where: { id: sessionId },
    data: { isActive: false },
  });

  await logAdmin({
    userId: revokedBy,
    action: 'SESSION_REVOKE',
    targetUserId: session.userId,
    status: 'SUCCESS',
    ipAddress,
    metadata: { sessionId, targetUserId: session.userId },
  });

  return true;
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserSessions(
  userId: string,
  revokedBy: string,
  exceptSessionId?: string
): Promise<number> {
  const result = await prisma.userSession.updateMany({
    where: {
      userId,
      isActive: true,
      ...(exceptSessionId && { id: { not: exceptSessionId } }),
    },
    data: { isActive: false },
  });

  await logAdmin({
    userId: revokedBy,
    action: 'SESSION_REVOKE',
    targetUserId: userId,
    status: 'SUCCESS',
    metadata: {
      action: 'revoke_all',
      count: result.count,
      exceptSessionId,
    },
  });

  return result.count;
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<SessionInfo[]> {
  const sessions = await prisma.userSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  return sessions as SessionInfo[];
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.userSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        {
          isActive: false,
          updatedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days old
        },
      ],
    },
  });

  log.info('Cleaned up expired sessions', { count: result.count });

  return result.count;
}

/**
 * Get session statistics for a user
 */
export async function getUserSessionStats(userId: string): Promise<{
  totalSessions: number;
  activeSessions: number;
  devicesCount: number;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
}> {
  const [sessions, activeCount, lastLogin] = await Promise.all([
    prisma.userSession.findMany({
      where: { userId },
      select: { deviceName: true, isActive: true },
    }),
    prisma.userSession.count({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.userSession.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, ipAddress: true },
    }),
  ]);

  const uniqueDevices = new Set(
    sessions.filter((s) => s.deviceName).map((s) => s.deviceName)
  );

  return {
    totalSessions: sessions.length,
    activeSessions: activeCount,
    devicesCount: uniqueDevices.size,
    lastLoginAt: lastLogin?.createdAt ?? null,
    lastLoginIp: lastLogin?.ipAddress ?? null,
  };
}

/**
 * Generate device fingerprint from user agent and other data
 * This is a simple implementation - in production, use a more sophisticated approach
 */
export function generateDeviceFingerprint(userAgent: string, ipAddress?: string): string {
  const data = `${userAgent}${ipAddress ?? ''}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Extract device name from user agent
 */
export function extractDeviceName(userAgent: string): string {
  // Simple device detection - in production, use a library like ua-parser-js
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Android')) return 'Android Device';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Macintosh')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux PC';

  return 'Unknown Device';
}

// ============================================
// SESSION SECURITY CHECKS
// ============================================

/**
 * Check if a session shows suspicious activity
 */
export async function checkSessionSecurity(
  sessionId: string,
  currentIp?: string
): Promise<{
  isSuspicious: boolean;
  reasons: string[];
}> {
  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return { isSuspicious: true, reasons: ['session_not_found'] };
  }

  const reasons: string[] = [];

  // Check for IP address change
  if (session.ipAddress && currentIp && session.ipAddress !== currentIp) {
    reasons.push('ip_address_changed');
  }

  // Check for session age
  const sessionAge = Date.now() - session.createdAt.getTime();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (sessionAge > maxAge) {
    reasons.push('session_too_old');
  }

  // Check for inactivity
  const inactivityPeriod = Date.now() - session.lastActivityAt.getTime();
  const maxInactivity = 7 * 24 * 60 * 60 * 1000; // 7 days
  if (inactivityPeriod > maxInactivity) {
    reasons.push('session_inactive');
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Enforce organization session policies
 */
export async function enforceSessionPolicies(
  userId: string,
  organizationId: string
): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { sessionDurationHours: true },
  });

  if (!org) {
    return;
  }

  // Find sessions that exceed organization policy
  const maxAge = org.sessionDurationHours * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - maxAge);

  await prisma.userSession.updateMany({
    where: {
      userId,
      createdAt: { lt: cutoffDate },
      isActive: true,
    },
    data: { isActive: false },
  });
}
