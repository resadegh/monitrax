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

// Email verification moved to GCP Identity Platform (Firebase) — 2026-06-10.
// The Phase 05 in-memory token module (`./emailVerification`) was deleted:
// its Map-based token store never worked on serverless. See
// app/api/auth/verify-email/route.ts for the claim-based DB true-up.

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

// Phase 41a: TFN at-rest encryption (LegalEntity.tfnEncrypted)
export { encryptTfn, decryptTfn, maskTfn } from './tfnEncryption';
