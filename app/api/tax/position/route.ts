/**
 * Phase 20: Tax Position API
 * GET /api/tax/position - Get comprehensive tax position
 * POST /api/tax/position/compare - Compare two scenarios
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  calculateQuickTaxPosition,
  getCurrentFinancialYear,
} from '@/lib/tax-engine';
import { calculateTaxPositionDecimal } from '@/lib/tax-engine/position/taxPositionCalculator';
// MON-020/060: the ONE user-level tax assembler — this route no longer fetches
// or assembles its own inputs (that duplicated getUserTaxPosition verbatim and
// was the F2 same-engine-different-inputs drift risk). Float position + the
// Decimal twin both derive from the SAME bundle.engineInputs.
import { getUserTaxPosition } from '@/lib/tax-engine/position/userTaxPosition';

/**
 * GET /api/tax/position - Get user's comprehensive tax position
 */
export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const requestedFY = searchParams.get('financialYear');
    const currentFY = getCurrentFinancialYear();
    const financialYear = requestedFY || currentFY.year;

    // MON-020/060: ONE fetch + ONE assembly via the canonical user-level
    // source. The Decimal twin is computed from the SAME engineInputs object
    // that produced the Float position — identical inputs by construction.
    const bundle = await getUserTaxPosition(userId, requestedFY);
    const taxPositionFloat = bundle.taxPosition;
    const taxPosition = calculateTaxPositionDecimal(bundle.engineInputs);
    const incomeItems = bundle.engineInputs.incomes;
    const expenseItems = bundle.engineInputs.expenses;
    const depreciationItems = bundle.engineInputs.depreciations ?? [];

    const n = (d: { toNumber(): number }): number => d.toNumber();
    const r = (d: { toNumber(): number }): number => Math.round(d.toNumber());

    return NextResponse.json({
      success: true,
      financialYear: taxPosition.financialYear,
      isCurrent: taxPosition.financialYear === currentFY.year,
      // MON-106: pass the engine's stale-config surfacing through — the page
      // announces a not-yet-configured FY instead of silently rendering a
      // mismatched year.
      configFinancialYear: taxPosition.configFinancialYear,
      configStale: taxPosition.configStale,
      summary: {
        totalIncome: r(taxPosition.income.total),
        totalDeductions: r(taxPosition.deductions.total),
        taxableIncome: r(taxPosition.tax.taxableIncome),
        taxPayable: r(taxPosition.tax.netTax),
        paygWithheld: n(taxPosition.paygWithheld),
        estimatedRefund: n(taxPosition.estimatedRefund),
        isRefund: taxPosition.estimatedRefund.gte(0),
        effectiveRate: n(taxPosition.tax.effectiveRate),
        marginalRate: n(taxPosition.tax.marginalRate),
      },
      income: {
        salary: r(taxPosition.income.salary),
        rental: r(taxPosition.income.rental),
        dividends: r(taxPosition.income.dividends),
        interest: r(taxPosition.income.interest),
        capitalGains: r(taxPosition.income.capitalGains),
        other: r(taxPosition.income.other),
        total: r(taxPosition.income.total),
        frankingCredits: r(taxPosition.income.frankingCredits),
      },
      deductions: {
        workRelated: r(taxPosition.deductions.workRelated),
        property: r(taxPosition.deductions.property),
        investment: r(taxPosition.deductions.investment),
        depreciation: r(taxPosition.deductions.depreciation),
        other: r(taxPosition.deductions.other),
        total: r(taxPosition.deductions.total),
      },
      tax: {
        assessableIncome: r(taxPosition.tax.assessableIncome),
        taxableIncome: r(taxPosition.tax.taxableIncome),
        taxOnIncome: r(taxPosition.tax.taxOnIncome),
        medicareLevy: r(taxPosition.tax.medicareLevy),
        medicareSurcharge: r(taxPosition.tax.medicareSurcharge),
        grossTax: r(taxPosition.tax.grossTax),
        offsets: {
          lito: r(taxPosition.tax.offsets.lito),
          sapto: r(taxPosition.tax.offsets.sapto),
          frankingCredits: r(taxPosition.tax.offsets.frankingCredits),
          foreignTax: r(taxPosition.tax.offsets.foreignTax),
          other: r(taxPosition.tax.offsets.other),
          total: r(taxPosition.tax.offsets.total),
        },
        netTax: r(taxPosition.tax.netTax),
        effectiveRate: n(taxPosition.tax.effectiveRate),
        marginalRate: n(taxPosition.tax.marginalRate),
      },
      super: {
        concessional: n(taxPosition.superContributions.concessional),
        nonConcessional: n(taxPosition.superContributions.nonConcessional),
        total: n(taxPosition.superContributions.total),
        division293Tax: n(taxPosition.superContributions.division293Tax),
      },
      warnings: taxPositionFloat.warnings,
      recommendations: taxPositionFloat.recommendations,
      metadata: {
        incomeCount: incomeItems.length,
        expenseCount: expenseItems.length,
        depreciationCount: depreciationItems.length,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Tax position error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tax position' },
      { status: 500 }
    );
  }
});

/**
 * POST /api/tax/position - Calculate quick tax position for a scenario
 */
export const POST = withPermission('report.read', async (request, auth) => {
  try {
    const body = await request.json();
    const {
      taxableIncome,
      deductions = 0,
      frankingCredits = 0,
      financialYear,
    } = body;

    if (typeof taxableIncome !== 'number' || taxableIncome < 0) {
      return NextResponse.json(
        { error: 'Valid taxableIncome is required' },
        { status: 400 }
      );
    }

    const result = calculateQuickTaxPosition(
      taxableIncome,
      deductions,
      frankingCredits,
      financialYear
    );

    return NextResponse.json({
      success: true,
      input: {
        grossIncome: taxableIncome,
        deductions,
        frankingCredits,
      },
      result: {
        taxableIncome: result.taxableIncome,
        taxPayable: result.taxPayable,
        medicareLevy: result.medicareLevy,
        netTax: result.netTax,
        effectiveRate: result.effectiveRate,
        marginalRate: result.marginalRate,
        takeHomePay: Math.round(taxableIncome - result.netTax),
      },
    });
  } catch (error) {
    console.error('Quick tax calculation error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tax' },
      { status: 500 }
    );
  }
});
