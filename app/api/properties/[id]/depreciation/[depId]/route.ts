import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership } from '@/lib/utils/ownership';
import { notFound } from '@/lib/utils/api-response';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string; depId: string }> };

const updateDepreciationSchema = z.object({
  category: z.enum(['DIV40', 'DIV43']).optional(),
  assetName: z.string().min(1).optional(),
  cost: z.number().positive().optional(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  rate: z.number().positive().max(100).optional(),
  method: z.enum(['PRIME_COST', 'DIMINISHING_VALUE']).optional(),
  notes: z.string().nullable().optional(),
});

export const GET = withPermission<RouteContext>('property.read', async (request, auth, context) => {
    try {
      const { id: propertyId, depId } = await context!.params;

      // Verify property ownership
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });

      const propertyResult = verifyOwnership(property, auth.userId, 'Property');
      if (!propertyResult.success) return propertyResult.response;

      const schedule = await prisma.depreciationSchedule.findUnique({
        where: { id: depId },
      });

      if (!schedule || schedule.propertyId !== propertyId) {
        return notFound('Depreciation schedule');
      }

      return NextResponse.json(schedule);
    } catch (error) {
      console.error('Get depreciation schedule error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const PUT = withPermission<RouteContext>('property.write', async (request, auth, context) => {
    try {
      const { id: propertyId, depId } = await context!.params;
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

      const propertyResult = verifyOwnership(property, auth.userId, 'Property');
      if (!propertyResult.success) return propertyResult.response;

      // Verify schedule exists and belongs to property
      const existing = await prisma.depreciationSchedule.findUnique({
        where: { id: depId },
      });

      if (!existing || existing.propertyId !== propertyId) {
        return notFound('Depreciation schedule');
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

export const DELETE = withPermission<RouteContext>('property.delete', async (request, auth, context) => {
    try {
      const { id: propertyId, depId } = await context!.params;

      // Verify property ownership
      const property = await prisma.property.findUnique({
        where: { id: propertyId },
      });

      const propertyResult = verifyOwnership(property, auth.userId, 'Property');
      if (!propertyResult.success) return propertyResult.response;

      // Verify schedule exists and belongs to property
      const existing = await prisma.depreciationSchedule.findUnique({
        where: { id: depId },
      });

      if (!existing || existing.propertyId !== propertyId) {
        return notFound('Depreciation schedule');
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
