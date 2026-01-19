/**
 * Phase 32: Enterprise Portal Permissions
 *
 * Role-based access control for portal functionality.
 * Defines what each role can do within the portal.
 */

import type { PortalUserRole, DataAccessScope, ApiKeyScope } from '@prisma/client';

// =============================================================================
// PERMISSION DEFINITIONS
// =============================================================================

export type PortalPermission =
  // Organization permissions
  | 'org:read'
  | 'org:update'
  | 'org:delete'
  | 'org:manage_billing'
  | 'org:manage_branding'
  | 'org:manage_sso'

  // Team/Staff permissions
  | 'team:read'
  | 'team:invite'
  | 'team:remove'
  | 'team:update_roles'

  // Client permissions
  | 'clients:read'
  | 'clients:invite'
  | 'clients:remove'
  | 'clients:assign'
  | 'clients:view_data'
  | 'clients:export_data'

  // Notes permissions
  | 'notes:read'
  | 'notes:create'
  | 'notes:update'
  | 'notes:delete'
  | 'notes:read_private'

  // Task permissions
  | 'tasks:read'
  | 'tasks:create'
  | 'tasks:update'
  | 'tasks:delete'
  | 'tasks:assign'

  // Integration permissions
  | 'integrations:read'
  | 'integrations:connect'
  | 'integrations:disconnect'
  | 'integrations:sync'
  | 'integrations:configure'

  // API Key permissions
  | 'api_keys:read'
  | 'api_keys:create'
  | 'api_keys:revoke'

  // Audit log permissions
  | 'audit:read'
  | 'audit:export';

// =============================================================================
// ROLE PERMISSION MAPPING
// =============================================================================

const ROLE_PERMISSIONS: Record<PortalUserRole, PortalPermission[]> = {
  PORTAL_OWNER: [
    // All organization permissions
    'org:read', 'org:update', 'org:delete', 'org:manage_billing', 'org:manage_branding', 'org:manage_sso',
    // All team permissions
    'team:read', 'team:invite', 'team:remove', 'team:update_roles',
    // All client permissions
    'clients:read', 'clients:invite', 'clients:remove', 'clients:assign', 'clients:view_data', 'clients:export_data',
    // All notes permissions
    'notes:read', 'notes:create', 'notes:update', 'notes:delete', 'notes:read_private',
    // All task permissions
    'tasks:read', 'tasks:create', 'tasks:update', 'tasks:delete', 'tasks:assign',
    // All integration permissions
    'integrations:read', 'integrations:connect', 'integrations:disconnect', 'integrations:sync', 'integrations:configure',
    // All API key permissions
    'api_keys:read', 'api_keys:create', 'api_keys:revoke',
    // All audit permissions
    'audit:read', 'audit:export',
  ],

  PORTAL_ADMIN: [
    // Limited organization permissions
    'org:read', 'org:update', 'org:manage_branding',
    // Team permissions (can't remove owner)
    'team:read', 'team:invite', 'team:remove', 'team:update_roles',
    // All client permissions
    'clients:read', 'clients:invite', 'clients:remove', 'clients:assign', 'clients:view_data', 'clients:export_data',
    // All notes permissions
    'notes:read', 'notes:create', 'notes:update', 'notes:delete', 'notes:read_private',
    // All task permissions
    'tasks:read', 'tasks:create', 'tasks:update', 'tasks:delete', 'tasks:assign',
    // Integration permissions (no connect/disconnect)
    'integrations:read', 'integrations:sync', 'integrations:configure',
    // API key permissions (can create, not revoke others')
    'api_keys:read', 'api_keys:create',
    // Audit permissions
    'audit:read',
  ],

  PORTAL_ADVISOR: [
    // Read-only organization
    'org:read',
    // Limited team permissions
    'team:read',
    // Client permissions (view and export assigned only - enforced at runtime)
    'clients:read', 'clients:view_data', 'clients:export_data',
    // Notes permissions (own notes only - enforced at runtime)
    'notes:read', 'notes:create', 'notes:update', 'notes:delete',
    // Task permissions (assigned tasks only - enforced at runtime)
    'tasks:read', 'tasks:create', 'tasks:update',
    // Limited integration permissions
    'integrations:read',
    // No API key permissions
    // No audit permissions
  ],

  PORTAL_VIEWER: [
    // Read-only organization
    'org:read',
    // Limited team permissions
    'team:read',
    // Read-only client access
    'clients:read', 'clients:view_data',
    // Read-only notes
    'notes:read',
    // Read-only tasks
    'tasks:read',
    // Read-only integrations
    'integrations:read',
    // No API key permissions
    // No audit permissions
  ],
};

