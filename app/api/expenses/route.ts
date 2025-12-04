import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { extractExpenseLinks, wrapWithGRDCS } from '@/lib/grdcs';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const expenses = await prisma.expense.findMany({
        where: { userId: authReq.user!.userId },
        include: { property: true, loan: true, investmentAccount: true, asset: true },
        orderBy: { createdAt: 'desc' },
      });

      // Apply GRDCS wrapper to each expense
      const expensesWithLinks = expenses.map((expense: typeof expenses[number]) => {
        const links = extractExpenseLinks(expense);
        return wrapWithGRDCS(expense as Record<string, unknown>, 'expense', links);
      });

      return NextResponse.json({
        data: expensesWithLinks,
        _meta: {
          count: expensesWithLinks.length,
          totalLinkedEntities: expensesWithLinks.reduce((sum: number, e: { _meta: { linkedCount: number } }) => sum + e._meta.linkedCount, 0),
        },
      });
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
      const { name, category, amount, frequency, isTaxDeductible, isEssential, propertyId, loanId, investmentAccountId, assetId, vendorName, sourceType } = body;

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

      const expense = await prisma.expense.create({
        data: {
          userId: authReq.user!.userId,
          name,
          category,
          amount: parseFloat(amount),
          frequency,
          isTaxDeductible: isTaxDeductible !== undefined ? Boolean(isTaxDeductible) : false,
          isEssential: isEssential !== undefined ? Boolean(isEssential) : true,
          propertyId: propertyId || null,
          loanId: loanId || null,
          investmentAccountId: investmentAccountId || null,
          assetId: assetId || null,
          vendorName: vendorName || null,
          sourceType: sourceType || 'GENERAL',
        },
        include: { property: true, loan: true, investmentAccount: true, asset: true },
      });

      return NextResponse.json(expense, { status: 201 });
    } catch (error) {
      console.error('Create expense error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
