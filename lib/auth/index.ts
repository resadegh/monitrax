/**
 * Auth Module - Barrel Export
 * Central export point for authentication and authorization utilities
 */

// Core auth functions (from existing lib/auth.ts)
export {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  type JWTPayload,
} from '@/lib/auth';

// Permission system
export * from './permissions';

// Auth context
export * from './context';

// Route guards
export * from './guards';

// Refresh token rotation (Phase 05)
export * from './refreshToken';

// OAuth providers (Phase 05)
export * from './oauth';

// Magic Link authentication (Phase 10)
export {
  createMagicLink,
  verifyMagicLink,
  cleanupExpiredMagicLinks,
  revokeMagicLinks,
  getMagicLinkStats,
} from './magicLink';

export type {
  MagicLinkRequest,
  MagicLinkVerification,
  MagicLinkResult,
} from './magicLink';

// Passkey / WebAuthn authentication (Phase 10)
export {
  generateRegistrationOptions,
  verifyRegistration,
  generateAuthenticationOptions,
  verifyAuthentication,
  getUserPasskeys,
  deletePasskey,
  updatePasskeyName,
  getPasskeyStats,
  cleanupUnusedPasskeys,
} from './passkey';

export type {
  PasskeyRegistrationOptions,
  PasskeyAuthenticationOptions,
  PasskeyCredential,
  RegistrationChallenge,
  AuthenticationChallenge,
  PublicKeyCredentialCreationOptions,
  PublicKeyCredentialRequestOptions,
} from './passkey';
