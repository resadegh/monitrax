/**
 * Phase 32: Enterprise Portal Library
 *
 * Main entry point for portal functionality.
 * All portal code is isolated here to avoid impacting the main application.
 */

// Feature Flags
export {
  getPortalFeatureFlags,
  isPortalFeatureEnabled,
  isPortalAccessible,
  isAccountingIntegrationAvailable,
  getEnabledFeatures,
  emergencyDisablePortal,
  type PortalFeatureFlags,
} from './featureFlags';

// Types
export * from './types';

// Constants
export * from './constants';

// Auth utilities — NOT re-exported here. `./auth` imports `@/lib/db` which is
// server-only; re-exporting it from this barrel pulled the Prisma client
// (and now the Cloud SQL Connector / google-auth-library) into client
// component bundles via `OrganizationProvider`. Server-side callers should
// import `@/lib/portal/auth` directly.

// Permissions
export * from './permissions';

// Context
export { OrganizationProvider, useOrganization, type Organization } from './context/OrganizationContext';
