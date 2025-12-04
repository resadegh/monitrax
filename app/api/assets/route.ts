import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// GET /api/assets - List all assets for the user
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const assets = await prisma.asset.findMany({
        where: { userId: authReq.user!.userId },
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
        // Calculate annual expenses (normalize to annual)
        const frequencyMultipliers: Record<string, number> = {
          WEEKLY: 52,
          FORTNIGHTLY: 26,
          MONTHLY: 12,
          QUARTERLY: 4,
          ANNUAL: 1,
        };

        const annualExpenses = asset.expenses.reduce((total: number, expense: AssetExpense) => {
          const multiplier = frequencyMultipliers[expense.frequency] || 1;
          return total + expense.amount * multiplier;
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
}

// POST /api/assets - Create a new asset
export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
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

      // Validate required fields
      if (!name || !type || !purchasePrice || !purchaseDate || !currentValue) {
        return NextResponse.json(
          { error: 'Missing required fields: name, type, purchasePrice, purchaseDate, currentValue' },
          { status: 400 }
        );
      }

      const asset = await prisma.asset.create({
        data: {
          userId: authReq.user!.userId,
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

      return NextResponse.json(asset, { status: 201 });
    } catch (error) {
      console.error('Create asset error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}
