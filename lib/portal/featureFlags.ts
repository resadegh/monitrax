/**
 * Phase 32: Enterprise Portal Feature Flags
 *
 * All portal features are disabled by default.
 * Enable features gradually as they are implemented and tested.
 *
 * ISOLATION PRINCIPLE: These flags ensure the portal does NOT
 * interfere with the main application functionality.
 */

export interface PortalFeatureFlags {
  // Core Portal Features
  portalEnabled: boolean;
  organizationManagement: boolean;
  clientManagement: boolean;
  consentSystem: boolean;
  clientDataAccess: boolean;

  // Advisor Tools (Phase 32.6)
  advisorNotes: boolean;
  advisorTasks: boolean;

  // Export & Reporting (Phase 32.7)
  exportReporting: boolean;

  // Audit & Compliance (Phase 32.8)
  auditLogs: boolean;
  complianceTools: boolean;

  // Billing Integration (Phase 32.9)
  billingIntegration: boolean;

  // White-labeling (Phase 32.11)
  whiteLabeling: boolean;
  customBranding: boolean;
  customDomains: boolean;

  // SSO/SAML (Phase 32.12)
  ssoSaml: boolean;

  // API Access (Phase 32.13)
  externalApiAccess: boolean;
  apiKeyManagement: boolean;

  // Accounting Integrations (Phase 32.14)
  accountingIntegrations: boolean;
  xeroIntegration: boolean;

  // Additional Providers (Phase 32.15)
  myobIntegration: boolean;
  quickbooksIntegration: boolean;
}

/**
 * Default feature flags - ALL DISABLED
 *
 * Features should only be enabled:
 * 1. After implementation is complete
 * 2. After testing passes
 * 3. With explicit approval for any main app changes
 */
const defaultFlags: PortalFeatureFlags = {
  // Core Portal Features - Phase 32.1-32.5
  portalEnabled: false,
  organizationManagement: false,
  clientManagement: false,
  consentSystem: false,
  clientDataAccess: false,

  // Advisor Tools - Phase 32.6
  advisorNotes: false,
  advisorTasks: false,

  // Export & Reporting - Phase 32.7
  exportReporting: false,

  // Audit & Compliance - Phase 32.8
  auditLogs: false,
  complianceTools: false,

  // Billing Integration - Phase 32.9
  billingIntegration: false,

  // White-labeling - Phase 32.11
  whiteLabeling: false,
  customBranding: false,
  customDomains: false,

  // SSO/SAML - Phase 32.12
  ssoSaml: false,

  // API Access - Phase 32.13
  externalApiAccess: false,
  apiKeyManagement: false,

  // Accounting Integrations - Phase 32.14
  accountingIntegrations: false,
  xeroIntegration: false,

  // Additional Providers - Phase 32.15
  myobIntegration: false,
  quickbooksIntegration: false,
};

/**
 * Environment-based feature flag overrides
 *
 * Set these environment variables to enable specific features:
 * - PORTAL_ENABLED=true
 * - PORTAL_XERO_INTEGRATION=true
 * etc.
 */
