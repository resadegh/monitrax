/**
 * Phase 33: Admin Portal Permissions
 *
 * Role-based access control (RBAC) system for the Admin Portal.
 * Defines granular permissions and role-permission mappings.
 */

import type { AdminRole } from '@prisma/client';

// =============================================================================
// PERMISSION TYPES
// =============================================================================

export type AdminPermission =
  // Organization management
  | 'organizations:read'
  | 'organizations:update'
  | 'organizations:delete'
  | 'organizations:manage_license'
  | 'organizations:suspend'
  | 'organizations:view_activity'

  // User management
  | 'users:read'
  | 'users:update'
  | 'users:delete'
  | 'users:manage_subscription'
  | 'users:suspend'
  | 'users:view_activity'
  | 'users:impersonate'

  // Billing
  | 'billing:read'
  | 'billing:view_transactions'
  | 'billing:process_refunds'
  | 'billing:export'

  // Analytics
  | 'analytics:read'
  | 'analytics:export'

  // Feature flags
  | 'feature_flags:read'
  | 'feature_flags:create'
  | 'feature_flags:update'
  | 'feature_flags:delete'
  | 'feature_flags:manage_overrides'

  // Support tools
  | 'support:view_logs'
  | 'support:export_logs'
  | 'support:view_errors'

  // Admin management
  | 'admins:read'
  | 'admins:create'
  | 'admins:update'
  | 'admins:delete'
  | 'admins:change_roles'

  // Audit
  | 'audit:read'
  | 'audit:export';

// =============================================================================
// ROLE-PERMISSION MAPPING
// =============================================================================

const SUPER_ADMIN_PERMISSIONS: AdminPermission[] = [
  // All organization permissions
  'organizations:read',
  'organizations:update',
  'organizations:delete',
  'organizations:manage_license',
  'organizations:suspend',
  'organizations:view_activity',

  // All user permissions
  'users:read',
  'users:update',
  'users:delete',
  'users:manage_subscription',
  'users:suspend',
  'users:view_activity',
  'users:impersonate',

  // All billing permissions
  'billing:read',
  'billing:view_transactions',
  'billing:process_refunds',
  'billing:export',

  // All analytics permissions
  'analytics:read',
  'analytics:export',

  // All feature flag permissions
  'feature_flags:read',
  'feature_flags:create',
  'feature_flags:update',
  'feature_flags:delete',
  'feature_flags:manage_overrides',

  // All support permissions
  'support:view_logs',
  'support:export_logs',
  'support:view_errors',

  // All admin permissions
  'admins:read',
  'admins:create',
  'admins:update',
  'admins:delete',
  'admins:change_roles',

  // All audit permissions
  'audit:read',
  'audit:export',
];

const BILLING_ADMIN_PERMISSIONS: AdminPermission[] = [
  // Read-only organization access
  'organizations:read',
  'organizations:manage_license',
  'organizations:view_activity',

  // Read-only user access with subscription management
  'users:read',
  'users:manage_subscription',
  'users:view_activity',

  // Full billing access
  'billing:read',
  'billing:view_transactions',
  'billing:process_refunds',
  'billing:export',

  // Read-only analytics
  'analytics:read',
  'analytics:export',

  // Read audit
  'audit:read',
];

const SUPPORT_ADMIN_PERMISSIONS: AdminPermission[] = [
  // Read organization access
  'organizations:read',
  'organizations:view_activity',

  // User management for support
  'users:read',
  'users:update',
  'users:suspend',
  'users:view_activity',
  'users:impersonate',

  // Read-only analytics
  'analytics:read',

  // Feature flag viewing and overrides
  'feature_flags:read',
  'feature_flags:manage_overrides',

  // Full support tools
  'support:view_logs',
  'support:export_logs',
  'support:view_errors',

  // Read audit
  'audit:read',
];

