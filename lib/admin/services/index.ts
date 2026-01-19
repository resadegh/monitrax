/**
 * Phase 33: Admin Portal Services
 *
 * Re-exports all admin services for convenient access.
 */

// API client
export { adminApi, ADMIN_API_ROUTES } from './api-client';

// Domain services
export { organizationService } from './organizations';
export { userService } from './users';
export { billingService } from './billing';
export { analyticsService } from './analytics';
export { featureFlagsService } from './feature-flags';
export { auditService } from './audit';

// =============================================================================
// COMBINED SERVICE FACTORY
// =============================================================================

/**
 * Get all admin services as a single object
 */
export function getAdminServices() {
  return {
    organizations: require('./organizations').organizationService,
    users: require('./users').userService,
    billing: require('./billing').billingService,
    analytics: require('./analytics').analyticsService,
    featureFlags: require('./feature-flags').featureFlagsService,
    audit: require('./audit').auditService,
  };
}
