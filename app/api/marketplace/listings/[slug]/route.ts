/**
 * Phase 32C PR4a — Public listing detail by slug.
 *
 * GET /api/marketplace/listings/[slug]
 *
 * Returns an APPROVED listing's full public profile by `publicSlug`. Includes
 * the most recent 10 public ratings (non-flagged, isPublic=true). 404s if the
 * listing isn't APPROVED or doesn't exist.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPublicListing } from '@/lib/services/marketplaceService';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const listing = await getPublicListing(slug);
  if (!listing) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Listing not found' } },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: { listing } });
}
