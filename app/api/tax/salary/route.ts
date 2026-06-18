/**
 * Phase 20: Salary Tax Calculation API
 * POST /api/tax/salary - Calculate salary breakdown with tax, super, and net
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { TaxEngine } from '@/lib/tax-engine';
import { processSalaryDecimal } from '@/lib/tax-engine/income/salaryProcessor';

export const POST = withPermission('income.write', async (request, auth) => {
  try {
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
    const validFrequencies = ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'HALF_YEARLY'];
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

    // Q-DEC PR 3.B.2 — Decimal engine for numeric output. Dual-call to
    // the Float engine sources the `calculations[]` narration array
    // (presentational — no Decimal sibling). PR 4 will migrate narration
    // to Decimal when Float is dropped.
    const resultFloat = TaxEngine.processSalary(
      {
        amount,
        salaryType: salaryType as 'GROSS' | 'NET',
        payFrequency: payFrequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY',
        salarySacrifice,
        salarySacrificeFrequency: salarySacrificeFrequency || payFrequency,
        hasTaxFreeThreshold,
        hasHECSDebt,
      },
      config
    );
    const result = processSalaryDecimal(
      {
        amount,
        salaryType: salaryType as 'GROSS' | 'NET',
        payFrequency: payFrequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'HALF_YEARLY',
        salarySacrifice,
        salarySacrificeFrequency: salarySacrificeFrequency || payFrequency,
        hasTaxFreeThreshold,
        hasHECSDebt,
      },
      config
    );
    const grossSalary = result.grossSalary.toNumber();

    // Calculate optimal salary sacrifice recommendation (Float — no
    // Decimal sibling; this is a recommendation engine, not money math).
    const optimization = TaxEngine.calculateOptimalSalarySacrifice(grossSalary, config);

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
        grossSalary,
        netSalary: result.netSalary.toNumber(),
        taxableIncome: result.taxableIncome.toNumber(),
        tax: {
          payg: result.paygWithholding.toNumber(),
          medicareLevy: result.medicareLevy.toNumber(),
          total: result.totalTax.toNumber(),
        },
        super: {
          guarantee: result.superGuarantee.toNumber(),
          salarySacrifice: result.salarySacrifice.toNumber(),
          total: result.totalSuper.toNumber(),
          guaranteeRate: config.superGuaranteeRate * 100,
        },
        perPeriod: {
          gross: result.perPeriod.gross.toNumber(),
          super: result.perPeriod.super.toNumber(),
          tax: result.perPeriod.tax.toNumber(),
          net: result.perPeriod.net.toNumber(),
          frequency: result.perPeriod.frequency,
        },
        effectiveTaxRate: grossSalary > 0
          ? Math.round((result.totalTax.toNumber() / grossSalary) * 10000) / 100
          : 0,
      },
      optimization: {
        recommendedSalarySacrifice: optimization.optimalAmount,
        potentialTaxSavings: optimization.taxSavings,
        netImpact: optimization.netImpact,
        explanation: optimization.reason,
      },
      calculations: resultFloat.calculations,
    });
  } catch (error) {
    console.error('Salary calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate salary breakdown' },
      { status: 500 }
    );
  }
});

/**
 * GET /api/tax/salary - Get PAYG withholding tables info
 */
export const GET = withPermission('report.read', async (request, auth) => {
  try {
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
});
