import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { verifyOwnership } from '@/lib/utils/ownership';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/assets/:id - Get a single asset with full details
export const GET = withPermission<RouteContext>('investment.read', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const asset = await prisma.asset.findUnique({
        where: { id },
        include: {
          expenses: {
            orderBy: { createdAt: 'desc' },
          },
          valueHistory: {
            orderBy: { valuedAt: 'desc' },
          },
          serviceRecords: {
            orderBy: { serviceDate: 'desc' },
          },
        },
      });

      const ownershipResult = verifyOwnership(asset, auth.userId, 'Asset');
      if (!ownershipResult.success) return ownershipResult.response;

      // Use verified resource (TypeScript knows it's non-null after success check)
      const verifiedAsset = ownershipResult.resource;

      // Type for expense
      type AssetExpense = (typeof verifiedAsset.expenses)[number];

      // Calculate computed fields using centralized utility
      const annualExpenses = verifiedAsset.expenses.reduce((total: number, expense: AssetExpense) => {
        return total + toAnnual(expense.amount, expense.frequency as Frequency);
      }, 0);

      const totalExpenses = verifiedAsset.expenses.reduce((total: number, expense: AssetExpense) => {
        return total + expense.amount;
      }, 0);

      const depreciation = verifiedAsset.purchasePrice - verifiedAsset.currentValue;
      const depreciationPercent =
        verifiedAsset.purchasePrice > 0 ? (depreciation / verifiedAsset.purchasePrice) * 100 : 0;

      const totalCostOfOwnership =
        verifiedAsset.purchasePrice + totalExpenses - (verifiedAsset.salePrice || 0);

      // Vehicle-specific: cost per km if applicable
      let costPerKm = null;
      if (verifiedAsset.type === 'VEHICLE' && verifiedAsset.vehicleOdometer && verifiedAsset.vehicleOdometer > 0) {
        costPerKm = totalCostOfOwnership / verifiedAsset.vehicleOdometer;
      }

      return NextResponse.json({
        ...verifiedAsset,
        _computed: {
          annualExpenses,
          totalExpenses,
          depreciation,
          depreciationPercent,
          totalCostOfOwnership,
          costPerKm,
        },
      });
    } catch (error) {
      console.error('Get asset error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
});

// PUT /api/assets/:id - Update an asset
export const PUT = withPermission<RouteContext>('investment.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const body = await request.json();

      // Verify ownership
      const existing = await prisma.asset.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, auth.userId, 'Asset');
      if (!ownershipResult.success) return ownershipResult.response;

      // Use verified resource (TypeScript knows it's non-null after success check)
      const verifiedExisting = ownershipResult.resource;

      const {
        name,
        type,
        status,
        description,
        purchasePrice,
        purchaseDate,
        currentValue,
        valuationDate,
        salePrice,
        saleDate,
        // Vehicle-specific
        vehicleMake,
        vehicleModel,
        vehicleYear,
        vehicleRegistration,
        vehicleFuelType,
        vehicleOdometer,
        vehicleVin,
        // Vehicle renewal dates (Phase 21.5)
        vehicleRegistrationExpiry,
        vehicleCtpProvider,
        vehicleCtpExpiry,
        vehicleInsuranceProvider,
        vehicleInsurancePolicyNumber,
        vehicleInsuranceExpiry,
        // Depreciation
        depreciationMethod,
        depreciationRate,
        usefulLifeYears,
        residualValue,
        // Other
        imageUrl,
        serialNumber,
        warrantyExpiry,
        notes,
      } = body;

      // Check if value changed - record in history. `currentValue` is
      // compared as "present" (not "truthy") so a legitimate 0 still
      // updates + records (Track F.7 two-way sync).
      const currentValueProvided = currentValue !== undefined && currentValue !== null;
      const valueChanged =
        currentValueProvided && parseFloat(currentValue) !== verifiedExisting.currentValue;

      const asset = await prisma.asset.update({
        where: { id },
        data: {
          name,
          type,
          status,
          description,
          purchasePrice:
            purchasePrice !== undefined && purchasePrice !== null
              ? parseFloat(purchasePrice)
              : undefined,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          currentValue: currentValueProvided ? parseFloat(currentValue) : undefined,
          valuationDate: valuationDate ? new Date(valuationDate) : valueChanged ? new Date() : undefined,
          salePrice: salePrice ? parseFloat(salePrice) : null,
          saleDate: saleDate ? new Date(saleDate) : null,
          // Vehicle-specific
          vehicleMake,
          vehicleModel,
          vehicleYear: vehicleYear ? parseInt(vehicleYear) : null,
          vehicleRegistration,
          vehicleFuelType,
          vehicleOdometer: vehicleOdometer ? parseInt(vehicleOdometer) : null,
          vehicleVin,
          // Vehicle renewal dates (Phase 21.5) — nullable; parse when present
          vehicleRegistrationExpiry: vehicleRegistrationExpiry ? new Date(vehicleRegistrationExpiry) : null,
          vehicleCtpProvider,
          vehicleCtpExpiry: vehicleCtpExpiry ? new Date(vehicleCtpExpiry) : null,
          vehicleInsuranceProvider,
          vehicleInsurancePolicyNumber,
          vehicleInsuranceExpiry: vehicleInsuranceExpiry ? new Date(vehicleInsuranceExpiry) : null,
          // Depreciation
          depreciationMethod,
          depreciationRate: depreciationRate ? parseFloat(depreciationRate) : null,
          usefulLifeYears: usefulLifeYears ? parseInt(usefulLifeYears) : null,
          residualValue: residualValue ? parseFloat(residualValue) : null,
          // Other
          imageUrl,
          serialNumber,
          warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
          notes,
        },
      });

      // Record value change in history
      if (valueChanged) {
        await prisma.assetValueHistory.create({
          data: {
            assetId: asset.id,
            value: parseFloat(currentValue),
            source: 'MANUAL',
            notes: 'Value updated',
          },
        });
      }

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'ASSET_UPDATED',
        status: 'SUCCESS',
        entityType: 'Asset',
        entityId: asset.id,
        metadata: { type: asset.type },
      });

      return NextResponse.json(asset);
    } catch (error) {
      console.error('Update asset error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
});

// DELETE /api/assets/:id - Delete an asset
export const DELETE = withPermission<RouteContext>('investment.delete', async (request, auth, context) => {
    try {
      const { id } = await context!.params;

      // Verify ownership
      const existing = await prisma.asset.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, auth.userId, 'Asset');
      if (!ownershipResult.success) return ownershipResult.response;

      // Delete the asset (cascades to value history and service records)
      await prisma.asset.delete({
        where: { id },
      });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'ASSET_DELETED',
        status: 'SUCCESS',
        entityType: 'Asset',
        entityId: id,
      });

      return NextResponse.json({ message: 'Asset deleted successfully' });
    } catch (error) {
      console.error('Delete asset error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
});
