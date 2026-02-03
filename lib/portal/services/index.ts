/**
 * Phase 32: Portal Services Index
 *
 * MODULAR ARCHITECTURE:
 * Each service is independent and can be imported individually.
 * This allows for tree-shaking and easier testing.
 *
 * Usage:
 * ```ts
 * // Import specific services
 * import { organizationService } from '@/lib/portal/services';
 * import { createClientsService } from '@/lib/portal/services/clients';
 *
 * // Use services
 * const org = await organizationService.get('org-123');
 * const clientsApi = createClientsService('org-123');
 * const clients = await clientsApi.list({ page: 1 });
 * ```
 */

// Base API client
export { portalApi, createServiceClient } from './api-client';
export type { ApiResponse, PaginatedResponse, RequestOptions } from './api-client';

// Organization service
export { organizationService } from './organizations';

// Clients service (factory pattern)
export { clientsService, createClientsService } from './clients';

// Team service (factory pattern)
export { teamService, createTeamService } from './team';
export type { TeamMember, TeamInvitation } from './team';

// Integrations service (factory pattern)
export { integrationsService, createIntegrationsService } from './integrations';
export type { AccountingIntegration, SyncLog, EntityMapping } from './integrations';

/**
 * Create all services for a specific organization
 *
 * Convenience function to get all org-specific services at once.
 *
 * Usage:
 * ```ts
 * const { clients, team, integrations } = createOrgServices('org-123');
 * ```
 */
export function createOrgServices(orgId: string) {
  // Lazy import to avoid circular dependencies
  const { createClientsService: createClients } = require('./clients');
  const { createTeamService: createTeam } = require('./team');
  const { createIntegrationsService: createIntegrations } = require('./integrations');

  return {
    clients: createClients(orgId),
    team: createTeam(orgId),
    integrations: createIntegrations(orgId),
  };
}
