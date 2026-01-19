/**
 * Phase 33: Admin Health Check API
 *
 * GET /api/admin/health
 * Health check endpoint for the admin portal.
 */

import { NextResponse } from 'next/server';
import { isAdminPortalAccessible, getAdminFeatureFlagSummary } from '@/lib/admin/featureFlags';

export async function GET() {
  const portalAccessible = isAdminPortalAccessible();
  const flagSummary = getAdminFeatureFlagSummary();

  return NextResponse.json({
    status: portalAccessible ? 'healthy' : 'disabled',
    timestamp: new Date().toISOString(),
    portal: {
      enabled: portalAccessible,
      features: flagSummary,
    },
  });
}
