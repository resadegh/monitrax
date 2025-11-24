/**
 * Session Management Module - Phase 05 & Phase 10
 */

export {
  createSession,
  getSession,
  touchSession,
  verifySessionMFA,
  revokeSession,
  revokeAllUserSessions,
  getUserSessions,
  cleanupExpiredSessions,
  validateSession,
} from './sessionManager';

export type {
  SessionData,
  DeviceInfo,
  CreateSessionInput,
  ValidateSessionResult,
} from './sessionManager';

// Phase 10: Enhanced Session Tracking
export {
  createSession as createTrackedSession,
  validateSession as validateTrackedSession,
  revokeSession as revokeTrackedSession,
  revokeAllUserSessions as revokeAllTrackedSessions,
  getUserActiveSessions,
  cleanupExpiredSessions as cleanupTrackedSessions,
  getUserSessionStats,
  generateDeviceFingerprint,
  extractDeviceName,
  checkSessionSecurity,
  enforceSessionPolicies,
} from './sessionTracking';

export type { CreateSessionParams, SessionInfo } from './sessionTracking';
