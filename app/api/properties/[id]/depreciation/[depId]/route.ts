import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { z } from 'zod';

const updateDepreciationSchema = z.object({
  category: z.enum(['DIV40', 'DIV43']).optional(),
  assetName: z.string().min(1).optional(),
  cost: z.number().positive().optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  rate: z.number().positive().max(100).optional(),
  method: z.enum(['PRIME_COST', 'DIMINISHING_VALUE']).optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: propertyId, depId } = await params;

      // Verify property ownership
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });

      if (!property || property.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      const schedule = await prisma.depreciationSchedule.findUnique({
        where: { id: depId },
      });

      if (!schedule || schedule.propertyId !== propertyId) {
        return NextResponse.json({ error: 'Depreciation schedule not found' }, { status: 404 });
      }

      return NextResponse.json(schedule);
    } catch (error) {
      console.error('Get depreciation schedule error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: propertyId, depId } = await params;
      const body = await request.json();
      const validation = updateDepreciationSchema.safeParse(body);

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

      // Verify schedule exists and belongs to property
      const existing = await prisma.depreciationSchedule.findUnique({
        where: { id: depId },
      });

      if (!existing || existing.propertyId !== propertyId) {
        return NextResponse.json({ error: 'Depreciation schedule not found' }, { status: 404 });
      }

      const { category, assetName, cost, startDate, rate, method, notes } = validation.data;

      const schedule = await prisma.depreciationSchedule.update({
        where: { id: depId },
        data: {
          ...(category !== undefined && { category }),
          ...(assetName !== undefined && { assetName }),
          ...(cost !== undefined && { cost }),
          ...(startDate !== undefined && { startDate: new Date(startDate) }),
          ...(rate !== undefined && { rate }),
          ...(method !== undefined && { method }),
          ...(notes !== undefined && { notes }),
        },
      });

      return NextResponse.json(schedule);
    } catch (error) {
      console.error('Update depreciation schedule error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; depId: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id: propertyId, depId } = await params;

      // Verify property ownership
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });

      if (!property || property.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }

      // Verify schedule exists and belongs to property
      const existing = await prisma.depreciationSchedule.findUnique({
        where: { id: depId },
      });

      if (!existing || existing.propertyId !== propertyId) {
        return NextResponse.json({ error: 'Depreciation schedule not found' }, { status: 404 });
      }

      await prisma.depreciationSchedule.delete({
        where: { id: depId },
      });

      return NextResponse.json({ message: 'Depreciation schedule deleted successfully' });
    } catch (error) {
      console.error('Delete depreciation schedule error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
