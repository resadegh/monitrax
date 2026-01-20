import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { verifyRelatedOwnership } from '@/lib/utils/ownership';
import { extractLoanLinks, wrapWithGRDCS } from '@/lib/grdcs';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const loans = await prisma.loan.findMany({
        where: { userId: authReq.user!.userId },
        include: {
          property: true,
          offsetAccount: true,
          linkedAsset: true,      // For CAR loans
          linkedAccount: true,    // For LINE_OF_CREDIT
          expenses: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Apply GRDCS wrapper to each loan
      const loansWithLinks = loans.map((loan: typeof loans[number]) => {
        const links = extractLoanLinks(loan);
        return wrapWithGRDCS(loan as Record<string, unknown>, 'loan', links);
      });

      return NextResponse.json({
        data: loansWithLinks,
        _meta: {
          count: loansWithLinks.length,
          totalLinkedEntities: loansWithLinks.reduce((sum: number, l: { _meta: { linkedCount: number } }) => sum + l._meta.linkedCount, 0),
        },
      });
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
        linkedAssetId,
        linkedAccountId,
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

      // Validate ownership of related entities using centralized utility
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, authReq.user!.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (offsetAccountId) {
        const account = await prisma.account.findUnique({ where: { id: offsetAccountId } });
        const result = verifyRelatedOwnership(account, authReq.user!.userId, 'Offset account');
        if (!result.success) return result.response;
      }

      // Validate linked asset (for CAR loans)
      if (linkedAssetId) {
        const asset = await prisma.asset.findUnique({ where: { id: linkedAssetId } });
        const result = verifyRelatedOwnership(asset, authReq.user!.userId, 'Asset');
        if (!result.success) return result.response;
      }

      // Validate linked account (for LINE_OF_CREDIT)
      if (linkedAccountId) {
        const account = await prisma.account.findUnique({ where: { id: linkedAccountId } });
        const result = verifyRelatedOwnership(account, authReq.user!.userId, 'Linked account');
        if (!result.success) return result.response;
      }

      const loan = await prisma.loan.create({
        data: {
          userId: authReq.user!.userId,
          name,
          type,
          propertyId: propertyId || null,
          offsetAccountId: offsetAccountId || null,
          linkedAssetId: linkedAssetId || null,
          linkedAccountId: linkedAccountId || null,
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

      return NextResponse.json(loan, { status: 201 });
    } catch (error) {
      console.error('Create loan error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
