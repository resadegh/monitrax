import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyOwnership, verifyRelatedOwnership } from '@/lib/utils/ownership';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('expense.read', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
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
      const result = verifyOwnership(expense, auth.userId, 'Expense');
      if (!result.success) return result.response;

      return NextResponse.json(result.resource);
    } catch (error) {
      console.error('Get expense error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const PUT = withPermission<RouteContext>('expense.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const body = await request.json();
      const { name, category, amount, frequency, isEssential, isTaxDeductible, isRecurring, propertyId, loanId, investmentAccountId, assetId, vendorName, sourceType } = body;

      // Verify ownership of expense
      const existing = await prisma.expense.findUnique({ where: { id } });
      const ownershipResult = verifyOwnership(existing, auth.userId, 'Expense');
      if (!ownershipResult.success) return ownershipResult.response;

      // Validate ownership of related entities
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, auth.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (loanId) {
        const loan = await prisma.loan.findUnique({ where: { id: loanId } });
        const result = verifyRelatedOwnership(loan, auth.userId, 'Loan');
        if (!result.success) return result.response;
      }

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        const result = verifyRelatedOwnership(investmentAccount, auth.userId, 'Investment account');
        if (!result.success) return result.response;
      }

      if (assetId) {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        const result = verifyRelatedOwnership(asset, auth.userId, 'Asset');
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

export const DELETE = withPermission<RouteContext>('expense.delete', async (request, auth, context) => {
    try {
      const { id } = await context!.params;

      // Verify ownership using centralized utility
      const existing = await prisma.expense.findUnique({ where: { id } });
      const result = verifyOwnership(existing, auth.userId, 'Expense');
      if (!result.success) return result.response;

      await prisma.expense.delete({ where: { id } });

      return NextResponse.json({ message: 'Expense deleted successfully' });
    } catch (error) {
      console.error('Delete expense error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
