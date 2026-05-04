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

// Auth utilities removed 2026-05-04: `./auth` had zero callers anywhere in
// the codebase (per 2026-04-30 dead-code audit). Server-side portal auth is
// handled by route-level guards under `app/api/portal/**` using the existing
// `withPermission()` middleware from `lib/middleware.ts`. If a future portal
// session needs a portal-context helper, build one alongside the consumer
// `withPermission` rather than re-introducing a parallel auth surface.

// Permissions
export * from './permissions';

// Context
export { OrganizationProvider, useOrganization, type Organization } from './context/OrganizationContext';
