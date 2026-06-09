import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { extractPropertyLinks, wrapWithGRDCS } from '@/lib/grdcs';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import { createAuditLog } from '@/lib/security/auditLog';
import { REFORM_CUT_OVER_UTC } from '@/lib/tax-engine/config/reformConstants';

/**
 * Phase 41E reform cut-over (CLAUDE.md §12.14): 7:30pm AEST 12 May 2026 =
 * 2026-05-12T09:30:00Z. Imported from the canonical SSOT
 * `lib/tax-engine/config/reformConstants.ts` — §12.14 NON-NEGOTIABLE
 * forbids hard-coding the cut-over timestamp anywhere else.
 * Pre-cut-over purchases auto-fill `acquisitionContractDate := purchaseDate`
 * (unambiguously grandfathered); post-cut-over keep the user-confirmed
 * contract date or null. This route stores reform INPUTS only — no
 * post-reform math (FW-2: no silent post-reform numbers).
 */
const REFORM_CUT_OVER_UTC_MS = REFORM_CUT_OVER_UTC.getTime();

export const GET = withPermission('property.read', async (request, auth) => {
    try {
      const properties = await prisma.property.findMany({
        where: { userId: auth.userId },
        // Phase 45.2.5 — omit the heavy `heroImage` bytea from the list
        // response. The list page does not render per-property photos
        // (only the detail page does, via the dedicated hero-image endpoint).
        omit: { heroImage: true },
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
        // Renewal dates (Phase 21.5) — operational reminder inputs only;
        // no reform/CGT interaction (CLAUDE.md §12.14 FW-3).
        councilRatesDueDate,
        waterRatesDueDate,
        landTaxDueDate,
        buildingInsuranceProvider,
        buildingInsurancePolicyNumber,
        buildingInsuranceExpiry,
        strataDueDate,
        leaseExpiry,
        complianceCertExpiry,
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
          // Renewal dates (Phase 21.5) — empty string / missing → null.
          councilRatesDueDate: councilRatesDueDate ? new Date(councilRatesDueDate) : null,
          waterRatesDueDate: waterRatesDueDate ? new Date(waterRatesDueDate) : null,
          landTaxDueDate: landTaxDueDate ? new Date(landTaxDueDate) : null,
          buildingInsuranceProvider: buildingInsuranceProvider || null,
          buildingInsurancePolicyNumber: buildingInsurancePolicyNumber || null,
          buildingInsuranceExpiry: buildingInsuranceExpiry ? new Date(buildingInsuranceExpiry) : null,
          strataDueDate: strataDueDate ? new Date(strataDueDate) : null,
          leaseExpiry: leaseExpiry ? new Date(leaseExpiry) : null,
          complianceCertExpiry: complianceCertExpiry ? new Date(complianceCertExpiry) : null,
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
