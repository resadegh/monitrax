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
      const income = await prisma.income.findUnique({
        where: { id },
        include: {
          property: true,
          investmentAccount: true,
        },
      });

      // Verify ownership using centralized utility
      const result = verifyOwnership(income, authReq.user!.userId, 'Income');
      if (!result.success) return result.response;

      return NextResponse.json(result.resource);
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
      const existing = await prisma.income.findUnique({ where: { id } });
      const ownershipResult = verifyOwnership(existing, authReq.user!.userId, 'Income');
      if (!ownershipResult.success) return ownershipResult.response;

      // Validate ownership of related entities
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, authReq.user!.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (investmentAccountId) {
        const investmentAccount = await prisma.investmentAccount.findUnique({ where: { id: investmentAccountId } });
        const result = verifyRelatedOwnership(investmentAccount, authReq.user!.userId, 'Investment account');
        if (!result.success) return result.response;
      }

      // Helper to safely convert to number (returns undefined if not provided, null if explicitly null)
      const toNumber = (val: unknown): number | null | undefined => {
        if (val === undefined) return undefined; // Not provided - don't update
        if (val === null) return null; // Explicitly null - set to null
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      };

      // Helper to convert Frequency enum to PayFrequency enum (ANNUAL -> ANNUALLY)
      // PayFrequency values: WEEKLY, FORTNIGHTLY, MONTHLY, QUARTERLY, ANNUALLY
      const toPayFrequency = (freq: string | undefined | null): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | null | undefined => {
        if (freq === undefined) return undefined;
        if (freq === null) return null;
        // Map ANNUAL to ANNUALLY (Frequency uses ANNUAL, PayFrequency uses ANNUALLY)
        const mapped = freq === 'ANNUAL' ? 'ANNUALLY' : freq;
        // Validate it's a valid PayFrequency value
        const validPayFrequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'] as const;
        if (validPayFrequencies.includes(mapped as typeof validPayFrequencies[number])) {
          return mapped as typeof validPayFrequencies[number];
        }
        return null;
      };

      // Determine the correct payFrequency value
      const resolvedPayFrequency = type === 'SALARY'
        ? toPayFrequency(payFrequency)
        : null;

      const income = await prisma.income.update({
        where: { id },
        data: {
          name,
          type,
          amount: toNumber(amount) ?? ownershipResult.resource.amount,
          frequency,
          isTaxable,
          propertyId: propertyId !== undefined ? propertyId : undefined,
          investmentAccountId: investmentAccountId !== undefined ? investmentAccountId : undefined,
          sourceType: sourceType !== undefined ? sourceType : undefined,
          // Phase 20: Salary-specific fields
          salaryType: type === 'SALARY' ? salaryType : null,
          payFrequency: resolvedPayFrequency,
          grossAmount: toNumber(grossAmount),
          netAmount: toNumber(netAmount),
          paygWithholding: toNumber(paygWithholding),
          superGuaranteeRate: toNumber(superGuaranteeRate),
          superGuaranteeAmount: toNumber(superGuaranteeAmount),
          salarySacrifice: toNumber(salarySacrifice),
          // Phase 20: Investment-specific fields
          frankingPercentage: toNumber(frankingPercentage),
          frankingCredits: toNumber(frankingCredits),
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

      // Verify ownership using centralized utility
      const existing = await prisma.income.findUnique({ where: { id } });
      const result = verifyOwnership(existing, authReq.user!.userId, 'Income');
      if (!result.success) return result.response;

      await prisma.income.delete({ where: { id } });

      return NextResponse.json({ message: 'Income deleted successfully' });
    } catch (error) {
      console.error('Delete income error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
