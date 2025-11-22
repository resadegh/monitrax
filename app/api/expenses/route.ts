import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const expenses = await prisma.expense.findMany({
        where: { userId: authReq.user!.userId },
        include: { property: true, loan: true },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(expenses);
    } catch (error) {
      console.error('Get expenses error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const { name, category, amount, frequency, isTaxDeductible, propertyId, loanId } = body;

      if (!name || !category || amount === undefined || !frequency) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Validate ownership of related entities
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        if (!property || property.userId !== authReq.user!.userId) {
          return NextResponse.json({ error: 'Property not found or unauthorized' }, { status: 403 });
        }
      }

      if (loanId) {
        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        if (!loan || loan.userId !== authReq.user!.userId) {
          return NextResponse.json({ error: 'Loan not found or unauthorized' }, { status: 403 });
        }
      }

      const expense = await prisma.expense.create({
        data: {
          userId: authReq.user!.userId,
          name,
          category,
          amount: parseFloat(amount),
          frequency,
          isTaxDeductible: isTaxDeductible !== undefined ? Boolean(isTaxDeductible) : false,
          propertyId: propertyId || null,
          loanId: loanId || null,
        },
      });

      return NextResponse.json(expense, { status: 201 });
    } catch (error) {
      console.error('Create expense error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