function getEnvironmentOverrides(): Partial<PortalFeatureFlags> {
  const overrides: Partial<PortalFeatureFlags> = {};

  // Core flags
  if (process.env.PORTAL_ENABLED === 'true') {
    overrides.portalEnabled = true;
  }
  if (process.env.PORTAL_ORGANIZATION_MANAGEMENT === 'true') {
    overrides.organizationManagement = true;
  }
  if (process.env.PORTAL_CLIENT_MANAGEMENT === 'true') {
    overrides.clientManagement = true;
  }
  if (process.env.PORTAL_CONSENT_SYSTEM === 'true') {
    overrides.consentSystem = true;
  }
  if (process.env.PORTAL_CLIENT_DATA_ACCESS === 'true') {
    overrides.clientDataAccess = true;
  }

  // Advisor tools
  if (process.env.PORTAL_ADVISOR_NOTES === 'true') {
    overrides.advisorNotes = true;
  }
  if (process.env.PORTAL_ADVISOR_TASKS === 'true') {
    overrides.advisorTasks = true;
  }

  // Export & Reporting
  if (process.env.PORTAL_EXPORT_REPORTING === 'true') {
    overrides.exportReporting = true;
  }

  // Audit & Compliance
  if (process.env.PORTAL_AUDIT_LOGS === 'true') {
    overrides.auditLogs = true;
  }
  if (process.env.PORTAL_COMPLIANCE_TOOLS === 'true') {
    overrides.complianceTools = true;
  }

  // Billing
  if (process.env.PORTAL_BILLING_INTEGRATION === 'true') {
    overrides.billingIntegration = true;
  }

  // White-labeling
  if (process.env.PORTAL_WHITE_LABELING === 'true') {
    overrides.whiteLabeling = true;
  }
  if (process.env.PORTAL_CUSTOM_BRANDING === 'true') {
    overrides.customBranding = true;
  }
  if (process.env.PORTAL_CUSTOM_DOMAINS === 'true') {
    overrides.customDomains = true;
  }

  // SSO/SAML
  if (process.env.PORTAL_SSO_SAML === 'true') {
    overrides.ssoSaml = true;
  }

  // API Access
  if (process.env.PORTAL_EXTERNAL_API_ACCESS === 'true') {
    overrides.externalApiAccess = true;
  }
  if (process.env.PORTAL_API_KEY_MANAGEMENT === 'true') {
    overrides.apiKeyManagement = true;
  }

  // Accounting Integrations
  if (process.env.PORTAL_ACCOUNTING_INTEGRATIONS === 'true') {
    overrides.accountingIntegrations = true;
  }
  if (process.env.PORTAL_XERO_INTEGRATION === 'true') {
    overrides.xeroIntegration = true;
  }
  if (process.env.PORTAL_MYOB_INTEGRATION === 'true') {
    overrides.myobIntegration = true;
  }
  if (process.env.PORTAL_QUICKBOOKS_INTEGRATION === 'true') {
    overrides.quickbooksIntegration = true;
  }

  return overrides;
}

/**
 * Get the current feature flags with environment overrides applied
 */
export function getPortalFeatureFlags(): PortalFeatureFlags {
  return {
    ...defaultFlags,
    ...getEnvironmentOverrides(),
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isPortalFeatureEnabled(feature: keyof PortalFeatureFlags): boolean {
  const flags = getPortalFeatureFlags();
  return flags[feature];
}

/**
 * Check if the portal is accessible at all
 * This is the master switch for all portal functionality
 */
export function isPortalAccessible(): boolean {
  return isPortalFeatureEnabled('portalEnabled');
}

/**
 * Check if accounting integrations are available
 */
export function isAccountingIntegrationAvailable(provider: 'xero' | 'myob' | 'quickbooks'): boolean {
  const flags = getPortalFeatureFlags();

  if (!flags.accountingIntegrations) {
    return false;
  }

  switch (provider) {
    case 'xero':
      return flags.xeroIntegration;
    case 'myob':
      return flags.myobIntegration;
    case 'quickbooks':
      return flags.quickbooksIntegration;
    default:
      return false;
  }
}

/**
 * Get a summary of enabled features (for debugging/admin)
 */
export function getEnabledFeatures(): string[] {
  const flags = getPortalFeatureFlags();
  return Object.entries(flags)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature);
}

/**
 * Emergency kill switch - disable all portal features
 * Call this in case of critical issues
 */
export function emergencyDisablePortal(): PortalFeatureFlags {
  // In a real implementation, this would also:
  // 1. Log the emergency disable
  // 2. Notify administrators
  // 3. Potentially persist the disabled state
  console.warn('[PORTAL] Emergency disable triggered - all portal features disabled');
  return defaultFlags;
}
