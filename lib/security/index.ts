/**
 * Security Module - Phase 05
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
