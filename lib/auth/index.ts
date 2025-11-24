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
