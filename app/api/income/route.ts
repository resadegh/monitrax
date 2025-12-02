import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { extractIncomeLinks, wrapWithGRDCS } from '@/lib/grdcs';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const income = await prisma.income.findMany({
        where: { userId: authReq.user!.userId },
        include: { property: true, investmentAccount: true },
        orderBy: { createdAt: 'desc' },
      });

      // Apply GRDCS wrapper to each income
      const incomeWithLinks = income.map((inc: typeof income[number]) => {
        const links = extractIncomeLinks(inc);
        return wrapWithGRDCS(inc as Record<string, unknown>, 'income', links);
      });

      return NextResponse.json({
        data: incomeWithLinks,
        _meta: {
          count: incomeWithLinks.length,
          totalLinkedEntities: incomeWithLinks.reduce((sum: number, i: { _meta: { linkedCount: number } }) => sum + i._meta.linkedCount, 0),
        },
      });
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
      const {
        name,
        type,
        amount,
        frequency,
        isTaxable,
        propertyId,
        investmentAccountId,
        sourceType,
        // Phase 20: Salary-specific fields
        salaryType,
        payFrequency,
        grossAmount,
        netAmount,
        paygWithholding,
        superGuaranteeRate,
        superGuaranteeAmount,
        salarySacrifice,
        // Phase 20: Investment-specific fields
        frankingPercentage,
        frankingCredits,
      } = body;

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
          // Phase 20: Salary-specific fields
          salaryType: type === 'SALARY' ? salaryType : null,
          payFrequency: type === 'SALARY' ? payFrequency : null,
          grossAmount: grossAmount ? parseFloat(grossAmount) : null,
          netAmount: netAmount ? parseFloat(netAmount) : null,
          paygWithholding: paygWithholding ? parseFloat(paygWithholding) : null,
          superGuaranteeRate: superGuaranteeRate ? parseFloat(superGuaranteeRate) : null,
          superGuaranteeAmount: superGuaranteeAmount ? parseFloat(superGuaranteeAmount) : null,
          salarySacrifice: salarySacrifice ? parseFloat(salarySacrifice) : null,
          // Phase 20: Investment-specific fields
          frankingPercentage: frankingPercentage ? parseFloat(frankingPercentage) : null,
          frankingCredits: frankingCredits ? parseFloat(frankingCredits) : null,
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
