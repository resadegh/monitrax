/**
 * Phase 20: Super Contributions API
 * GET /api/tax/super/contributions - List contributions
 * POST /api/tax/super/contributions - Add a contribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getCurrentFinancialYear, SuperContributionType } from '@/lib/tax-engine/types';

// Type for contribution with relations
interface ContributionWithRelations {
  id: string;
  type: string;
  amount: number;
  date: Date;
  employerName: string | null;
  notes: string | null;
  superAccount: {
    id: string;
    name: string;
    fundName: string | null;
  };
  income: {
    id: string;
    name: string;
    type: string;
  } | null;
}

// Type for totals accumulator
interface TotalsAccumulator {
  employerSG: number;
  salarySacrifice: number;
  personalDeductible: number;
  personalNonDeductible: number;
  spouse: number;
  governmentCoContrib: number;
  downsizer: number;
  concessional: number;
  nonConcessional: number;
  total: number;
}

/**
 * GET /api/tax/super/contributions - List contributions
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const financialYear = searchParams.get('financialYear') || getCurrentFinancialYear().year;

    // Build query filter
    const whereClause: Record<string, unknown> = {
      financialYear,
      superAccount: {
        userId: user.userId,
      },
    };

    if (accountId) {
      whereClause.superAccountId = accountId;
    }

    const contributions = await prisma.superContribution.findMany({
      where: whereClause,
      include: {
        superAccount: {
          select: {
            id: true,
            name: true,
            fundName: true,
          },
        },
        income: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    }) as ContributionWithRelations[];

    // Calculate totals by type
    const totals = contributions.reduce<TotalsAccumulator>(
      (acc: TotalsAccumulator, c: ContributionWithRelations) => {
        switch (c.type) {
          case SuperContributionType.EMPLOYER_SG:
            acc.employerSG += c.amount;
            acc.concessional += c.amount;
            break;
          case SuperContributionType.SALARY_SACRIFICE:
            acc.salarySacrifice += c.amount;
            acc.concessional += c.amount;
            break;
          case SuperContributionType.PERSONAL_DEDUCTIBLE:
            acc.personalDeductible += c.amount;
            acc.concessional += c.amount;
            break;
          case SuperContributionType.PERSONAL_NON_DEDUCT:
            acc.personalNonDeductible += c.amount;
            acc.nonConcessional += c.amount;
            break;
          case SuperContributionType.SPOUSE:
            acc.spouse += c.amount;
            acc.nonConcessional += c.amount;
            break;
          case SuperContributionType.GOVERNMENT_COCONTRIB:
            acc.governmentCoContrib += c.amount;
            acc.nonConcessional += c.amount;
            break;
          case SuperContributionType.DOWNSIZER:
            acc.downsizer += c.amount;
            // Downsizer doesn't count towards caps
            break;
        }
        acc.total += c.amount;
        return acc;
      },
      {
        employerSG: 0,
        salarySacrifice: 0,
        personalDeductible: 0,
        personalNonDeductible: 0,
        spouse: 0,
        governmentCoContrib: 0,
        downsizer: 0,
        concessional: 0,
        nonConcessional: 0,
        total: 0,
      }
    );

    return NextResponse.json({
      success: true,
      financialYear,
      contributions: contributions.map((c: ContributionWithRelations) => ({
        id: c.id,
        type: c.type,
        amount: c.amount,
        date: c.date,
        employerName: c.employerName,
        notes: c.notes,
        account: c.superAccount,
        linkedIncome: c.income,
      })),
      totals,
    });
  } catch (error) {
    console.error('List contributions error:', error);
    return NextResponse.json(
      { error: 'Failed to list contributions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tax/super/contributions - Add a contribution
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      superAccountId,
      type,
      amount,
      date,
      financialYear,
      employerName,
      incomeId,
      notes,
    } = body;

    // Validate required fields
    if (!superAccountId) {
      return NextResponse.json(
        { error: 'Super account ID is required' },
        { status: 400 }
      );
    }

    if (!type || !Object.values(SuperContributionType).includes(type)) {
      return NextResponse.json(
        { error: 'Valid contribution type is required' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // Verify the super account belongs to the user
    const superAccount = await prisma.superannuationAccount.findFirst({
      where: {
        id: superAccountId,
        userId: user.userId,
      },
    });

    if (!superAccount) {
      return NextResponse.json(
        { error: 'Super account not found' },
        { status: 404 }
      );
    }

    const currentFY = getCurrentFinancialYear();
    const contributionFY = financialYear || currentFY.year;
    const contributionDate = date ? new Date(date) : new Date();

    // Create the contribution
    const contribution = await prisma.superContribution.create({
      data: {
        superAccountId,
        type,
        amount,
        date: contributionDate,
        financialYear: contributionFY,
        employerName,
        incomeId,
        notes,
      },
      include: {
        superAccount: {
          select: {
            id: true,
            name: true,
            fundName: true,
          },
        },
      },
    });

    // Update YTD totals on the super account
    const isConcessional = [
      SuperContributionType.EMPLOYER_SG,
      SuperContributionType.SALARY_SACRIFICE,
      SuperContributionType.PERSONAL_DEDUCTIBLE,
    ].includes(type);

    if (contributionFY === currentFY.year) {
      await prisma.superannuationAccount.update({
        where: { id: superAccountId },
        data: {
          concessionalYTD: isConcessional
            ? { increment: amount }
            : undefined,
          nonConcessionalYTD: !isConcessional && type !== SuperContributionType.DOWNSIZER
            ? { increment: amount }
            : undefined,
          currentBalance: { increment: amount },
          // Update taxable component for concessional (after 15% tax)
          taxableComponent: isConcessional
            ? { increment: amount * 0.85 }
            : undefined,
          // Update tax-free component for non-concessional
          taxFreeComponent: !isConcessional
            ? { increment: amount }
            : undefined,
        },
      });
    }

    return NextResponse.json({
      success: true,
      contribution: {
        id: contribution.id,
        type: contribution.type,
        amount: contribution.amount,
        date: contribution.date,
        financialYear: contribution.financialYear,
        employerName: contribution.employerName,
        notes: contribution.notes,
        account: contribution.superAccount,
      },
    });
  } catch (error) {
    console.error('Create contribution error:', error);
    return NextResponse.json(
      { error: 'Failed to create contribution' },
      { status: 500 }
    );
  }
}
