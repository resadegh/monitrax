import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { createAuditLog } from '@/lib/security/auditLog';
import { cleanupAssetOwnership } from '@/lib/services/assetOwnershipCleanup';
import { enrichPropertiesWithActuals } from '@/lib/services/propertyActuals';
import { REFORM_CUT_OVER_UTC } from '@/lib/tax-engine/config/reformConstants';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Phase 41E reform cut-over (CLAUDE.md §12.14): 7:30pm AEST 12 May 2026 =
 * 2026-05-12T09:30:00Z. Imported from the canonical SSOT
 * `lib/tax-engine/config/reformConstants.ts` — §12.14 NON-NEGOTIABLE
 * forbids hard-coding the cut-over timestamp anywhere else. Pre-cut-over
 * purchases auto-fill `acquisitionContractDate := purchaseDate`;
 * post-cut-over keep the user-confirmed value or null. Reform INPUTS only
 * — no post-reform math.
 */
const REFORM_CUT_OVER_UTC_MS = REFORM_CUT_OVER_UTC.getTime();

export const GET = withPermission<RouteContext>('property.read', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const userId = auth.userId;

      // First fetch the property with related data to get IDs. We omit the
      // heavy `heroImage` bytea here — the detail page fetches the image
      // separately from /api/properties/[id]/hero-image (§18.7.4 Cremorne
      // pattern, Phase 45.2.5). The `hasHeroImage` boolean is derived on the
      // way out so the client knows whether to render the user-uploaded photo
      // or the default decor.
      const property = await prisma.property.findUnique({
        where: { id },
        omit: { heroImage: true },
        include: {
          loans: true,
          income: true,
          expenses: true,
          depreciationSchedules: true,
        },
      });

      const ownershipResult = verifyOwnership(property, auth.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      // Enrich income / expenses / loans with reconciled actuals via the ONE
      // shared producer (§12.2.1 / §19.4). The property LIST route calls the
      // same helper (batched) so both surfaces read identical numbers.
      const [enriched] = await enrichPropertiesWithActuals(userId, [property!]);
      const {
        income: incomeWithActuals,
        expenses: expensesWithActuals,
        loans: loansWithActuals,
      } = enriched;

      return NextResponse.json({
        ...property,
        // Phase 45.2.5 — replace the raw bytes column (which we omitted at
        // query time) with a derived boolean. Detail page uses this to
        // decide whether to fetch the user-uploaded photo or render the
        // default Cremorne apartment decor.
        hasHeroImage: property!.heroImageMime !== null,
        income: incomeWithActuals,
        expenses: expensesWithActuals,
        loans: loansWithActuals,
      });
    } catch (error) {
      console.error('Get property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const PUT = withPermission<RouteContext>('property.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
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

      // Verify ownership
      const existing = await prisma.property.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, auth.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      // Phase 41E (§12.14): resolve the regime-determining contract date.
      const purchaseDateObj = new Date(purchaseDate);
      const isPostCutOver =
        !Number.isNaN(purchaseDateObj.getTime()) &&
        purchaseDateObj.getTime() > REFORM_CUT_OVER_UTC_MS;
      const resolvedContractDate = acquisitionContractDate
        ? new Date(acquisitionContractDate)
        : isPostCutOver
          ? null
          : purchaseDateObj;

      const property = await prisma.property.update({
        where: { id },
        data: {
          name,
          type,
          address,
          purchasePrice,
          purchaseDate: purchaseDateObj,
          currentValue,
          valuationDate: new Date(valuationDate),
          // Phase 41E reform inputs — stored, never computed here. Only
          // written when the caller sent a reform field, so a dashboard
          // edit that omits them leaves the existing values untouched.
          ...(acquisitionContractDate !== undefined ||
          isNewBuild !== undefined ||
          newBuildEvidence !== undefined
            ? {
                acquisitionContractDate: resolvedContractDate,
                isNewBuild: isPostCutOver ? (isNewBuild ?? null) : null,
                newBuildEvidence: isPostCutOver
                  ? (newBuildEvidence ?? null)
                  : null,
              }
            : {}),
          // Location data
          latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : undefined,
          longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : undefined,
          googlePlaceId: googlePlaceId !== undefined ? (googlePlaceId || null) : undefined,
          suburb: suburb !== undefined ? (suburb || null) : undefined,
          state: state !== undefined ? (state || null) : undefined,
          postcode: postcode !== undefined ? (postcode || null) : undefined,
          // Renewal dates (Phase 21.5) — only written when the caller sent the
          // field, so an edit that omits them leaves existing values untouched.
          councilRatesDueDate: councilRatesDueDate !== undefined ? (councilRatesDueDate ? new Date(councilRatesDueDate) : null) : undefined,
          waterRatesDueDate: waterRatesDueDate !== undefined ? (waterRatesDueDate ? new Date(waterRatesDueDate) : null) : undefined,
          landTaxDueDate: landTaxDueDate !== undefined ? (landTaxDueDate ? new Date(landTaxDueDate) : null) : undefined,
          buildingInsuranceProvider: buildingInsuranceProvider !== undefined ? (buildingInsuranceProvider || null) : undefined,
          buildingInsurancePolicyNumber: buildingInsurancePolicyNumber !== undefined ? (buildingInsurancePolicyNumber || null) : undefined,
          buildingInsuranceExpiry: buildingInsuranceExpiry !== undefined ? (buildingInsuranceExpiry ? new Date(buildingInsuranceExpiry) : null) : undefined,
          strataDueDate: strataDueDate !== undefined ? (strataDueDate ? new Date(strataDueDate) : null) : undefined,
          leaseExpiry: leaseExpiry !== undefined ? (leaseExpiry ? new Date(leaseExpiry) : null) : undefined,
          complianceCertExpiry: complianceCertExpiry !== undefined ? (complianceCertExpiry ? new Date(complianceCertExpiry) : null) : undefined,
        },
      });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'PROPERTY_UPDATED',
        status: 'SUCCESS',
        entityType: 'Property',
        entityId: property.id,
        metadata: { type, isPostCutOver },
      });

      return NextResponse.json(property);
    } catch (error) {
      console.error('Update property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const DELETE = withPermission<RouteContext>('property.delete', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      // Verify ownership
      const existing = await prisma.property.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, auth.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      // Delete the property AND its polymorphic ownership rows atomically
      // (audit L2-2: no DB FK on OwnershipGroup/BeneficialOwnershipOverride, so
      // the DB can't cascade — clean up in the same transaction).
      const cleanup = await prisma.$transaction(async (tx) => {
        await tx.property.delete({ where: { id } });
        return cleanupAssetOwnership(tx, {
          userId: auth.userId,
          ownedObjectType: 'property',
          ownedObjectId: id,
        });
      });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'PROPERTY_DELETED',
        status: 'SUCCESS',
        entityType: 'Property',
        entityId: id,
        metadata: {
          ownershipGroupsDeleted: cleanup.ownershipGroupsDeleted,
          beneficialOverridesDeleted: cleanup.beneficialOverridesDeleted,
        },
      });

      return NextResponse.json({ message: 'Property deleted successfully' });
    } catch (error) {
      console.error('Delete property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
