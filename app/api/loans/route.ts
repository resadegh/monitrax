import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const loans = await prisma.loan.findMany({
        where: { userId: authReq.user!.userId },
        include: {
          property: true,
          offsetAccount: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ loans });
    } catch (error) {
      console.error('Get loans error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const {
        name,
        type,
        propertyId,
        offsetAccountId,
        principal,
        interestRateAnnual,
        rateType,
        fixedExpiry,
        isInterestOnly,
        termMonthsRemaining,
        minRepayment,
        repaymentFrequency,
        extraRepaymentCap,
      } = body;

      if (
        !name ||
        !type ||
        principal === undefined ||
        interestRateAnnual === undefined ||
        !rateType ||
        !termMonthsRemaining ||
        !minRepayment ||
        !repaymentFrequency
      ) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      const loan = await prisma.loan.create({
        data: {
          userId: authReq.user!.userId,
          name,
          type,
          propertyId: propertyId || null,
          offsetAccountId: offsetAccountId || null,
          principal: parseFloat(principal),
          interestRateAnnual: parseFloat(interestRateAnnual),
          rateType,
          fixedExpiry: fixedExpiry ? new Date(fixedExpiry) : null,
          isInterestOnly: Boolean(isInterestOnly),
          termMonthsRemaining: parseInt(termMonthsRemaining),
          minRepayment: parseFloat(minRepayment),
          repaymentFrequency,
          extraRepaymentCap: extraRepaymentCap ? parseFloat(extraRepaymentCap) : null,
        },
      });

      return NextResponse.json({ loan }, { status: 201 });
    } catch (error) {
      console.error('Create loan error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
