import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { verifyOwnership, verifyRelatedOwnership } from '@/lib/utils/ownership';

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
          linkedAsset: true,      // For CAR loans
          linkedAccount: true,    // For LINE_OF_CREDIT
          expenses: true,
        },
      });

      const ownershipResult = verifyOwnership(loan, authReq.user!.userId, 'Loan');
      if (!ownershipResult.success) return ownershipResult.response;

      return NextResponse.json(ownershipResult.resource);
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
        linkedAssetId,
        linkedAccountId,
      } = body;

      // Verify ownership
      const existing = await prisma.loan.findUnique({
        where: { id },
      });

      const ownershipResult = verifyOwnership(existing, authReq.user!.userId, 'Loan');
      if (!ownershipResult.success) return ownershipResult.response;

      // Validate ownership of related entities
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
          linkedAssetId,
          linkedAccountId,
        },
        include: {
          property: true,
          offsetAccount: true,
          linkedAsset: true,
          linkedAccount: true,
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

      const ownershipResult = verifyOwnership(existing, authReq.user!.userId, 'Loan');
      if (!ownershipResult.success) return ownershipResult.response;

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
