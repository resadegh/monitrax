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
      const expense = await prisma.expense.findUnique({
        where: { id },
        include: {
          property: true,
          loan: true,
          investmentAccount: true,
          asset: true,
        },
      });

      if (!expense || expense.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }

      return NextResponse.json(expense);
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
      const { name, category, amount, frequency, isEssential, isTaxDeductible, propertyId, loanId, investmentAccountId, assetId, vendorName, sourceType } = body;

      // Verify ownership
      const existing = await prisma.expense.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
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

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        if (!investmentAccount || investmentAccount.userId !== authReq.user!.userId) {
          return NextResponse.json({ error: 'Investment account not found or unauthorized' }, { status: 403 });
        }
      }

      // Phase 21: Validate asset ownership
      if (assetId) {
        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset || asset.userId !== authReq.user!.userId) {
          return NextResponse.json({ error: 'Asset not found or unauthorized' }, { status: 403 });
        }
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
      // Verify ownership
      const existing = await prisma.expense.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }

      await prisma.expense.delete({
        where: { id },
      });

      return NextResponse.json({ message: 'Expense deleted successfully' });
    } catch (error) {
      console.error('Delete expense error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
