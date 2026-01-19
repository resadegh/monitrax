/**
 * Phase 33: Admin Portal Feature Flags
 *
 * Feature flag management for the Admin Portal.
 * Controls which admin features are enabled/disabled.
 */

// =============================================================================
// ADMIN FEATURE FLAG INTERFACE
// =============================================================================

export interface AdminFeatureFlags {
  // Master switch
  adminPortalEnabled: boolean;

  // Core features
  organizationManagement: boolean;
  userManagement: boolean;
  billingDashboard: boolean;
  analyticsDashboard: boolean;

  // Advanced features
  featureFlagsManagement: boolean;
  supportTools: boolean;
  impersonation: boolean;
  auditLogs: boolean;

  // Security features
  ipWhitelist: boolean;
  mfaRequired: boolean;

  // Export features
  dataExport: boolean;
  bulkOperations: boolean;
}

// =============================================================================
// DEFAULT FLAGS (all disabled for safety)
// =============================================================================

const DEFAULT_ADMIN_FLAGS: AdminFeatureFlags = {
  adminPortalEnabled: false,
  organizationManagement: false,
  userManagement: false,
  billingDashboard: false,
  analyticsDashboard: false,
  featureFlagsManagement: false,
  supportTools: false,
  impersonation: false,
  auditLogs: false,
  ipWhitelist: false,
  mfaRequired: false,
  dataExport: false,
  bulkOperations: false,
};

// =============================================================================
// FEATURE FLAG LOADING
// =============================================================================

/**
 * Load admin feature flags from environment variables
 */
function loadAdminFeatureFlags(): AdminFeatureFlags {
  return {
    adminPortalEnabled: process.env.NEXT_PUBLIC_ADMIN_PORTAL_ENABLED === 'true',
    organizationManagement: process.env.ADMIN_ORGANIZATION_MANAGEMENT === 'true',
    userManagement: process.env.ADMIN_USER_MANAGEMENT === 'true',
    billingDashboard: process.env.ADMIN_BILLING_DASHBOARD === 'true',
    analyticsDashboard: process.env.ADMIN_ANALYTICS_DASHBOARD === 'true',
    featureFlagsManagement: process.env.ADMIN_FEATURE_FLAGS === 'true',
    supportTools: process.env.ADMIN_SUPPORT_TOOLS === 'true',
    impersonation: process.env.ADMIN_IMPERSONATION === 'true',
    auditLogs: process.env.ADMIN_AUDIT_LOGS === 'true',
    ipWhitelist: process.env.ADMIN_IP_WHITELIST === 'true',
    mfaRequired: process.env.ADMIN_MFA_REQUIRED === 'true',
    dataExport: process.env.ADMIN_DATA_EXPORT === 'true',
    bulkOperations: process.env.ADMIN_BULK_OPERATIONS === 'true',
  };
}

// Cached flags instance
let cachedFlags: AdminFeatureFlags | null = null;

/**
 * Get the current admin feature flags
 * Caches the result for the lifetime of the request
 */
export function getAdminFeatureFlags(): AdminFeatureFlags {
  if (!cachedFlags) {
    cachedFlags = loadAdminFeatureFlags();
  }
  return cachedFlags;
}

/**
 * Reset the cached flags (useful for testing)
 */
export function resetAdminFeatureFlags(): void {
  cachedFlags = null;
}

// =============================================================================
// FEATURE FLAG CHECKS
// =============================================================================

/**
 * Check if the admin portal is accessible
 */
export function isAdminPortalAccessible(): boolean {
  return getAdminFeatureFlags().adminPortalEnabled;
}

/**
 * Check if a specific admin feature is enabled
 */
export function isAdminFeatureEnabled(feature: keyof AdminFeatureFlags): boolean {
  const flags = getAdminFeatureFlags();

  // Master switch must be on
  if (!flags.adminPortalEnabled) {
    return false;
  }

  return flags[feature] === true;
}

/**
 * Check if multiple features are all enabled
 */
export function areAdminFeaturesEnabled(features: (keyof AdminFeatureFlags)[]): boolean {
  return features.every((feature) => isAdminFeatureEnabled(feature));
}

/**
 * Check if any of the specified features are enabled
 */
export function isAnyAdminFeatureEnabled(features: (keyof AdminFeatureFlags)[]): boolean {
  if (!isAdminPortalAccessible()) {
    return false;
  }
  return features.some((feature) => isAdminFeatureEnabled(feature));
}

// =============================================================================
// FEATURE DEPENDENCIES
// =============================================================================

/**
 * Feature dependencies - if a feature requires another feature to be enabled
 */
const FEATURE_DEPENDENCIES: Partial<Record<keyof AdminFeatureFlags, (keyof AdminFeatureFlags)[]>> = {
  impersonation: ['supportTools', 'userManagement'],
  dataExport: ['billingDashboard', 'analyticsDashboard'],
  bulkOperations: ['userManagement', 'organizationManagement'],
};

/**
 * Check if a feature and all its dependencies are enabled
 */
