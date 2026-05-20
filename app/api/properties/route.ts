import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { extractPropertyLinks, wrapWithGRDCS } from '@/lib/grdcs';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import { createAuditLog } from '@/lib/security/auditLog';

/**
 * Phase 41E reform cut-over (CLAUDE.md §12.14): 7:30pm AEST 12 May 2026 =
 * 2026-05-12T09:30:00Z. Same constant `bulk-create` uses. Pre-cut-over
 * purchases auto-fill `acquisitionContractDate := purchaseDate`
 * (unambiguously grandfathered); post-cut-over keep the user-confirmed
 * contract date or null. This route stores reform INPUTS only — no
 * post-reform math (FW-2: no silent post-reform numbers).
 */
const REFORM_CUT_OVER_UTC_MS = Date.UTC(2026, 4, 12, 9, 30, 0);

export const GET = withPermission('property.read', async (request, auth) => {
    try {
      const properties = await prisma.property.findMany({
        where: { userId: auth.userId },
        include: {
          loans: {
            include: {
              offsetAccount: true,
            },
          },
          income: true,
          expenses: true,
          depreciationSchedules: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Apply GRDCS wrapper to each property
      const propertiesWithLinks = properties.map((property: typeof properties[number]) => {
        const links = extractPropertyLinks(property);
        return wrapWithGRDCS(property as Record<string, unknown>, 'property', links);
      });

      return NextResponse.json({
        data: propertiesWithLinks,
        _meta: {
          count: propertiesWithLinks.length,
          totalLinkedEntities: propertiesWithLinks.reduce((sum: number, p: { _meta: { linkedCount: number } }) => sum + p._meta.linkedCount, 0),
        },
      });
    } catch (error) {
      console.error('Get properties error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const POST = withPermission('property.write', async (request, auth) => {
    try {
      const body = await request.json();
      const {
        name,
        type,
        address,
        purchasePrice,
        purchaseDate,
        currentValue,
        valuationDate,
        // Phase 41E reform inputs (CLAUDE.md §12.14)
        acquisitionContractDate,
        isNewBuild,
        newBuildEvidence,
        // Location fields (Google Maps)
        latitude,
        longitude,
        googlePlaceId,
        suburb,
        state,
        postcode,
      } = body;

      // `purchasePrice` / `currentValue` are validated as "present", not
      // "truthy" — 0 is a legitimate value (a user may not know what they
      // paid, or an off-the-plan value). The wizard's two-way sync (Track
      // F.2) can legitimately send 0.
      if (
        !name ||
        !type ||
        purchasePrice === undefined ||
        purchasePrice === null ||
        !purchaseDate ||
        currentValue === undefined ||
        currentValue === null ||
        !valuationDate
      ) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const ownerEntityId = await getDefaultLegalEntityId(auth.userId);

      // Phase 41E (§12.14): resolve the regime-determining contract date.
      const purchaseDateObj = new Date(purchaseDate);
      const isPostCutOver =
        !Number.isNaN(purchaseDateObj.getTime()) &&
        purchaseDateObj.getTime() > REFORM_CUT_OVER_UTC_MS;
      const resolvedContractDate = acquisitionContractDate
        ? new Date(acquisitionContractDate)
        : isPostCutOver
          ? null // user didn't confirm — engine surfaces the UNCOMPUTED code
          : purchaseDateObj; // pre-cut-over → grandfathered

      const property = await prisma.property.create({
        data: {
          userId: auth.userId,
          ownerEntityId,
          name,
          type,
          address,
          purchasePrice: parseFloat(purchasePrice),
          purchaseDate: purchaseDateObj,
          currentValue: parseFloat(currentValue),
          valuationDate: new Date(valuationDate),
          // Phase 41E reform inputs — stored, never computed here.
          acquisitionContractDate: resolvedContractDate,
          isNewBuild: isPostCutOver ? (isNewBuild ?? null) : null,
          newBuildEvidence: isPostCutOver ? (newBuildEvidence ?? null) : null,
          // Location data
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          googlePlaceId: googlePlaceId || null,
          suburb: suburb || null,
          state: state || null,
          postcode: postcode || null,
        },
      });

      // Audit every state-changing write (CLAUDE.md §12.5). This route is the
      // wizard's SSOT write boundary for properties (Phase 12 Track F.2). No
      // CDR/financial values in metadata (§13.3) — type + booleans only.
      void createAuditLog({
        userId: auth.userId,
        action: 'PROPERTY_CREATED',
        status: 'SUCCESS',
        entityType: 'Property',
        entityId: property.id,
        metadata: { type, isPostCutOver },
      });

      return NextResponse.json(property, { status: 201 });
    } catch (error) {
      console.error('Create property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
