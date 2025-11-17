import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const { name, type, amount, frequency, isTaxable } = body;

      // Verify ownership
      const existing = await prisma.income.findUnique({
        where: { id: params.id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Income not found' }, { status: 404 });
      }

      const income = await prisma.income.update({
        where: { id: params.id },
        data: {
          name,
          type,
          amount,
          frequency,
          isTaxable,
        },
      });

      return NextResponse.json(income);
    } catch (error) {
      console.error('Update income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (authReq) => {
    try {
      // Verify ownership
      const existing = await prisma.income.findUnique({
        where: { id: params.id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Income not found' }, { status: 404 });
      }

      await prisma.income.delete({
        where: { id: params.id },
      });

      return NextResponse.json({ message: 'Income deleted successfully' });
    } catch (error) {
      console.error('Delete income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
