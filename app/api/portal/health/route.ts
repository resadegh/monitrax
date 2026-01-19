/**
 * Phase 32: Enterprise Portal Health Check
 *
 * GET /api/portal/health
 *
 * Returns the status of the portal and enabled features.
 */

import { NextResponse } from 'next/server';
import {
  getPortalFeatureFlags,
  isPortalAccessible,
  getEnabledFeatures,
} from '@/lib/portal';

export async function GET() {
  const flags = getPortalFeatureFlags();
  const enabledFeatures = getEnabledFeatures();

  return NextResponse.json({
    status: 'ok',
    portal: {
      accessible: isPortalAccessible(),
      enabledFeatures,
      featureCount: enabledFeatures.length,
    },
    flags,
    timestamp: new Date().toISOString(),
  });
}