// =============================================================================
// PERMISSION CHECK FUNCTIONS
// =============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: PortalUserRole, permission: PortalPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: PortalUserRole, permissions: PortalPermission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: PortalUserRole, permissions: PortalPermission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: PortalUserRole): PortalPermission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if a role can manage another role (for role changes)
 */
export function canManageRole(managerRole: PortalUserRole, targetRole: PortalUserRole): boolean {
  const roleHierarchy: Record<PortalUserRole, number> = {
    PORTAL_OWNER: 4,
    PORTAL_ADMIN: 3,
    PORTAL_ADVISOR: 2,
    PORTAL_VIEWER: 1,
  };

  const managerLevel = roleHierarchy[managerRole];
  const targetLevel = roleHierarchy[targetRole];

  // Can only manage roles below your level
  // Owners can manage anyone except other owners
  if (managerRole === 'PORTAL_OWNER' && targetRole === 'PORTAL_OWNER') {
    return false;
  }

  return managerLevel > targetLevel;
}

// =============================================================================
// DATA ACCESS SCOPE VALIDATION
// =============================================================================

/**
 * Check if a client has granted a specific access scope
 */
export function hasAccessScope(
  grantedScopes: DataAccessScope[],
  requiredScope: DataAccessScope
): boolean {
  // FULL access includes everything
  if (grantedScopes.includes('FULL')) {
    return true;
  }

  return grantedScopes.includes(requiredScope);
}

/**
 * Check if a client has granted all required scopes
 */
export function hasAllAccessScopes(
  grantedScopes: DataAccessScope[],
  requiredScopes: DataAccessScope[]
): boolean {
  return requiredScopes.every((scope) => hasAccessScope(grantedScopes, scope));
}

/**
 * Get the data types accessible with given scopes
 */
export function getAccessibleDataTypes(scopes: DataAccessScope[]): string[] {
  const dataTypes: string[] = [];

  if (scopes.includes('FULL')) {
    return [
      'accounts', 'transactions', 'properties', 'loans',
      'investments', 'tax', 'documents', 'expenses', 'income',
    ];
  }

  if (scopes.includes('FINANCIAL')) {
    dataTypes.push('accounts', 'balances');
  }
  if (scopes.includes('TRANSACTIONS')) {
    dataTypes.push('transactions');
  }
  if (scopes.includes('PROPERTIES')) {
    dataTypes.push('properties');
  }
  if (scopes.includes('LOANS')) {
    dataTypes.push('loans');
  }
  if (scopes.includes('INVESTMENTS')) {
    dataTypes.push('investments', 'holdings');
  }
  if (scopes.includes('TAX')) {
    dataTypes.push('tax', 'deductions', 'superannuation');
  }
  if (scopes.includes('DOCUMENTS')) {
    dataTypes.push('documents');
  }

  return [...new Set(dataTypes)];
}

// =============================================================================
// API KEY SCOPE VALIDATION
// =============================================================================

/**
 * Check if an API key has a specific scope
 */
export function hasApiKeyScope(
  keyScopes: ApiKeyScope[],
  requiredScope: ApiKeyScope
): boolean {
  // FULL_ACCESS includes everything
  if (keyScopes.includes('FULL_ACCESS')) {
    return true;
  }

  return keyScopes.includes(requiredScope);
}

