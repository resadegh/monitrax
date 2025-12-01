/**
 * Phase 20: Tax API
 * GET /api/tax - Get current tax position
 * POST /api/tax/calculate - Calculate tax for a scenario
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TaxEngine } from '@/lib/tax-engine';
import { getCurrentFinancialYear } from '@/lib/tax-engine/types';

/**
 * GET /api/tax - Get user's current tax position
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
    const requestedFY = searchParams.get('financialYear');
    const currentFY = getCurrentFinancialYear();
    const financialYear = requestedFY || currentFY.year;

    const config = TaxEngine.getConfig(financialYear);

    // Fetch all income for the user
    const incomes = await prisma.income.findMany({
      where: { userId: user.userId },
      include: {
        property: true,
        investmentAccount: true,
      },
    });

    // Fetch all expenses for the user
    const expenses = await prisma.expense.findMany({
      where: { userId: user.userId },
      include: {
        property: true,
      },
    });

    // Calculate annual amounts and determine taxability
    let totalSalaryIncome = 0;
    let totalRentalIncome = 0;
    let totalDividendIncome = 0;
    let totalInterestIncome = 0;
    let totalOtherIncome = 0;
    let totalFrankingCredits = 0;
    let totalPaygWithheld = 0;

    const incomeBreakdown: Array<{
      id: string;
      name: string;
      type: string;
      amount: number;
      annualAmount: number;
      taxCategory: string;
      taxableAmount: number;
      frankingCredits: number;
    }> = [];

    for (const income of incomes) {
      // Annualize income
      const multiplier = getFrequencyMultiplier(income.frequency);
      const annualAmount = income.amount * multiplier;

      // Determine taxability
      const taxResult = TaxEngine.determineTaxability({
        incomeType: income.type,
        amount: annualAmount,
        frequency: income.frequency,
        propertyId: income.propertyId || undefined,
        investmentAccountId: income.investmentAccountId || undefined,
        frankingPercentage: income.frankingPercentage || 0,
      });

      // Categorize income
      switch (income.type) {
        case 'SALARY':
          totalSalaryIncome += taxResult.taxableAmount;
          // Estimate PAYG from salary
          if (annualAmount > 0) {
            const payg = TaxEngine.calculatePAYG({
              grossIncome: annualAmount,
              frequency: 'ANNUALLY',
              hasTaxFreeThreshold: true,
            });
            totalPaygWithheld += payg.annualWithholding;
          }
          break;
        case 'RENT':
        case 'RENTAL':
          totalRentalIncome += taxResult.taxableAmount;
          break;
        case 'INVESTMENT':
          totalDividendIncome += taxResult.taxableAmount;
          totalFrankingCredits += taxResult.frankingCredits;
          break;
        case 'OTHER':
        default:
          // Check if this "other" income is interest-related by name
          if (income.name.toLowerCase().includes('interest')) {
            totalInterestIncome += taxResult.taxableAmount;
          } else {
            totalOtherIncome += taxResult.taxableAmount;
          }
      }

      incomeBreakdown.push({
        id: income.id,
        name: income.name,
        type: income.type,
        amount: income.amount,
        annualAmount,
        taxCategory: taxResult.category,
        taxableAmount: taxResult.taxableAmount,
        frankingCredits: taxResult.frankingCredits,
      });
    }

    // Calculate deductions from expenses
    let totalPropertyDeductions = 0;
    let totalOtherDeductions = 0;

    for (const expense of expenses) {
      if (!expense.isTaxDeductible) continue;

      const multiplier = getFrequencyMultiplier(expense.frequency);
      const annualAmount = expense.amount * multiplier;

      if (expense.propertyId) {
        totalPropertyDeductions += annualAmount;
      } else {
        totalOtherDeductions += annualAmount;
      }
    }

    // Calculate total assessable income
    const totalAssessableIncome =
      totalSalaryIncome +
      totalRentalIncome +
      totalDividendIncome +
      totalInterestIncome +
      totalOtherIncome;

    const totalDeductions = totalPropertyDeductions + totalOtherDeductions;
    const taxableIncome = Math.max(0, totalAssessableIncome - totalDeductions);

    // Calculate tax
    const incomeTaxResult = TaxEngine.calculateIncomeTax(taxableIncome, config);
    const medicareResult = TaxEngine.calculateMedicareLevy({ taxableIncome }, config);

    // Calculate offsets
    const offsetsResult = TaxEngine.calculateAllOffsets({
      taxableIncome,
      frankingCredits: totalFrankingCredits,
    }, config);

    // Apply offsets
    const grossTax = incomeTaxResult.taxPayable + medicareResult.total;
    const offsetApplication = TaxEngine.applyOffsets(grossTax, offsetsResult.offsets);

    // Calculate estimated refund/owing
    const estimatedRefund = totalPaygWithheld - offsetApplication.netTax;

    return NextResponse.json({
      success: true,
      financialYear,
      isCurrent: financialYear === currentFY.year,
      summary: {
        totalIncome: Math.round(totalAssessableIncome),
        totalDeductions: Math.round(totalDeductions),
        taxableIncome: Math.round(taxableIncome),
        taxPayable: Math.round(offsetApplication.netTax),
        paygWithheld: Math.round(totalPaygWithheld),
        estimatedRefund: Math.round(estimatedRefund),
        isRefund: estimatedRefund >= 0,
      },
      income: {
        salary: Math.round(totalSalaryIncome),
        rental: Math.round(totalRentalIncome),
        dividends: Math.round(totalDividendIncome),
        interest: Math.round(totalInterestIncome),
        other: Math.round(totalOtherIncome),
        frankingCredits: Math.round(totalFrankingCredits),
        breakdown: incomeBreakdown,
      },
      deductions: {
        property: Math.round(totalPropertyDeductions),
        other: Math.round(totalOtherDeductions),
        total: Math.round(totalDeductions),
      },
      tax: {
        incomeTax: Math.round(incomeTaxResult.taxPayable),
        medicareLevy: Math.round(medicareResult.medicareLevy),
        medicareSurcharge: Math.round(medicareResult.medicareSurcharge),
        grossTax: Math.round(grossTax),
        offsets: {
          lito: Math.round(offsetsResult.offsets.lito),
          frankingCredits: Math.round(offsetsResult.offsets.frankingCredits),
          total: Math.round(offsetsResult.offsets.total),
        },
        netTax: Math.round(offsetApplication.netTax),
        effectiveRate: taxableIncome > 0
          ? Math.round((offsetApplication.netTax / taxableIncome) * 10000) / 100
          : 0,
        marginalRate: incomeTaxResult.marginalRate,
      },
      config: {
        taxBrackets: config.brackets.map((b) => ({
          min: b.min,
          max: b.max,
          rate: b.rate * 100,
        })),
        superGuaranteeRate: config.superGuaranteeRate * 100,
        medicareRate: config.medicareRate * 100,
      },
    });
  } catch (error) {
    console.error('Tax position error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tax position' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tax - Calculate tax for a hypothetical scenario
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
      taxableIncome,
      deductions = 0,
      frankingCredits = 0,
      financialYear,
    } = body;

    if (typeof taxableIncome !== 'number' || taxableIncome < 0) {
      return NextResponse.json(
        { error: 'Invalid taxableIncome' },
        { status: 400 }
      );
    }

    const config = financialYear
      ? TaxEngine.getConfig(financialYear)
      : TaxEngine.getCurrentConfig();

    const netTaxableIncome = Math.max(0, taxableIncome - deductions);

    const incomeTaxResult = TaxEngine.calculateIncomeTax(netTaxableIncome, config);
    const medicareResult = TaxEngine.calculateMedicareLevy({ taxableIncome: netTaxableIncome }, config);

    const offsetsResult = TaxEngine.calculateAllOffsets({
      taxableIncome: netTaxableIncome,
      frankingCredits,
    }, config);

    const grossTax = incomeTaxResult.taxPayable + medicareResult.total;
    const offsetApplication = TaxEngine.applyOffsets(grossTax, offsetsResult.offsets);

    return NextResponse.json({
      success: true,
      financialYear: config.financialYear,
      input: {
        taxableIncome,
        deductions,
        frankingCredits,
      },
      result: {
        netTaxableIncome,
        incomeTax: Math.round(incomeTaxResult.taxPayable),
        medicareLevy: Math.round(medicareResult.total),
        grossTax: Math.round(grossTax),
        offsets: Math.round(offsetsResult.offsets.total),
        netTax: Math.round(offsetApplication.netTax),
        effectiveRate: netTaxableIncome > 0
          ? Math.round((offsetApplication.netTax / netTaxableIncome) * 10000) / 100
          : 0,
        marginalRate: incomeTaxResult.marginalRate,
      },
      calculations: [
        ...incomeTaxResult.calculations,
        ...medicareResult.calculations,
        ...offsetsResult.calculations,
      ],
    });
  } catch (error) {
    console.error('Tax calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tax' },
      { status: 500 }
    );
  }
}

// Helper function to get frequency multiplier for annualization
function getFrequencyMultiplier(frequency: string): number {
  const multipliers: Record<string, number> = {
    WEEKLY: 52,
    FORTNIGHTLY: 26,
    MONTHLY: 12,
    QUARTERLY: 4,
    ANNUAL: 1,
    ANNUALLY: 1,
  };
  return multipliers[frequency] || 1;
}
