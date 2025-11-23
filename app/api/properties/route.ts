import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { extractPropertyLinks, wrapWithGRDCS } from '@/lib/grdcs';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const properties = await prisma.property.findMany({
        where: { userId: authReq.user!.userId },
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
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
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
      } = body;

      if (!name || !type || !purchasePrice || !purchaseDate || !currentValue || !valuationDate) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const property = await prisma.property.create({
        data: {
          userId: authReq.user!.userId,
          name,
          type,
          address,
          purchasePrice: parseFloat(purchasePrice),
          purchaseDate: new Date(purchaseDate),
          currentValue: parseFloat(currentValue),
          valuationDate: new Date(valuationDate),
        },
      });

      return NextResponse.json(property, { status: 201 });
    } catch (error) {
      console.error('Create property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
