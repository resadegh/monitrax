/**
 * Security Module - Phase 05 & Phase 10
 */

export {
  checkRateLimit,
  rateLimitCheck,
  withRateLimit,
  getClientIdentifier,
  RATE_LIMITS,
} from './rateLimit';

export type { RateLimitResult } from './rateLimit';

export {
  emailVerification,
  createVerificationToken,
  verifyToken,
  canResendVerification,
  sendVerificationEmail,
  sendPasswordResetEmail,
  verifyEmail,
  verifyPasswordResetToken,
} from './emailVerification';

export type { VerificationToken, SendVerificationResult } from './emailVerification';

// Phase 10: Audit Logging
export {
  createAuditLog,
  logSuccess,
  logFailure,
  logBlocked,
  logAuth,
  logCRUD,
  logExport,
  logAdmin,
  logSecurity,
  queryAuditLogs,
  getUserAuditLogs,
  getOrganizationAuditLogs,
  getEntityAuditLogs,
  getRecentSecurityEvents,
  getAuditLogStats,
  formatAuditLogsAsCSV,
} from './auditLog';

export type { AuditLogEntry, AuditLogQuery, AuditLogResult } from './auditLog';

// Phase 10: Multi-Factor Authentication
export {
  generateTOTPSecret,
  generateTOTPCode,
  verifyTOTPCode,
  generateTOTPUri,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  setupTOTPMFA,
  enableTOTPMFA,
  verifyTOTPMFA,
  disableMFA,
  getUserMFAMethods,
  isMFARequired,
  regenerateBackupCodes,
  setupWebAuthnMFA,
  verifyWebAuthnCredential,
} from './mfa';

export type { MFAType, MFASetupResult, MFAVerificationResult } from './mfa';
