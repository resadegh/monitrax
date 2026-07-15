/**
 * Phase 20: Tax Position API
 * GET /api/tax/position - Get comprehensive tax position
 * POST /api/tax/position/compare - Compare two scenarios
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import {
  calculateTaxPosition,
  calculateQuickTaxPosition,
  getCurrentFinancialYear,
} from '@/lib/tax-engine';
import { calculateTaxPositionDecimal } from '@/lib/tax-engine/position/taxPositionCalculator';
import type { IncomeItem, ExpenseItem, DepreciationItem } from '@/lib/tax-engine/position/taxPositionCalculator';
import { calculateDepreciationAnnual } from '@/lib/depreciation';

// Types for Prisma query results
interface IncomeRecord {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  isRecurring: boolean; // MON-053: one-off income counts once, not ×frequency
  propertyId: string | null;
  investmentAccountId: string | null;
  grossAmount: number | null;
  paygWithholding: number | null;
  frankingPercentage: number | null;
  frankingCredits: number | null;
  property: { id: string; name: string } | null;
  investmentAccount: { id: string; name: string } | null;
}

interface ExpenseRecord {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  isTaxDeductible: boolean;
  isRecurring: boolean;
  propertyId: string | null;
  loanId: string | null;
  property: { id: string; name: string } | null;
  loan: { id: string; name: string } | null;
}

interface DepreciationRecord {
  id: string;
  propertyId: string;
  category: string;
  assetName: string;
  cost: number;
  startDate: Date;
  rate: number;
  method: string;
  property: { id: string; name: string };
}

interface SuperAccountRecord {
  concessionalYTD: number | null;
  nonConcessionalYTD: number | null;
}

interface SuperTotalsAccumulator {
  concessional: number;
  nonConcessional: number;
}

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

    // Fetch all user data for tax position calculation
    const [incomes, expenses, depreciations, superAccounts] = await Promise.all([
      // Get all incomes
      prisma.income.findMany({
        where: { userId },
        include: {
          property: { select: { id: true, name: true } },
          investmentAccount: { select: { id: true, name: true } },
        },
      }),
      // Get all expenses
      prisma.expense.findMany({
        where: { userId },
        include: {
          property: { select: { id: true, name: true } },
          loan: { select: { id: true, name: true } },
        },
      }),
      // Get depreciation schedules
      prisma.depreciationSchedule.findMany({
        where: {
          property: { userId },
        },
        include: {
          property: { select: { id: true, name: true } },
        },
      }),
      // Get super accounts for contribution totals
      prisma.superannuationAccount.findMany({
        where: { userId },
        select: {
          concessionalYTD: true,
          nonConcessionalYTD: true,
        },
      }),
    ]);

    // Transform incomes to IncomeItem format
    const incomeItems: IncomeItem[] = (incomes as IncomeRecord[]).map((income: IncomeRecord) => ({
      id: income.id,
      name: income.name,
      type: income.type,
      amount: income.amount,
      frequency: income.frequency,
      isRecurring: income.isRecurring, // MON-053
      propertyId: income.propertyId || undefined,
      investmentAccountId: income.investmentAccountId || undefined,
      grossAmount: income.grossAmount || undefined,
      paygWithholding: income.paygWithholding || undefined,
      frankingPercentage: income.frankingPercentage || undefined,
      frankingCredits: income.frankingCredits || undefined,
    }));

    // Transform expenses to ExpenseItem format
    const expenseItems: ExpenseItem[] = (expenses as ExpenseRecord[]).map((expense: ExpenseRecord) => ({
      id: expense.id,
      name: expense.name,
      category: expense.category,
      amount: expense.amount,
      frequency: expense.frequency,
      isTaxDeductible: expense.isTaxDeductible,
      isRecurring: expense.isRecurring, // MON-037: count one-offs once, not ×frequency
      propertyId: expense.propertyId || undefined,
      loanId: expense.loanId || undefined,
    }));

    // Transform depreciations to DepreciationItem format
    // Calculate current year deduction from cost and rate
    const depreciationItems: DepreciationItem[] = (depreciations as unknown as DepreciationRecord[]).map((dep: DepreciationRecord) => {
      // MON-026: DepreciationSchedule.rate is a PERCENTAGE (2.5 = 2.5%), not a
      // decimal — the prior `cost * rate` was 100× too high. The canonical engine
      // does the /100 + prime-cost/diminishing-value math.
      const annualDeduction = calculateDepreciationAnnual(dep as any).annualDepreciation;
      return {
        id: dep.id,
        propertyId: dep.propertyId,
        currentYearDeduction: annualDeduction,
        type: dep.category, // DIV43 or DIV40
      };
    });

    // Calculate super contribution totals
    const superTotals = (superAccounts as SuperAccountRecord[]).reduce(
      (acc: SuperTotalsAccumulator, account: SuperAccountRecord) => ({
        concessional: acc.concessional + (account.concessionalYTD || 0),
        nonConcessional: acc.nonConcessional + (account.nonConcessionalYTD || 0),
      }),
      { concessional: 0, nonConcessional: 0 }
    );

    // Q-DEC PR 3.B — Decimal engine for numeric output; convert Decimal
    // → number at the JSON boundary. Same per-field rounding pattern as
    // the pre-cutover Float path (most money fields integer-rounded via
    // Math.round; rates + paygWithheld + estimatedRefund pass through
    // as-is). The Float path is also called to source `warnings` +
    // `recommendations` (presentational, not numeric — no Decimal sibling
    // exists; presentation-side warnings/recommendations move to Decimal
    // in PR 4 when Float is dropped).
    const taxPositionFloat = calculateTaxPosition({
      incomes: incomeItems,
      expenses: expenseItems,
      depreciations: depreciationItems,
      superContributions: superTotals,
      financialYear,
    });
    const taxPosition = calculateTaxPositionDecimal({
      incomes: incomeItems,
      expenses: expenseItems,
      depreciations: depreciationItems,
      superContributions: superTotals,
      financialYear,
    });
    const n = (d: { toNumber(): number }): number => d.toNumber();
    const r = (d: { toNumber(): number }): number => Math.round(d.toNumber());

    return NextResponse.json({
      success: true,
      financialYear: taxPosition.financialYear,
      isCurrent: taxPosition.financialYear === currentFY.year,
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
