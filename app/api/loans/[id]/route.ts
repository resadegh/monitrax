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
      const {
        name,
        type,
        principal,
        interestRateAnnual,
        rateType,
        isInterestOnly,
        termMonthsRemaining,
        minRepayment,
        repaymentFrequency,
        propertyId,
        offsetAccountId,
      } = body;

      // Verify ownership
      const existing = await prisma.loan.findUnique({
        where: { id: params.id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }

      const loan = await prisma.loan.update({
        where: { id: params.id },
        data: {
          name,
          type,
          principal,
          interestRateAnnual,
          rateType,
          isInterestOnly,
          termMonthsRemaining,
          minRepayment,
          repaymentFrequency,
          propertyId,
          offsetAccountId,
        },
        include: {
          property: true,
          offsetAccount: true,
        },
      });

      return NextResponse.json(loan);
    } catch (error) {
      console.error('Update loan error:', error);
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
      const existing = await prisma.loan.findUnique({
        where: { id: params.id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }

      await prisma.loan.delete({
        where: { id: params.id },
      });

      return NextResponse.json({ message: 'Loan deleted successfully' });
    } catch (error) {
      console.error('Delete loan error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
