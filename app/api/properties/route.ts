import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { extractPropertyLinks, wrapWithGRDCS } from '@/lib/grdcs';

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
        // Location fields (Google Maps)
        latitude,
        longitude,
        googlePlaceId,
        suburb,
        state,
        postcode,
      } = body;

      if (!name || !type || !purchasePrice || !purchaseDate || !currentValue || !valuationDate) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const property = await prisma.property.create({
        data: {
          userId: auth.userId,
          name,
          type,
          address,
          purchasePrice: parseFloat(purchasePrice),
          purchaseDate: new Date(purchaseDate),
          currentValue: parseFloat(currentValue),
          valuationDate: new Date(valuationDate),
          // Location data
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          googlePlaceId: googlePlaceId || null,
          suburb: suburb || null,
          state: state || null,
          postcode: postcode || null,
        },
      });

      return NextResponse.json(property, { status: 201 });
    } catch (error) {
      console.error('Create property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
