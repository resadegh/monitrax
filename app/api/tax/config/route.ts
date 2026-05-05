/**
 * GET /api/tax/config — canonical FY config endpoint.
 *
 * Phase 41e.0 slice D — per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md`
 * §6.8. Returns the `TaxYearConfig` for the requested FY (or the
 * current FY if not specified). Replaces hard-coded constants in any
 * surface that previously read brackets / caps / SG rate / etc.
 * inline; future consumers (dashboard widgets, future Phase 41 sub-PRs)
 * fetch from here so changing a threshold in `taxYearConfig.ts`
 * propagates without a rebuild.
 *
 * Permission: `tax_data.read` (Phase 41e.0 slice A — VIEWER+ audience,
 * mirrors `report.read`).
 *
 * Query: `?fy=2024-25` (optional). Defaults to current FY.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  getTaxYearConfig,
  getCurrentTaxYearConfig,
  getAvailableTaxYears,
} from '@/lib/tax-engine/config/taxYearConfig';

export const GET = withPermission('tax_data.read', async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const requestedFY = searchParams.get('fy');

    const config = requestedFY
      ? getTaxYearConfig(requestedFY)
      : getCurrentTaxYearConfig();

    return NextResponse.json({
      success: true,
      data: {
        config,
        availableFinancialYears: getAvailableTaxYears(),
      },
    });
  } catch (error) {
    console.error('Tax config fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load tax config' },
      { status: 500 },
    );
  }
});
