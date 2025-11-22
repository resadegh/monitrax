import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';

const createDepreciationSchema = z.object({
  category: z.enum(['DIV40', 'DIV43']),
  assetName: z.string().min(1, 'Asset name is required'),
  cost: z.number().positive('Cost must be positive'),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  rate: z.number().positive('Rate must be positive').max(100, 'Rate cannot exceed 100%'),
  method: z.enum(['PRIME_COST', 'DIMINISHING_VALUE']),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: propertyId } = await params;

      // Verify property ownership
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });

      if (!property || property.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      const schedules = await prisma.depreciationSchedule.findMany({
        where: { propertyId },
        orderBy: { startDate: 'desc' },
      });

      return NextResponse.json(schedules);
    } catch (error) {
      console.error('Get depreciation schedules error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: propertyId } = await params;
      const body = await request.json();
      const validation = createDepreciationSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.errors },
          { status: 400 }
        );
      }

      // Verify property ownership
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });

      if (!property || property.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      const { category, assetName, cost, startDate, rate, method, notes } = validation.data;

      const schedule = await prisma.depreciationSchedule.create({
        data: {
          propertyId,
          category,
          assetName,
          cost,
          startDate: new Date(startDate),
          rate,
          method,
          notes: notes ?? null,
        },
      });

      return NextResponse.json(schedule, { status: 201 });
    } catch (error) {
      console.error('Create depreciation schedule error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