export function isAdminFeatureFullyEnabled(feature: keyof AdminFeatureFlags): boolean {
  if (!isAdminFeatureEnabled(feature)) {
    return false;
  }

  const dependencies = FEATURE_DEPENDENCIES[feature];
  if (dependencies) {
    return dependencies.some((dep) => isAdminFeatureEnabled(dep));
  }

  return true;
}

// =============================================================================
// FEATURE LIST FOR UI
// =============================================================================

export interface AdminFeatureInfo {
  key: keyof AdminFeatureFlags;
  name: string;
  description: string;
  envVar: string;
  dependencies?: (keyof AdminFeatureFlags)[];
}

export const ADMIN_FEATURE_INFO: AdminFeatureInfo[] = [
  {
    key: 'adminPortalEnabled',
    name: 'Admin Portal',
    description: 'Master switch for the entire admin portal',
    envVar: 'ADMIN_PORTAL_ENABLED',
  },
  {
    key: 'organizationManagement',
    name: 'Organization Management',
    description: 'Manage organizations, licenses, and tiers',
    envVar: 'ADMIN_ORGANIZATION_MANAGEMENT',
  },
  {
    key: 'userManagement',
    name: 'User Management',
    description: 'Manage users, subscriptions, and accounts',
    envVar: 'ADMIN_USER_MANAGEMENT',
  },
  {
    key: 'billingDashboard',
    name: 'Billing Dashboard',
    description: 'View revenue metrics, transactions, and failed payments',
    envVar: 'ADMIN_BILLING_DASHBOARD',
  },
  {
    key: 'analyticsDashboard',
    name: 'Analytics Dashboard',
    description: 'View growth charts, feature usage, and retention metrics',
    envVar: 'ADMIN_ANALYTICS_DASHBOARD',
  },
  {
    key: 'featureFlagsManagement',
    name: 'Feature Flags',
    description: 'Control global feature flags and overrides',
    envVar: 'ADMIN_FEATURE_FLAGS',
  },
  {
    key: 'supportTools',
    name: 'Support Tools',
    description: 'Access logs, error tracking, and debugging tools',
    envVar: 'ADMIN_SUPPORT_TOOLS',
  },
  {
    key: 'impersonation',
    name: 'User Impersonation',
    description: 'Login as users for debugging purposes',
    envVar: 'ADMIN_IMPERSONATION',
    dependencies: ['supportTools', 'userManagement'],
  },
  {
    key: 'auditLogs',
    name: 'Audit Logs',
    description: 'View and export admin audit trail',
    envVar: 'ADMIN_AUDIT_LOGS',
  },
  {
    key: 'ipWhitelist',
    name: 'IP Whitelist',
    description: 'Restrict admin access to specific IP addresses',
    envVar: 'ADMIN_IP_WHITELIST',
  },
  {
    key: 'mfaRequired',
    name: 'MFA Required',
    description: 'Require MFA for all admin accounts',
    envVar: 'ADMIN_MFA_REQUIRED',
  },
  {
    key: 'dataExport',
    name: 'Data Export',
    description: 'Export billing and analytics data',
    envVar: 'ADMIN_DATA_EXPORT',
    dependencies: ['billingDashboard', 'analyticsDashboard'],
  },
  {
    key: 'bulkOperations',
    name: 'Bulk Operations',
    description: 'Perform bulk actions on users and organizations',
    envVar: 'ADMIN_BULK_OPERATIONS',
    dependencies: ['userManagement', 'organizationManagement'],
  },
];

// =============================================================================
// DEBUGGING UTILITIES
// =============================================================================

/**
 * Get list of all enabled admin features
 */
export function getEnabledAdminFeatures(): string[] {
  const flags = getAdminFeatureFlags();
  return Object.entries(flags)
    .filter(([, enabled]) => enabled)
    .map(([key]) => key);
}

/**
 * Get list of all disabled admin features
 */
export function getDisabledAdminFeatures(): string[] {
  const flags = getAdminFeatureFlags();
  return Object.entries(flags)
    .filter(([, enabled]) => !enabled)
    .map(([key]) => key);
}

/**
 * Get a summary of admin feature flag status
 */
export function getAdminFeatureFlagSummary(): {
  total: number;
  enabled: number;
  disabled: number;
  portalAccessible: boolean;
} {
  const flags = getAdminFeatureFlags();
  const entries = Object.values(flags);

  return {
    total: entries.length,
    enabled: entries.filter((v) => v).length,
    disabled: entries.filter((v) => !v).length,
    portalAccessible: flags.adminPortalEnabled,
  };
}

// =============================================================================
// EMERGENCY DISABLE
// =============================================================================

/**
 * Emergency disable all admin features
 * Note: This only affects the in-memory cache, not environment variables
 */
export function emergencyDisableAdminPortal(): AdminFeatureFlags {
  console.warn('[ADMIN PORTAL] Emergency disable triggered - all features disabled');
  cachedFlags = { ...DEFAULT_ADMIN_FLAGS };
  return cachedFlags;
}
