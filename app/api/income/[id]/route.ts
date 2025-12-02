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
      const income = await prisma.income.findUnique({
        where: { id },
        include: {
          property: true,
          investmentAccount: true,
        },
      });

      if (!income || income.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Income not found' }, { status: 404 });
      }

      return NextResponse.json(income);
    } catch (error) {
      console.error('Get income error:', error);
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

      // Verify ownership
      const existing = await prisma.income.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Income not found' }, { status: 404 });
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

      const income = await prisma.income.update({
        where: { id },
        data: {
          name,
          type,
          amount,
          frequency,
          isTaxable,
          propertyId: propertyId !== undefined ? propertyId : undefined,
          investmentAccountId: investmentAccountId !== undefined ? investmentAccountId : undefined,
          sourceType: sourceType !== undefined ? sourceType : undefined,
          // Phase 20: Salary-specific fields
          salaryType: type === 'SALARY' ? salaryType : null,
          payFrequency: type === 'SALARY' ? payFrequency : null,
          grossAmount: grossAmount !== undefined ? (grossAmount ? parseFloat(grossAmount) : null) : undefined,
          netAmount: netAmount !== undefined ? (netAmount ? parseFloat(netAmount) : null) : undefined,
          paygWithholding: paygWithholding !== undefined ? (paygWithholding ? parseFloat(paygWithholding) : null) : undefined,
          superGuaranteeRate: superGuaranteeRate !== undefined ? (superGuaranteeRate ? parseFloat(superGuaranteeRate) : null) : undefined,
          superGuaranteeAmount: superGuaranteeAmount !== undefined ? (superGuaranteeAmount ? parseFloat(superGuaranteeAmount) : null) : undefined,
          salarySacrifice: salarySacrifice !== undefined ? (salarySacrifice ? parseFloat(salarySacrifice) : null) : undefined,
          // Phase 20: Investment-specific fields
          frankingPercentage: frankingPercentage !== undefined ? (frankingPercentage ? parseFloat(frankingPercentage) : null) : undefined,
          frankingCredits: frankingCredits !== undefined ? (frankingCredits ? parseFloat(frankingCredits) : null) : undefined,
        },
        include: {
          property: true,
          investmentAccount: true,
        },
      });

      return NextResponse.json(income);
    } catch (error) {
      console.error('Update income error:', error);
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
      const existing = await prisma.income.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Income not found' }, { status: 404 });
      }

      await prisma.income.delete({
        where: { id },
      });

      return NextResponse.json({ message: 'Income deleted successfully' });
    } catch (error) {
      console.error('Delete income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
