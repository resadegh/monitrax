import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { verifyOwnership } from '@/lib/utils/ownership';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const property = await prisma.property.findUnique({
        where: { id },
        include: {
          loans: true,
          income: true,
          expenses: true,
        },
      });

      const ownershipResult = verifyOwnership(property, authReq.user!.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      return NextResponse.json(ownershipResult.resource);
    } catch (error) {
      console.error('Get property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const {
        name,
        type,
        address,
        purchasePrice,
        purchaseDate,
        currentValue,
        valuationDate,
        // Location fields (Google Maps)
        latitude,
        longitude,
        googlePlaceId,
        suburb,
        state,
        postcode,
      } = body;

      // Verify ownership
      const existing = await prisma.property.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, authReq.user!.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      const property = await prisma.property.update({
        where: { id },
        data: {
          name,
          type,
          address,
          purchasePrice,
          purchaseDate: new Date(purchaseDate),
          currentValue,
          valuationDate: new Date(valuationDate),
          // Location data
          latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : undefined,
          longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : undefined,
          googlePlaceId: googlePlaceId !== undefined ? (googlePlaceId || null) : undefined,
          suburb: suburb !== undefined ? (suburb || null) : undefined,
          state: state !== undefined ? (state || null) : undefined,
          postcode: postcode !== undefined ? (postcode || null) : undefined,
        },
      });

      return NextResponse.json(property);
    } catch (error) {
      console.error('Update property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      // Verify ownership
      const existing = await prisma.property.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, authReq.user!.userId, 'Property');
      if (!ownershipResult.success) return ownershipResult.response;

      await prisma.property.delete({
        where: { id },
      });

      return NextResponse.json({ message: 'Property deleted successfully' });
    } catch (error) {
      console.error('Delete property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
