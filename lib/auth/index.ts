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

// Permission system (pure — no Prisma)
export * from './permissions';

// NOTE: `./context` and `./guards` import `@/lib/db` (Prisma) and so
// pull Prisma + Cloud SQL Connector into any consuming bundle. Tech
// Debt #7 (resolved 2026-05-18) — these MUST be imported via their
// full path:
//   - `@/lib/auth/context`  — getAuthContext / requireAuthContext
//   - `@/lib/auth/guards`   — withAuth / withPermission / etc.
// Removing the `export * from` lines forces direct imports; pre-WIF
// the pattern bundled silently, post-WIF it breaks the build the
// moment a client component touches the barrel.

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

// GCP Identity Platform (Phase 1 Migration)
export {
  syncGCPUser,
  findUserByGCPUid,
  unlinkGCPAccount,
  isGCPIdentityConfigured,
  GCPIdentityError,
} from './gcpIdentity';

export type {
  GCPTokenClaims,
  GCPUserSyncResult,
  GCPUserSyncInput,
} from './gcpIdentity';

export {
  verifyGCPIdToken,
  extractGCPTokenFromHeader,
} from './gcpTokenVerifier';

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