const VIEWER_PERMISSIONS: AdminPermission[] = [
  // Read-only access
  'organizations:read',
  'users:read',
  'billing:read',
  'analytics:read',
  'feature_flags:read',
  'audit:read',
];

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: SUPER_ADMIN_PERMISSIONS,
  BILLING_ADMIN: BILLING_ADMIN_PERMISSIONS,
  SUPPORT_ADMIN: SUPPORT_ADMIN_PERMISSIONS,
  VIEWER: VIEWER_PERMISSIONS,
};

// =============================================================================
// PERMISSION CHECK FUNCTIONS
// =============================================================================

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role];
  return rolePermissions.includes(permission);
}

/**
 * Check if a role has all specified permissions
 */
export function hasAllPermissions(role: AdminRole, permissions: AdminPermission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: AdminRole, permissions: AdminPermission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: AdminRole): AdminPermission[] {
  return [...ROLE_PERMISSIONS[role]];
}

// =============================================================================
// ROLE HIERARCHY
// =============================================================================

const ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 4,
  BILLING_ADMIN: 2,
  SUPPORT_ADMIN: 2,
  VIEWER: 1,
};

/**
 * Check if a manager role can manage a target role
 */
export function canManageRole(managerRole: AdminRole, targetRole: AdminRole): boolean {
  // Only SUPER_ADMIN can manage other admins
  if (managerRole !== 'SUPER_ADMIN') {
    return false;
  }

  // SUPER_ADMIN can manage all roles
  return true;
}

/**
 * Check if a manager can change target's role to newRole
 */
export function canChangeRoleTo(
  managerRole: AdminRole,
  targetCurrentRole: AdminRole,
  newRole: AdminRole
): boolean {
  // Only SUPER_ADMIN can change roles
  if (managerRole !== 'SUPER_ADMIN') {
    return false;
  }

  // Can change to any role
  return true;
}

/**
 * Get roles that a manager can assign
 */
export function getAssignableRoles(managerRole: AdminRole): AdminRole[] {
  if (managerRole !== 'SUPER_ADMIN') {
    return [];
  }

  return ['SUPER_ADMIN', 'BILLING_ADMIN', 'SUPPORT_ADMIN', 'VIEWER'];
}

// =============================================================================
// PERMISSION GUARDS (for route protection)
// =============================================================================

export type PermissionGuard = (role: AdminRole) => boolean;

function createPermissionGuard(requiredPermissions: AdminPermission[]): PermissionGuard {
  return (role: AdminRole) => hasAllPermissions(role, requiredPermissions);
}

export const PermissionGuards = {
  // Organization guards
  canReadOrganizations: createPermissionGuard(['organizations:read']),
  canUpdateOrganizations: createPermissionGuard(['organizations:update']),
  canManageLicenses: createPermissionGuard(['organizations:manage_license']),
  canSuspendOrganizations: createPermissionGuard(['organizations:suspend']),

  // User guards
  canReadUsers: createPermissionGuard(['users:read']),
  canUpdateUsers: createPermissionGuard(['users:update']),
  canManageSubscriptions: createPermissionGuard(['users:manage_subscription']),
  canSuspendUsers: createPermissionGuard(['users:suspend']),
  canImpersonateUsers: createPermissionGuard(['users:impersonate']),

  // Billing guards
  canReadBilling: createPermissionGuard(['billing:read']),
  canProcessRefunds: createPermissionGuard(['billing:process_refunds']),
  canExportBilling: createPermissionGuard(['billing:export']),

  // Analytics guards
  canReadAnalytics: createPermissionGuard(['analytics:read']),
  canExportAnalytics: createPermissionGuard(['analytics:export']),

  // Feature flag guards
  canReadFeatureFlags: createPermissionGuard(['feature_flags:read']),
  canManageFeatureFlags: createPermissionGuard(['feature_flags:create', 'feature_flags:update', 'feature_flags:delete']),
  canManageOverrides: createPermissionGuard(['feature_flags:manage_overrides']),

  // Support guards
  canViewLogs: createPermissionGuard(['support:view_logs']),
  canExportLogs: createPermissionGuard(['support:export_logs']),

  // Admin guards
  canReadAdmins: createPermissionGuard(['admins:read']),
  canManageAdmins: createPermissionGuard(['admins:create', 'admins:update', 'admins:delete']),
  canChangeRoles: createPermissionGuard(['admins:change_roles']),

  // Audit guards
  canReadAudit: createPermissionGuard(['audit:read']),
  canExportAudit: createPermissionGuard(['audit:export']),
};

