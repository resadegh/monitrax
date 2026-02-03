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
      const expense = await prisma.expense.findUnique({
        where: { id },
        include: {
          property: true,
          loan: true,
          investmentAccount: true,
          asset: true,
        },
      });

      // Verify ownership using centralized utility
      const result = verifyOwnership(expense, authReq.user!.userId, 'Expense');
      if (!result.success) return result.response;

      return NextResponse.json(result.resource);
    } catch (error) {
      console.error('Get expense error:', error);
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
      const { name, category, amount, frequency, isEssential, isTaxDeductible, isRecurring, propertyId, loanId, investmentAccountId, assetId, vendorName, sourceType } = body;

      // Verify ownership of expense
      const existing = await prisma.expense.findUnique({ where: { id } });
      const ownershipResult = verifyOwnership(existing, authReq.user!.userId, 'Expense');
      if (!ownershipResult.success) return ownershipResult.response;

      // Validate ownership of related entities
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, authReq.user!.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (loanId) {
        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        const result = verifyRelatedOwnership(loan, authReq.user!.userId, 'Loan');
        if (!result.success) return result.response;
      }

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        const result = verifyRelatedOwnership(investmentAccount, authReq.user!.userId, 'Investment account');
        if (!result.success) return result.response;
      }

      if (assetId) {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        const result = verifyRelatedOwnership(asset, authReq.user!.userId, 'Asset');
        if (!result.success) return result.response;
      }

      const expense = await prisma.expense.update({
        where: { id },
        data: {
          name,
          category,
          amount,
          frequency,
          isEssential,
          isTaxDeductible,
          isRecurring: isRecurring !== undefined ? isRecurring : undefined,
          propertyId: propertyId !== undefined ? propertyId : undefined,
          loanId: loanId !== undefined ? loanId : undefined,
          investmentAccountId: investmentAccountId !== undefined ? investmentAccountId : undefined,
          assetId: assetId !== undefined ? assetId : undefined,
          vendorName: vendorName !== undefined ? vendorName : undefined,
          sourceType: sourceType !== undefined ? sourceType : undefined,
        },
        include: {
          property: true,
          loan: true,
          investmentAccount: true,
          asset: true,
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
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;

      // Verify ownership using centralized utility
      const existing = await prisma.expense.findUnique({ where: { id } });
      const result = verifyOwnership(existing, authReq.user!.userId, 'Expense');
      if (!result.success) return result.response;

      await prisma.expense.delete({ where: { id } });

      return NextResponse.json({ message: 'Expense deleted successfully' });
    } catch (error) {
      console.error('Delete expense error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
