/**
 * Session Management
 * Phase 05 - Backend Security
 *
 * Manages user sessions with device tracking, idle timeout, and session revocation.
 */

import { prisma } from '@/lib/db';

// =============================================================================
// TYPES
// =============================================================================

export interface SessionData {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
  isValid: boolean;
  mfaVerified: boolean;
}

export interface DeviceInfo {
  userAgent: string;
  browser?: string;
  os?: string;
  device?: string;
}

export interface CreateSessionInput {
  userId: string;
  ipAddress: string;
  userAgent: string;
  rememberMe?: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SESSION_DURATION_DEFAULT = 24 * 60 * 60 * 1000; // 24 hours
const SESSION_DURATION_REMEMBER = 30 * 24 * 60 * 60 * 1000; // 30 days
const IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hour idle timeout

// =============================================================================
// IN-MEMORY SESSION STORE (Replace with Redis in production)
// =============================================================================

const sessionStore = new Map<string, SessionData>();

// =============================================================================
// SESSION FUNCTIONS
// =============================================================================

/**
 * Generate a unique session ID.
 */
function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Parse user agent to extract device info.
 */
function parseUserAgent(userAgent: string): DeviceInfo {
  const info: DeviceInfo = { userAgent };

  // Simple browser detection
  if (userAgent.includes('Chrome')) info.browser = 'Chrome';
  else if (userAgent.includes('Firefox')) info.browser = 'Firefox';
  else if (userAgent.includes('Safari')) info.browser = 'Safari';
  else if (userAgent.includes('Edge')) info.browser = 'Edge';

  // Simple OS detection
  if (userAgent.includes('Windows')) info.os = 'Windows';
  else if (userAgent.includes('Mac')) info.os = 'macOS';
  else if (userAgent.includes('Linux')) info.os = 'Linux';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) info.os = 'iOS';
  else if (userAgent.includes('Android')) info.os = 'Android';

  // Device type
  if (userAgent.includes('Mobile')) info.device = 'Mobile';
  else if (userAgent.includes('Tablet')) info.device = 'Tablet';
  else info.device = 'Desktop';

  return info;
}

/**
 * Create a new session.
 */
export async function createSession(input: CreateSessionInput): Promise<SessionData> {
  const sessionId = generateSessionId();
  const now = new Date();
  const duration = input.rememberMe ? SESSION_DURATION_REMEMBER : SESSION_DURATION_DEFAULT;

  const session: SessionData = {
    id: sessionId,
    userId: input.userId,
    deviceInfo: parseUserAgent(input.userAgent),
    ipAddress: input.ipAddress,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: new Date(now.getTime() + duration),
    isValid: true,
    mfaVerified: false,
  };

  sessionStore.set(sessionId, session);

  return session;
}

/**
 * Get session by ID.
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < new Date()) {
    sessionStore.delete(sessionId);
    return null;
  }

  // Check idle timeout
  const idleTime = Date.now() - session.lastActiveAt.getTime();
  if (idleTime > IDLE_TIMEOUT) {
    session.isValid = false;
    sessionStore.set(sessionId, session);
    return null;
  }

  return session;
}

/**
 * Update session activity (called on each request).
 */
export async function touchSession(sessionId: string): Promise<void> {
  const session = sessionStore.get(sessionId);

  if (session && session.isValid) {
    session.lastActiveAt = new Date();
    sessionStore.set(sessionId, session);
  }
}

/**
 * Mark session as MFA verified.
 */
export async function verifySessionMFA(sessionId: string): Promise<void> {
  const session = sessionStore.get(sessionId);

  if (session) {
    session.mfaVerified = true;
    sessionStore.set(sessionId, session);
  }
}

/**
 * Revoke (invalidate) a session.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const session = sessionStore.get(sessionId);

  if (session) {
    session.isValid = false;
    sessionStore.set(sessionId, session);
  }
}

/**
 * Revoke all sessions for a user.
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  let count = 0;

  for (const [id, session] of sessionStore.entries()) {
    if (session.userId === userId) {
      session.isValid = false;
      sessionStore.set(id, session);
      count++;
    }
  }

  return count;
}

/**
 * Get all active sessions for a user.
 */
export async function getUserSessions(userId: string): Promise<SessionData[]> {
  const sessions: SessionData[] = [];

  for (const session of sessionStore.values()) {
    if (session.userId === userId && session.isValid && session.expiresAt > new Date()) {
      sessions.push(session);
    }
  }

  return sessions.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
}

/**
 * Delete expired sessions (cleanup job).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = new Date();
  let count = 0;

  for (const [id, session] of sessionStore.entries()) {
    if (session.expiresAt < now || !session.isValid) {
      sessionStore.delete(id);
      count++;
    }
  }

  return count;
}

// Run cleanup every 5 minutes
setInterval(() => {
  cleanupExpiredSessions();
}, 5 * 60 * 1000);

// =============================================================================
// SESSION VALIDATION MIDDLEWARE
// =============================================================================

export interface ValidateSessionResult {
  valid: boolean;
  session?: SessionData;
  error?: string;
}

/**
 * Validate a session and check if it's active.
 */
export async function validateSession(sessionId: string): Promise<ValidateSessionResult> {
  if (!sessionId) {
    return { valid: false, error: 'No session ID provided' };
  }

  const session = await getSession(sessionId);

  if (!session) {
    return { valid: false, error: 'Session not found or expired' };
  }

  if (!session.isValid) {
    return { valid: false, error: 'Session has been revoked' };
  }

  // Update last active time
  await touchSession(sessionId);

  return { valid: true, session };
}