/**
 * Map API key scopes to allowed operations
 */
export function getApiKeyOperations(scopes: ApiKeyScope[]): string[] {
  const operations: string[] = [];

  if (scopes.includes('FULL_ACCESS')) {
    return ['read_clients', 'read_financial', 'read_documents', 'sync_accounting'];
  }

  if (scopes.includes('READ_CLIENTS')) {
    operations.push('list_clients', 'get_client_profile');
  }
  if (scopes.includes('READ_FINANCIAL')) {
    operations.push('get_accounts', 'get_transactions', 'get_summary');
  }
  if (scopes.includes('READ_DOCUMENTS')) {
    operations.push('list_documents', 'download_document');
  }
  if (scopes.includes('SYNC_ACCOUNTING')) {
    operations.push('sync_contacts', 'sync_invoices', 'sync_transactions');
  }

  return operations;
}

// =============================================================================
// PERMISSION GUARDS FOR API ROUTES
// =============================================================================

/**
 * Create a permission guard for API routes
 */
export function createPermissionGuard(requiredPermissions: PortalPermission[]) {
  return function guard(role: PortalUserRole): boolean {
    return hasAllPermissions(role, requiredPermissions);
  };
}

/**
 * Pre-built permission guards for common operations
 */
export const PermissionGuards = {
  // Organization
  canReadOrganization: createPermissionGuard(['org:read']),
  canUpdateOrganization: createPermissionGuard(['org:update']),
  canDeleteOrganization: createPermissionGuard(['org:delete']),
  canManageBilling: createPermissionGuard(['org:manage_billing']),
  canManageBranding: createPermissionGuard(['org:manage_branding']),
  canManageSSO: createPermissionGuard(['org:manage_sso']),

  // Team
  canReadTeam: createPermissionGuard(['team:read']),
  canInviteTeam: createPermissionGuard(['team:invite']),
  canRemoveTeam: createPermissionGuard(['team:remove']),
  canUpdateRoles: createPermissionGuard(['team:update_roles']),

  // Clients
  canReadClients: createPermissionGuard(['clients:read']),
  canInviteClients: createPermissionGuard(['clients:invite']),
  canRemoveClients: createPermissionGuard(['clients:remove']),
  canAssignClients: createPermissionGuard(['clients:assign']),
  canViewClientData: createPermissionGuard(['clients:view_data']),
  canExportClientData: createPermissionGuard(['clients:export_data']),

  // Notes
  canReadNotes: createPermissionGuard(['notes:read']),
  canCreateNotes: createPermissionGuard(['notes:create']),
  canUpdateNotes: createPermissionGuard(['notes:update']),
  canDeleteNotes: createPermissionGuard(['notes:delete']),
  canReadPrivateNotes: createPermissionGuard(['notes:read_private']),

  // Tasks
  canReadTasks: createPermissionGuard(['tasks:read']),
  canCreateTasks: createPermissionGuard(['tasks:create']),
  canUpdateTasks: createPermissionGuard(['tasks:update']),
  canDeleteTasks: createPermissionGuard(['tasks:delete']),
  canAssignTasks: createPermissionGuard(['tasks:assign']),

  // Integrations
  canReadIntegrations: createPermissionGuard(['integrations:read']),
  canConnectIntegrations: createPermissionGuard(['integrations:connect']),
  canDisconnectIntegrations: createPermissionGuard(['integrations:disconnect']),
  canSyncIntegrations: createPermissionGuard(['integrations:sync']),
  canConfigureIntegrations: createPermissionGuard(['integrations:configure']),

  // API Keys
  canReadApiKeys: createPermissionGuard(['api_keys:read']),
  canCreateApiKeys: createPermissionGuard(['api_keys:create']),
  canRevokeApiKeys: createPermissionGuard(['api_keys:revoke']),

  // Audit
  canReadAudit: createPermissionGuard(['audit:read']),
  canExportAudit: createPermissionGuard(['audit:export']),
};
