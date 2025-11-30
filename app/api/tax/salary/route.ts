/**
 * Phase 20: Salary Tax Calculation API
 * POST /api/tax/salary - Calculate salary breakdown with tax, super, and net
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { TaxEngine } from '@/lib/tax-engine';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      amount,
      salaryType = 'GROSS',
      payFrequency = 'ANNUALLY',
      salarySacrifice = 0,
      salarySacrificeFrequency,
      hasTaxFreeThreshold = true,
      hasHECSDebt = false,
      financialYear,
    } = body;

    // Validate required fields
    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json(
        { error: 'Invalid amount. Must be a positive number.' },
        { status: 400 }
      );
    }

    // Validate salary type
    if (!['GROSS', 'NET'].includes(salaryType)) {
      return NextResponse.json(
        { error: 'Invalid salaryType. Must be GROSS or NET.' },
        { status: 400 }
      );
    }

    // Validate pay frequency
    const validFrequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];
    if (!validFrequencies.includes(payFrequency)) {
      return NextResponse.json(
        { error: `Invalid payFrequency. Must be one of: ${validFrequencies.join(', ')}` },
        { status: 400 }
      );
    }

    // Get tax configuration for the specified year (or current)
    const config = financialYear
      ? TaxEngine.getConfig(financialYear)
      : TaxEngine.getCurrentConfig();

    // Process salary
    const result = TaxEngine.processSalary(
      {
        amount,
        salaryType: salaryType as 'GROSS' | 'NET',
        payFrequency: payFrequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY',
        salarySacrifice,
        salarySacrificeFrequency: salarySacrificeFrequency || payFrequency,
        hasTaxFreeThreshold,
        hasHECSDebt,
      },
      config
    );

    // Calculate optimal salary sacrifice recommendation
    const optimization = TaxEngine.calculateOptimalSalarySacrifice(result.grossSalary, config);

    return NextResponse.json({
      success: true,
      financialYear: config.financialYear,
      input: {
        amount,
        salaryType,
        payFrequency,
        salarySacrifice,
        hasTaxFreeThreshold,
      },
      result: {
        grossSalary: result.grossSalary,
        netSalary: result.netSalary,
        taxableIncome: result.taxableIncome,
        tax: {
          payg: result.paygWithholding,
          medicareLevy: result.medicareLevy,
          total: result.totalTax,
        },
        super: {
          guarantee: result.superGuarantee,
          salarySacrifice: result.salarySacrifice,
          total: result.totalSuper,
          guaranteeRate: config.superGuaranteeRate * 100,
        },
        perPeriod: result.perPeriod,
        effectiveTaxRate: result.grossSalary > 0
          ? Math.round((result.totalTax / result.grossSalary) * 10000) / 100
          : 0,
      },
      optimization: {
        recommendedSalarySacrifice: optimization.optimalAmount,
        potentialTaxSavings: optimization.taxSavings,
        netImpact: optimization.netImpact,
        explanation: optimization.reason,
      },
      calculations: result.calculations,
    });
  } catch (error) {
    console.error('Salary calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate salary breakdown' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tax/salary - Get PAYG withholding tables info
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

    const config = TaxEngine.getCurrentConfig();

    return NextResponse.json({
      financialYear: config.financialYear,
      superGuaranteeRate: config.superGuaranteeRate * 100,
      taxBrackets: config.brackets.map((b) => ({
        min: b.min,
        max: b.max,
        rate: b.rate * 100,
        baseAmount: b.baseAmount,
      })),
      medicareLevy: {
        rate: config.medicareRate * 100,
        threshold: config.medicareThresholds.single,
      },
      concessionalCap: config.concessionalCap,
      availableYears: TaxEngine.getAvailableYears(),
    });
  } catch (error) {
    console.error('Get tax info error:', error);
    return NextResponse.json(
      { error: 'Failed to get tax information' },
      { status: 500 }
    );
  }
}
