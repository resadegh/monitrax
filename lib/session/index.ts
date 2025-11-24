/**
 * Session Management Module - Phase 05
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
