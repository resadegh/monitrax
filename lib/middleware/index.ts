/**
 * Middleware Module
 * Phase 10: Enhanced API security and protection
 */

export {
  withSecurity,
  secureAPI,
  secureAPIWithPermission,
  secureAPIWithRateLimit,
  secureAdminAPI,
  secureOwnerAPI,
} from './apiSecurity';

export type { AuthenticatedHandler, SecurityOptions } from './apiSecurity';
