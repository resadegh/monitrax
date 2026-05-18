/**
 * Phase 33: Admin Portal Library
 *
 * Main entry point for the admin portal library.
 * Re-exports SAFE-TO-BUNDLE modules for convenient access.
 *
 * **Server-only modules are NOT re-exported here** (Tech Debt #7,
 * resolved 2026-05-18). The barrel pattern `export * from './foo'`
 * — where `foo.ts` imports `@/lib/db` (Prisma) — silently pulls
 * Prisma + GCP packages into the client bundle via ANY client
 * component that imports from `@/lib/admin` for unrelated symbols.
 * Worked by accident pre-WIF because Prisma alone tree-shook out;
 * broke the moment `lib/db.ts` added dynamic imports for the
 * Cloud SQL Connector.
 *
 * Server-only paths consumers MUST import directly:
 *   - `@/lib/admin/auth`    — AdminAuthContext + token helpers (uses Prisma)
 *   - `@/lib/admin/services` — Prisma-backed admin services
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Permissions (pure — no Prisma)
export * from './permissions';

// Feature flags (pure — no Prisma)
export * from './featureFlags';

// NOTE: `./auth` and `./services` are server-only — see file header above.
// Import them directly via their full path, NOT through this barrel.
