/**
 * Phase 20: Super Optimization API
 * GET /api/tax/super/optimize - Get salary sacrifice optimization
 * POST /api/tax/super/optimize - Calculate custom scenario
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TaxEngine, calculateCoContribution } from '@/lib/tax-engine';
import { getCurrentFinancialYear } from '@/lib/tax-engine/types';

// Type for super account
interface SuperAccountRecord {
  currentBalance: number;
  concessionalYTD: number;
  nonConcessionalYTD: number;
}

/**
 * GET /api/tax/super/optimize - Get optimization recommendations based on user's data
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
    const config = TaxEngine.getCurrentConfig();

    // Get user's salary income
    const salaryIncome = await prisma.income.findFirst({
      where: {
        userId: user.userId,
        type: 'SALARY',
      },
    });

    if (!salaryIncome || !salaryIncome.grossAmount) {
      return NextResponse.json({
        success: true,
        message: 'No salary income found. Add salary income to receive optimization recommendations.',
        recommendations: [],
      });
    }

    const grossSalary = salaryIncome.grossAmount;

    // Get super accounts and current contributions
    const superAccounts = await prisma.superannuationAccount.findMany({
      where: { userId: user.userId },
      include: {
        contributions: {
          where: { financialYear: currentFY.year },
        },
      },
    }) as SuperAccountRecord[];

    // Calculate current contributions
    let currentConcessional = 0;
    let currentNonConcessional = 0;
    let totalSuperBalance = 0;

    superAccounts.forEach((account: SuperAccountRecord) => {
      totalSuperBalance += account.currentBalance;
      currentConcessional += account.concessionalYTD;
      currentNonConcessional += account.nonConcessionalYTD;
    });

    // Calculate marginal rate
    const marginalRate = TaxEngine.getMarginalRate(grossSalary, config);

    // Get optimization strategy
    const strategy = TaxEngine.getOptimalContributionStrategy(
      grossSalary,
      currentConcessional,
      marginalRate,
      totalSuperBalance,
      config
    );

    // Calculate scenarios
    const scenarios = [];

    // Scenario 1: Current position
    const currentTax = TaxEngine.calculateIncomeTax(grossSalary, config);
    scenarios.push({
      name: 'Current Position',
      salarySacrifice: 0,
      taxableIncome: grossSalary,
      incomeTax: Math.round(currentTax.taxPayable),
      effectiveRate: Math.round((currentTax.taxPayable / grossSalary) * 10000) / 100,
      superContributions: Math.round(currentConcessional),
      netPosition: Math.round(grossSalary - currentTax.taxPayable),
    });

    // Scenario 2: Optimal salary sacrifice
    if (strategy.recommendedSalarySacrifice > 0) {
      const optimizedTaxableIncome = grossSalary - strategy.recommendedSalarySacrifice;
      const optimizedTax = TaxEngine.calculateIncomeTax(optimizedTaxableIncome, config);
      const superTax = strategy.recommendedSalarySacrifice * 0.15;

      scenarios.push({
        name: 'Optimal Salary Sacrifice',
        salarySacrifice: Math.round(strategy.recommendedSalarySacrifice),
        taxableIncome: Math.round(optimizedTaxableIncome),
        incomeTax: Math.round(optimizedTax.taxPayable),
        superTax: Math.round(superTax),
        totalTax: Math.round(optimizedTax.taxPayable + superTax),
        effectiveRate: Math.round(((optimizedTax.taxPayable + superTax) / grossSalary) * 10000) / 100,
        superContributions: Math.round(currentConcessional + strategy.recommendedSalarySacrifice),
        netPosition: Math.round(grossSalary - optimizedTax.taxPayable - strategy.recommendedSalarySacrifice),
        taxSavings: Math.round(strategy.taxSavings),
        superGain: Math.round(strategy.recommendedSalarySacrifice * 0.85), // After 15% contributions tax
      });
    }

    // Scenario 3: Moderate salary sacrifice ($500/month)
    const moderateSacrifice = Math.min(6000, strategy.remainingCap);
    if (moderateSacrifice > 0 && moderateSacrifice !== strategy.recommendedSalarySacrifice) {
      const moderateTaxableIncome = grossSalary - moderateSacrifice;
      const moderateTax = TaxEngine.calculateIncomeTax(moderateTaxableIncome, config);
      const moderateSuperTax = moderateSacrifice * 0.15;
      const moderateSavings = (currentTax.taxPayable - moderateTax.taxPayable) - moderateSuperTax;

      scenarios.push({
        name: 'Moderate ($500/month)',
        salarySacrifice: Math.round(moderateSacrifice),
        taxableIncome: Math.round(moderateTaxableIncome),
        incomeTax: Math.round(moderateTax.taxPayable),
        superTax: Math.round(moderateSuperTax),
        totalTax: Math.round(moderateTax.taxPayable + moderateSuperTax),
        effectiveRate: Math.round(((moderateTax.taxPayable + moderateSuperTax) / grossSalary) * 10000) / 100,
        superContributions: Math.round(currentConcessional + moderateSacrifice),
        netPosition: Math.round(grossSalary - moderateTax.taxPayable - moderateSacrifice),
        taxSavings: Math.round(moderateSavings),
        superGain: Math.round(moderateSacrifice * 0.85),
      });
    }

    // Check Division 293 impact
    const combinedIncome = grossSalary + (currentConcessional + (strategy.recommendedSalarySacrifice || 0));
    const division293Applies = combinedIncome > config.division293Threshold;

    // Build recommendations
    const recommendations = [];

    if (strategy.recommendedSalarySacrifice > 0) {
      recommendations.push({
        type: 'SALARY_SACRIFICE',
        title: 'Maximize Salary Sacrifice',
        description: strategy.explanation,
        potentialSavings: strategy.taxSavings,
        priority: 'HIGH',
      });
    }

    if (marginalRate >= 0.37 && !division293Applies) {
      recommendations.push({
        type: 'TAX_EFFICIENCY',
        title: 'High Tax Bracket Opportunity',
        description: `At ${Math.round(marginalRate * 100)}% marginal rate, salary sacrifice saves ${Math.round((marginalRate - 0.15) * 100)}% compared to income tax.`,
        priority: 'HIGH',
      });
    }

    if (division293Applies) {
      recommendations.push({
        type: 'WARNING',
        title: 'Division 293 Tax Applies',
        description: `Combined income and super exceeds $${config.division293Threshold.toLocaleString()}. Additional 15% tax on super contributions.`,
        priority: 'MEDIUM',
      });
    }

    if (currentConcessional < config.concessionalCap * 0.5 && marginalRate >= 0.30) {
      recommendations.push({
        type: 'OPTIMIZATION',
        title: 'Underutilized Super Cap',
        description: `You've used only ${Math.round((currentConcessional / config.concessionalCap) * 100)}% of your concessional cap. Consider increasing contributions.`,
        priority: 'MEDIUM',
      });
    }

    // Co-contribution eligibility
    if (grossSalary < 60400) {
      const coContribResult = calculateCoContribution(grossSalary, 1000);

      if (coContribResult.eligible) {
        recommendations.push({
          type: 'CO_CONTRIBUTION',
          title: 'Government Co-contribution Available',
          description: 'You may be eligible for government co-contribution on after-tax super contributions.',
          priority: 'MEDIUM',
        });
      }
    }

    return NextResponse.json({
      success: true,
      financialYear: currentFY.year,
      currentPosition: {
        grossSalary: Math.round(grossSalary),
        marginalRate: Math.round(marginalRate * 100),
        currentConcessional: Math.round(currentConcessional),
        currentNonConcessional: Math.round(currentNonConcessional),
        totalSuperBalance: Math.round(totalSuperBalance),
        remainingConcessionalCap: Math.round(config.concessionalCap - currentConcessional),
      },
      optimization: {
        recommendedSalarySacrifice: Math.round(strategy.recommendedSalarySacrifice),
        taxSavings: Math.round(strategy.taxSavings),
        explanation: strategy.explanation,
      },
      scenarios,
      recommendations,
      warnings: strategy.warnings,
      config: {
        concessionalCap: config.concessionalCap,
        superGuaranteeRate: config.superGuaranteeRate * 100,
        division293Threshold: config.division293Threshold,
      },
    });
  } catch (error) {
    console.error('Super optimization error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate optimization' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tax/super/optimize - Calculate a custom salary sacrifice scenario
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
      grossSalary,
      salarySacrifice = 0,
      currentConcessional = 0,
    } = body;

    if (typeof grossSalary !== 'number' || grossSalary <= 0) {
      return NextResponse.json(
        { error: 'Valid gross salary is required' },
        { status: 400 }
      );
    }

    const config = TaxEngine.getCurrentConfig();
    const currentFY = getCurrentFinancialYear();

    // Calculate without salary sacrifice
    const baseTax = TaxEngine.calculateIncomeTax(grossSalary, config);
    const baseMedicare = TaxEngine.calculateMedicareLevy({ taxableIncome: grossSalary }, config);

    // Calculate with salary sacrifice
    const reducedTaxable = grossSalary - salarySacrifice;
    const reducedTax = TaxEngine.calculateIncomeTax(reducedTaxable, config);
    const reducedMedicare = TaxEngine.calculateMedicareLevy({ taxableIncome: reducedTaxable }, config);

    // Super contributions tax (15%)
    const superContributionsTax = salarySacrifice * 0.15;

    // Calculate SG
    const superGuarantee = grossSalary * config.superGuaranteeRate;
    const totalConcessional = superGuarantee + salarySacrifice + currentConcessional;

    // Check caps
    const capExcess = Math.max(0, totalConcessional - config.concessionalCap);
    const marginalRate = TaxEngine.getMarginalRate(grossSalary, config);
    const excessTax = capExcess * marginalRate; // Excess taxed at marginal rate

    // Division 293
    const division293Tax = TaxEngine.calculateDivision293Tax(
      reducedTaxable,
      totalConcessional,
      config
    );

    // Calculate totals
    const baseTotalTax = baseTax.taxPayable + baseMedicare.total;
    const newTotalTax = reducedTax.taxPayable + reducedMedicare.total + superContributionsTax + division293Tax + excessTax;

    const taxSavings = baseTotalTax - newTotalTax;
    const netBenefit = taxSavings; // Could include super growth but keeping simple

    return NextResponse.json({
      success: true,
      financialYear: currentFY.year,
      input: {
        grossSalary,
        salarySacrifice,
        currentConcessional,
      },
      baseline: {
        taxableIncome: grossSalary,
        incomeTax: Math.round(baseTax.taxPayable),
        medicareLevy: Math.round(baseMedicare.total),
        totalTax: Math.round(baseTotalTax),
        netIncome: Math.round(grossSalary - baseTotalTax),
      },
      withSalarySacrifice: {
        taxableIncome: Math.round(reducedTaxable),
        incomeTax: Math.round(reducedTax.taxPayable),
        medicareLevy: Math.round(reducedMedicare.total),
        superContributionsTax: Math.round(superContributionsTax),
        division293Tax: Math.round(division293Tax),
        capExcessTax: Math.round(excessTax),
        totalTax: Math.round(newTotalTax),
        netIncome: Math.round(reducedTaxable - reducedTax.taxPayable - reducedMedicare.total),
        superGain: Math.round(salarySacrifice * 0.85), // After contributions tax
      },
      comparison: {
        taxSavings: Math.round(taxSavings),
        netBenefit: Math.round(netBenefit),
        effectiveRateBefore: Math.round((baseTotalTax / grossSalary) * 10000) / 100,
        effectiveRateAfter: Math.round((newTotalTax / grossSalary) * 10000) / 100,
        isBeneficial: taxSavings > 0,
      },
      super: {
        superGuarantee: Math.round(superGuarantee),
        salarySacrifice: Math.round(salarySacrifice),
        totalConcessional: Math.round(totalConcessional),
        concessionalCap: config.concessionalCap,
        capExcess: Math.round(capExcess),
        division293Applies: division293Tax > 0,
      },
      warnings: capExcess > 0
        ? [`Concessional contributions exceed cap by $${Math.round(capExcess).toLocaleString()}. Excess will be taxed at your marginal rate.`]
        : [],
    });
  } catch (error) {
    console.error('Custom scenario error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate scenario' },
      { status: 500 }
    );
  }
}
