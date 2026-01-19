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

// Auth utilities
export * from './auth';

// Permissions
export * from './permissions';
