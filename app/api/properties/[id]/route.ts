import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const { name, type, address, purchasePrice, purchaseDate, currentValue, valuationDate } = body;

      // Verify ownership
      const existing = await prisma.property.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

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

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

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