// =============================================================================
// FEATURE ACCESS BY ROLE
// =============================================================================

export interface FeatureAccess {
  dashboard: boolean;
  organizations: { read: boolean; write: boolean };
  users: { read: boolean; write: boolean; impersonate: boolean };
  billing: { read: boolean; write: boolean };
  analytics: { read: boolean; export: boolean };
  featureFlags: { read: boolean; write: boolean };
  support: { logs: boolean; impersonate: boolean };
  admins: { read: boolean; write: boolean };
}

export function getFeatureAccess(role: AdminRole): FeatureAccess {
  return {
    dashboard: true, // All roles can see dashboard
    organizations: {
      read: hasPermission(role, 'organizations:read'),
      write: hasPermission(role, 'organizations:update'),
    },
    users: {
      read: hasPermission(role, 'users:read'),
      write: hasPermission(role, 'users:update'),
      impersonate: hasPermission(role, 'users:impersonate'),
    },
    billing: {
      read: hasPermission(role, 'billing:read'),
      write: hasPermission(role, 'billing:process_refunds'),
    },
    analytics: {
      read: hasPermission(role, 'analytics:read'),
      export: hasPermission(role, 'analytics:export'),
    },
    featureFlags: {
      read: hasPermission(role, 'feature_flags:read'),
      write: hasPermission(role, 'feature_flags:update'),
    },
    support: {
      logs: hasPermission(role, 'support:view_logs'),
      impersonate: hasPermission(role, 'users:impersonate'),
    },
    admins: {
      read: hasPermission(role, 'admins:read'),
      write: hasPermission(role, 'admins:create'),
    },
  };
}

// =============================================================================
// PERMISSION DESCRIPTIONS (for UI)
// =============================================================================

export const PERMISSION_DESCRIPTIONS: Record<AdminPermission, string> = {
  // Organizations
  'organizations:read': 'View organization details and list',
  'organizations:update': 'Update organization information',
  'organizations:delete': 'Delete organizations',
  'organizations:manage_license': 'Change organization tier and limits',
  'organizations:suspend': 'Suspend and reactivate organizations',
  'organizations:view_activity': 'View organization activity logs',

  // Users
  'users:read': 'View user details and list',
  'users:update': 'Update user information',
  'users:delete': 'Delete user accounts',
  'users:manage_subscription': 'Change user subscription tier',
  'users:suspend': 'Suspend and reactivate user accounts',
  'users:view_activity': 'View user activity logs',
  'users:impersonate': 'Login as user for debugging',

  // Billing
  'billing:read': 'View revenue metrics and overview',
  'billing:view_transactions': 'View transaction history',
  'billing:process_refunds': 'Issue refunds',
  'billing:export': 'Export billing data',

  // Analytics
  'analytics:read': 'View analytics dashboards',
  'analytics:export': 'Export analytics data',

  // Feature flags
  'feature_flags:read': 'View feature flag configuration',
  'feature_flags:create': 'Create new feature flags',
  'feature_flags:update': 'Update feature flag settings',
  'feature_flags:delete': 'Delete feature flags',
  'feature_flags:manage_overrides': 'Create/remove per-user or per-org overrides',

  // Support
  'support:view_logs': 'View access and system logs',
  'support:export_logs': 'Export log data',
  'support:view_errors': 'View application error logs',

  // Admins
  'admins:read': 'View admin user list',
  'admins:create': 'Create new admin accounts',
  'admins:update': 'Update admin information',
  'admins:delete': 'Deactivate admin accounts',
  'admins:change_roles': 'Change admin roles',

  // Audit
  'audit:read': 'View audit logs',
  'audit:export': 'Export audit logs',
};
