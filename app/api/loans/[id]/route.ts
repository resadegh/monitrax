import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const loan = await prisma.loan.findUnique({
        where: { id },
        include: {
          property: true,
          offsetAccount: true,
          expenses: true,
        },
      });

      if (!loan || loan.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }

      return NextResponse.json(loan);
    } catch (error) {
      console.error('Get loan error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const {
        name,
        type,
        principal,
        interestRateAnnual,
        rateType,
        fixedExpiry,
        isInterestOnly,
        termMonthsRemaining,
        minRepayment,
        repaymentFrequency,
        extraRepaymentCap,
        propertyId,
        offsetAccountId,
      } = body;

      // Verify ownership
      const existing = await prisma.loan.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }

      // Validate ownership of related entities
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        if (!property || property.userId !== authReq.user!.userId) {
          return NextResponse.json({ error: 'Property not found or unauthorized' }, { status: 403 });
        }
      }

      if (offsetAccountId) {
        const account = await prisma.account.findUnique({ where: { id: offsetAccountId } });
        if (!account || account.userId !== authReq.user!.userId) {
          return NextResponse.json({ error: 'Account not found or unauthorized' }, { status: 403 });
        }
      }

      const loan = await prisma.loan.update({
        where: { id },
        data: {
          name,
          type,
          principal,
          interestRateAnnual,
          rateType,
          fixedExpiry: fixedExpiry ? new Date(fixedExpiry) : null,
          isInterestOnly,
          termMonthsRemaining,
          minRepayment,
          repaymentFrequency,
          extraRepaymentCap: extraRepaymentCap !== undefined ? extraRepaymentCap : undefined,
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
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      // Verify ownership
      const existing = await prisma.loan.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      }

      await prisma.loan.delete({
        where: { id },
      });

      return NextResponse.json({ message: 'Loan deleted successfully' });
    } catch (error) {
      console.error('Delete loan error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
