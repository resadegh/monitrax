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
      const { name, category, amount, frequency, isEssential } = body;

      // Verify ownership
      const existing = await prisma.expense.findUnique({
        where: { id: params.id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }

      const expense = await prisma.expense.update({
        where: { id: params.id },
        data: {
          name,
          category,
          amount,
          frequency,
          isEssential,
        },
      });

      return NextResponse.json(expense);
    } catch (error) {
      console.error('Update expense error:', error);
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
      const existing = await prisma.expense.findUnique({
        where: { id: params.id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }

      await prisma.expense.delete({
        where: { id: params.id },
      });

      return NextResponse.json({ message: 'Expense deleted successfully' });
    } catch (error) {
      console.error('Delete expense error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
