import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// GET /api/assets/:id - Get a single asset with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
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

      if (!asset || asset.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      // Type for expense
      type AssetExpense = (typeof asset.expenses)[number];

      // Calculate computed fields
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

      const depreciation = asset.purchasePrice - asset.currentValue;
      const depreciationPercent =
        asset.purchasePrice > 0 ? (depreciation / asset.purchasePrice) * 100 : 0;

      const totalCostOfOwnership =
        asset.purchasePrice + totalExpenses - (asset.salePrice || 0);

      // Vehicle-specific: cost per km if applicable
      let costPerKm = null;
      if (asset.type === 'VEHICLE' && asset.vehicleOdometer && asset.vehicleOdometer > 0) {
        costPerKm = totalCostOfOwnership / asset.vehicleOdometer;
      }

      return NextResponse.json({
        ...asset,
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
}

// PUT /api/assets/:id - Update an asset
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const body = await request.json();

      // Verify ownership
      const existing = await prisma.asset.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

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

      // Check if value changed - record in history
      const valueChanged = currentValue && currentValue !== existing.currentValue;

      const asset = await prisma.asset.update({
        where: { id },
        data: {
          name,
          type,
          status,
          description,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          currentValue: currentValue ? parseFloat(currentValue) : undefined,
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

      return NextResponse.json(asset);
    } catch (error) {
      console.error('Update asset error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/assets/:id - Delete an asset
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;

      // Verify ownership
      const existing = await prisma.asset.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
      }

      // Delete the asset (cascades to value history and service records)
      await prisma.asset.delete({
        where: { id },
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
}
