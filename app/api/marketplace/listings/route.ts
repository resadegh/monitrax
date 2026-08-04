/**
 * Phase 32C PR4a — Public marketplace browse.
 *
 * GET /api/marketplace/listings
 *
 * Returns APPROVED listings only. Filters: discipline, region, specialisation,
 * targetTier, search. Sorted by averageRating desc, then engagements desc,
 * then alpha. Pagination via limit + offset (defaults 24, 0).
 *
 * Unauthenticated — the public marketplace browse is the discovery surface for
 * D2C users (signed-in or not). Org-attached users go through the in-app
 * Ask-a-Pro flow (Phase 32C PR4b/4c) which surfaces only their org's roster
 * — see IMPLEMENTATION_PLAN.md "leaky funnel" guardrail.
 */
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';
import { NextRequest, NextResponse } from 'next/server';
import { browsePublic } from '@/lib/services/marketplaceService';
import type {
  ListingRegion,
  ListingTargetTier,
  OrganizationType,
  ProfessionalSpecialisation,
} from '@prisma/client';

const VALID_DISCIPLINES: OrganizationType[] = [
  'ACCOUNTING_FIRM',
  'FINANCIAL_ADVISOR',
  'MORTGAGE_BROKER',
  'TAX_AGENT',
  'BOOKKEEPER',
  'OTHER',
];

const VALID_REGIONS: ListingRegion[] = [
  'NSW_SYDNEY_METRO',
  'NSW_REGIONAL',
  'VIC_MELBOURNE_METRO',
  'VIC_REGIONAL',
  'QLD_BRISBANE_METRO',
  'QLD_REGIONAL',
  'WA',
  'SA',
  'TAS',
  'ACT',
  'NT',
  'NATIONAL',
];

const VALID_TIERS: ListingTargetTier[] = ['EMERGING', 'GROWING', 'ESTABLISHED', 'HIGH_NET_WORTH'];

const VALID_SPECIALISATIONS: ProfessionalSpecialisation[] = [
  'RETIREMENT_PLANNING',
  'WEALTH_BUILDING',
  'TAX_OPTIMISATION',
  'ESTATE_PLANNING',
  'RISK_INSURANCE',
  'HOME_LOANS',
  'INVESTMENT_LOANS',
  'REFINANCE',
  'COMMERCIAL_LENDING',
  'FIRST_HOME_BUYER',
  'PERSONAL_TAX',
  'SMALL_BUSINESS',
  'TRUST_ACCOUNTING',
  'SMSF_ACCOUNTING',
  'PROPERTY_INVESTORS',
];

export async function GET(request: NextRequest) {
    const gateBlocked = await moduleApiGuard('MODULE_SOCIAL');
    if (gateBlocked) return gateBlocked;
  const { searchParams } = new URL(request.url);
  const disciplineParam = searchParams.get('discipline');
  const regionParam = searchParams.get('region');
  const specialisationParam = searchParams.get('specialisation');
  const targetTierParam = searchParams.get('targetTier');
  const search = searchParams.get('search') ?? undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24'), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const result = await browsePublic({
    discipline: disciplineParam && VALID_DISCIPLINES.includes(disciplineParam as OrganizationType)
      ? (disciplineParam as OrganizationType)
      : undefined,
    region: regionParam && VALID_REGIONS.includes(regionParam as ListingRegion)
      ? (regionParam as ListingRegion)
      : undefined,
    specialisation: specialisationParam && VALID_SPECIALISATIONS.includes(specialisationParam as ProfessionalSpecialisation)
      ? (specialisationParam as ProfessionalSpecialisation)
      : undefined,
    targetTier: targetTierParam && VALID_TIERS.includes(targetTierParam as ListingTargetTier)
      ? (targetTierParam as ListingTargetTier)
      : undefined,
    search,
    limit,
    offset,
  });

  return NextResponse.json({ success: true, data: result });
}
