import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const income = await prisma.income.findMany({
        where: { userId: authReq.user!.userId },
        include: { property: true, investmentAccount: true },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(income);
    } catch (error) {
      console.error('Get income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const { name, type, amount, frequency, isTaxable, propertyId, investmentAccountId, sourceType } = body;

      if (!name || !type || amount === undefined || !frequency) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Validate ownership of related entities
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        if (!property || property.userId !== authReq.user!.userId) {
          return NextResponse.json({ error: 'Property not found or unauthorized' }, { status: 403 });
        }
      }

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        if (!investmentAccount || investmentAccount.userId !== authReq.user!.userId) {
          return NextResponse.json({ error: 'Investment account not found or unauthorized' }, { status: 403 });
        }
      }

      const incomeRecord = await prisma.income.create({
        data: {
          userId: authReq.user!.userId,
          name,
          type,
          amount: parseFloat(amount),
          frequency,
          isTaxable: isTaxable !== undefined ? Boolean(isTaxable) : true,
          propertyId: propertyId || null,
          investmentAccountId: investmentAccountId || null,
          sourceType: sourceType || 'GENERAL',
        },
        include: { property: true, investmentAccount: true },
      });

      return NextResponse.json(incomeRecord, { status: 201 });
    } catch (error) {
      console.error('Create income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
