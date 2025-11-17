import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const properties = await prisma.property.findMany({
        where: { userId: authReq.user!.userId },
        include: {
          loans: true,
          income: true,
          expenses: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ properties });
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

      return NextResponse.json({ property }, { status: 201 });
    } catch (error) {
      console.error('Create property error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
