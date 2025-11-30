/**
 * Phase 20: Superannuation API
 * GET /api/tax/super - Get user's super position
 * POST /api/tax/super - Create a new super account
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TaxEngine } from '@/lib/tax-engine';
import { getCurrentFinancialYear, SuperContributionType } from '@/lib/tax-engine/types';

// Type for super account with contributions
interface SuperAccountWithContributions {
  id: string;
  name: string;
  fundName: string | null;
  memberNumber: string | null;
  currentBalance: number;
  taxableComponent: number;
  taxFreeComponent: number;
  investmentOption: string | null;
  returns1Year: number | null;
  returns5Year: number | null;
  contributions: {
    id: string;
    type: string;
    amount: number;
    date: Date;
    employerName: string | null;
  }[];
}

/**
 * GET /api/tax/super - Get user's superannuation position
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

    const currentFY = getCurrentFinancialYear();

    // Get all super accounts with contributions
    const superAccounts = await prisma.superannuationAccount.findMany({
      where: { userId: user.userId },
      include: {
        contributions: {
          where: { financialYear: currentFY.year },
          orderBy: { date: 'desc' },
        },
      },
    }) as SuperAccountWithContributions[];

    // Calculate totals
    let totalBalance = 0;
    let totalTaxableComponent = 0;
    let totalTaxFreeComponent = 0;
    let totalConcessionalYTD = 0;
    let totalNonConcessionalYTD = 0;
    let totalEmployerSG = 0;
    let totalSalarySacrifice = 0;
    let totalPersonalDeductible = 0;
    let totalPersonalNonDeductible = 0;

    const accountSummaries = superAccounts.map((account: SuperAccountWithContributions) => {
      // Calculate contribution totals from contributions table
      const contributions = account.contributions;
      let accountEmployerSG = 0;
      let accountSalarySacrifice = 0;
      let accountPersonalDeductible = 0;
      let accountPersonalNonDeductible = 0;

      contributions.forEach((c: { type: string; amount: number }) => {
        switch (c.type) {
          case SuperContributionType.EMPLOYER_SG:
            accountEmployerSG += c.amount;
            break;
          case SuperContributionType.SALARY_SACRIFICE:
            accountSalarySacrifice += c.amount;
            break;
          case SuperContributionType.PERSONAL_DEDUCTIBLE:
            accountPersonalDeductible += c.amount;
            break;
          case SuperContributionType.PERSONAL_NON_DEDUCT:
          case SuperContributionType.SPOUSE:
          case SuperContributionType.GOVERNMENT_COCONTRIB:
          case SuperContributionType.DOWNSIZER:
            accountPersonalNonDeductible += c.amount;
            break;
        }
      });

      const accountConcessional = accountEmployerSG + accountSalarySacrifice + accountPersonalDeductible;
      const accountNonConcessional = accountPersonalNonDeductible;

      // Update totals
      totalBalance += account.currentBalance;
      totalTaxableComponent += account.taxableComponent;
      totalTaxFreeComponent += account.taxFreeComponent;
      totalConcessionalYTD += accountConcessional;
      totalNonConcessionalYTD += accountNonConcessional;
      totalEmployerSG += accountEmployerSG;
      totalSalarySacrifice += accountSalarySacrifice;
      totalPersonalDeductible += accountPersonalDeductible;
      totalPersonalNonDeductible += accountPersonalNonDeductible;

      return {
        id: account.id,
        name: account.name,
        fundName: account.fundName,
        memberNumber: account.memberNumber,
        currentBalance: account.currentBalance,
        taxableComponent: account.taxableComponent,
        taxFreeComponent: account.taxFreeComponent,
        investmentOption: account.investmentOption,
        returns1Year: account.returns1Year,
        returns5Year: account.returns5Year,
        contributions: {
          employerSG: accountEmployerSG,
          salarySacrifice: accountSalarySacrifice,
          personalDeductible: accountPersonalDeductible,
          personalNonDeductible: accountPersonalNonDeductible,
          totalConcessional: accountConcessional,
          totalNonConcessional: accountNonConcessional,
        },
        recentContributions: contributions.slice(0, 5).map((c: { id: string; type: string; amount: number; date: Date; employerName: string | null }) => ({
          id: c.id,
          type: c.type,
          amount: c.amount,
          date: c.date,
          employerName: c.employerName,
        })),
      };
    });

    // Get config for caps
    const config = TaxEngine.getCurrentConfig();

    // Track caps
    const capTracking = TaxEngine.trackContributionCaps({
      concessionalYTD: totalConcessionalYTD,
      nonConcessionalYTD: totalNonConcessionalYTD,
      totalSuperBalance: totalBalance,
    }, config);

    // Get salary income to calculate potential optimization
    const salaryIncome = await prisma.income.findFirst({
      where: {
        userId: user.userId,
        type: 'SALARY',
      },
    });

    // Calculate optimization recommendations if salary exists
    let optimizationRecommendations = null;
    if (salaryIncome && salaryIncome.grossAmount) {
      const marginalRate = TaxEngine.getMarginalRate(salaryIncome.grossAmount, config);
      optimizationRecommendations = TaxEngine.getOptimalContributionStrategy(
        salaryIncome.grossAmount,
        totalConcessionalYTD,
        marginalRate,
        totalBalance,
        config
      );
    }

    return NextResponse.json({
      success: true,
      financialYear: currentFY.year,
      summary: {
        totalBalance: Math.round(totalBalance),
        taxableComponent: Math.round(totalTaxableComponent),
        taxFreeComponent: Math.round(totalTaxFreeComponent),
        accountCount: superAccounts.length,
      },
      contributions: {
        currentYear: {
          employerSG: Math.round(totalEmployerSG),
          salarySacrifice: Math.round(totalSalarySacrifice),
          personalDeductible: Math.round(totalPersonalDeductible),
          personalNonDeductible: Math.round(totalPersonalNonDeductible),
          totalConcessional: Math.round(totalConcessionalYTD),
          totalNonConcessional: Math.round(totalNonConcessionalYTD),
          total: Math.round(totalConcessionalYTD + totalNonConcessionalYTD),
        },
      },
      caps: {
        concessional: {
          cap: config.concessionalCap,
          used: Math.round(capTracking.concessional.used),
          remaining: Math.round(capTracking.concessional.remaining),
          percentageUsed: Math.round(capTracking.concessional.percentageUsed),
          carryForwardAvailable: Math.round(capTracking.concessional.carryForwardAvailable),
          isExceeded: capTracking.concessional.isExceeded,
        },
        nonConcessional: {
          cap: config.nonConcessionalCap,
          used: Math.round(capTracking.nonConcessional.used),
          remaining: Math.round(capTracking.nonConcessional.remaining),
          percentageUsed: Math.round(capTracking.nonConcessional.percentageUsed),
          bringForwardAvailable: capTracking.nonConcessional.bringForwardAvailable,
          bringForwardCap: capTracking.nonConcessional.bringForwardCap,
          isExceeded: capTracking.nonConcessional.isExceeded,
        },
      },
      accounts: accountSummaries,
      optimization: optimizationRecommendations,
      warnings: capTracking.warnings,
      config: {
        superGuaranteeRate: config.superGuaranteeRate * 100,
        concessionalCap: config.concessionalCap,
        nonConcessionalCap: config.nonConcessionalCap,
        division293Threshold: config.division293Threshold,
      },
    });
  } catch (error) {
    console.error('Super position error:', error);
    return NextResponse.json(
      { error: 'Failed to get superannuation position' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tax/super - Create a new superannuation account
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
      name,
      fundName,
      memberNumber,
      fundABN,
      currentBalance = 0,
      taxableComponent = 0,
      taxFreeComponent = 0,
      investmentOption,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Account name is required' },
        { status: 400 }
      );
    }

    const currentFY = getCurrentFinancialYear();
    const config = TaxEngine.getCurrentConfig();

    const superAccount = await prisma.superannuationAccount.create({
      data: {
        userId: user.userId,
        name,
        fundName,
        memberNumber,
        fundABN,
        currentBalance,
        taxableComponent,
        taxFreeComponent,
        financialYear: currentFY.year,
        concessionalCap: config.concessionalCap,
        nonConcessionalCap: config.nonConcessionalCap,
        investmentOption,
      },
    });

    return NextResponse.json({
      success: true,
      account: superAccount,
    });
  } catch (error) {
    console.error('Create super account error:', error);
    return NextResponse.json(
      { error: 'Failed to create superannuation account' },
      { status: 500 }
    );
  }
}
