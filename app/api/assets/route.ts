import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import { createAuditLog } from '@/lib/security/auditLog';

// GET /api/assets - List all assets for the user
export const GET = withPermission('investment.read', async (request, auth) => {
    try {
      const assets = await prisma.asset.findMany({
        where: { userId: auth.userId },
        include: {
          expenses: {
            select: {
              id: true,
              name: true,
              amount: true,
              frequency: true,
              category: true,
            },
          },
          valueHistory: {
            orderBy: { valuedAt: 'desc' },
            take: 5,
          },
          serviceRecords: {
            orderBy: { serviceDate: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Type for expense
      type AssetExpense = (typeof assets)[number]['expenses'][number];

      // Calculate totals for each asset
      const assetsWithTotals = assets.map((asset: (typeof assets)[number]) => {
        // Calculate annual expenses using centralized utility
        const annualExpenses = asset.expenses.reduce((total: number, expense: AssetExpense) => {
          return total + toAnnual(expense.amount, expense.frequency as Frequency);
        }, 0);

        const totalExpenses = asset.expenses.reduce((total: number, expense: AssetExpense) => {
          return total + expense.amount;
        }, 0);

        // Calculate depreciation
        const yearsSincePurchase =
          (new Date().getTime() - new Date(asset.purchaseDate).getTime()) /
          (1000 * 60 * 60 * 24 * 365);
        const depreciation = asset.purchasePrice - asset.currentValue;
        const depreciationPercent =
          asset.purchasePrice > 0
            ? (depreciation / asset.purchasePrice) * 100
            : 0;

        // Total cost of ownership
        const totalCostOfOwnership =
          asset.purchasePrice + totalExpenses - (asset.salePrice || 0);

        return {
          ...asset,
          _computed: {
            annualExpenses,
            totalExpenses,
            depreciation,
            depreciationPercent,
            totalCostOfOwnership,
            yearsSincePurchase,
          },
        };
      });

      // Type for asset
      type AssetType = (typeof assets)[number];

      // Summary stats
      const summary = {
        totalCount: assets.length,
        activeCount: assets.filter((a: AssetType) => a.status === 'ACTIVE').length,
        totalValue: assets
          .filter((a: AssetType) => a.status === 'ACTIVE')
          .reduce((sum: number, a: AssetType) => sum + a.currentValue, 0),
        byType: assets.reduce(
          (acc: Record<string, { count: number; totalValue: number }>, asset: AssetType) => {
            if (!acc[asset.type]) {
              acc[asset.type] = { count: 0, totalValue: 0 };
            }
            acc[asset.type].count++;
            if (asset.status === 'ACTIVE') {
              acc[asset.type].totalValue += asset.currentValue;
            }
            return acc;
          },
          {} as Record<string, { count: number; totalValue: number }>
        ),
      };

      return NextResponse.json({
        data: assetsWithTotals,
        summary,
      });
    } catch (error) {
      console.error('Get assets error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
});

// POST /api/assets - Create a new asset
export const POST = withPermission('investment.write', async (request, auth) => {
    try {
      const body = await request.json();
      const {
        name,
        type,
        description,
        purchasePrice,
        purchaseDate,
        currentValue,
        valuationDate,
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

      // Validate required fields. `purchasePrice` / `currentValue` are
      // validated as "present", not "truthy" — 0 is a legitimate value the
      // wizard's two-way sync (Track F.7) can send.
      if (
        !name ||
        !type ||
        purchasePrice === undefined ||
        purchasePrice === null ||
        !purchaseDate ||
        currentValue === undefined ||
        currentValue === null
      ) {
        return NextResponse.json(
          { error: 'Missing required fields: name, type, purchasePrice, purchaseDate, currentValue' },
          { status: 400 }
        );
      }

      const ownerEntityId = await getDefaultLegalEntityId(auth.userId);

      const asset = await prisma.asset.create({
        data: {
          userId: auth.userId,
          ownerEntityId,
          name,
          type,
          description,
          purchasePrice: parseFloat(purchasePrice),
          purchaseDate: new Date(purchaseDate),
          currentValue: parseFloat(currentValue),
          valuationDate: valuationDate ? new Date(valuationDate) : new Date(),
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

      // Create initial value history entry
      await prisma.assetValueHistory.create({
        data: {
          assetId: asset.id,
          value: asset.currentValue,
          source: 'MANUAL',
          notes: 'Initial value at creation',
        },
      });

      // Audit every state-changing write (CLAUDE.md §12.5). This route is
      // the wizard's SSOT write boundary for assets (Track F.7). No
      // CDR/financial values in metadata (§13.3) — type only.
      void createAuditLog({
        userId: auth.userId,
        action: 'ASSET_CREATED',
        status: 'SUCCESS',
        entityType: 'Asset',
        entityId: asset.id,
        metadata: { type },
      });

      return NextResponse.json(asset, { status: 201 });
    } catch (error) {
      console.error('Create asset error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
});
