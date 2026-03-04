/**
 * Phase 32: Portal Status API
 *
 * Returns the current portal feature flag status.
 * Used by client components to check if portal is enabled.
 */

import { NextResponse } from 'next/server';
import { isPortalAccessible, getPortalFeatureFlags } from '@/lib/portal/featureFlags';

export async function GET() {
  const flags = getPortalFeatureFlags();

  return NextResponse.json({
    enabled: isPortalAccessible(),
    features: {
      clientManagement: flags.clientManagement,
      organizationManagement: flags.organizationManagement,
      consentSystem: flags.consentSystem,
      clientDataAccess: flags.clientDataAccess,
      advisorNotes: flags.advisorNotes,
      advisorTasks: flags.advisorTasks,
      accountingIntegrations: flags.accountingIntegrations,
    },
  });
}
