/**
 * Phase 20: Tax Position API
 * GET /api/tax/position - Get comprehensive tax position
 * POST /api/tax/position/compare - Compare two scenarios
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  calculateTaxPosition,
  calculateQuickTaxPosition,
  getCurrentFinancialYear,
} from '@/lib/tax-engine';
import type { IncomeItem, ExpenseItem, DepreciationItem } from '@/lib/tax-engine/position/taxPositionCalculator';

// Types for Prisma query results
interface IncomeRecord {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
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

    // Fetch all user data for tax position calculation
    const [incomes, expenses, depreciations, superAccounts] = await Promise.all([
      // Get all incomes
      prisma.income.findMany({
        where: { userId: user.userId },
        include: {
          property: { select: { id: true, name: true } },
          investmentAccount: { select: { id: true, name: true } },
        },
      }),
      // Get all expenses
      prisma.expense.findMany({
        where: { userId: user.userId },
        include: {
          property: { select: { id: true, name: true } },
          loan: { select: { id: true, name: true } },
        },
      }),
      // Get depreciation schedules
      prisma.depreciationSchedule.findMany({
        where: {
          property: { userId: user.userId },
        },
        include: {
          property: { select: { id: true, name: true } },
        },
      }),
      // Get super accounts for contribution totals
      prisma.superannuationAccount.findMany({
        where: { userId: user.userId },
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
      propertyId: expense.propertyId || undefined,
      loanId: expense.loanId || undefined,
    }));

    // Transform depreciations to DepreciationItem format
    // Calculate current year deduction from cost and rate
    const depreciationItems: DepreciationItem[] = (depreciations as unknown as DepreciationRecord[]).map((dep: DepreciationRecord) => {
      // Calculate annual deduction: cost * rate (rate is stored as decimal, e.g., 0.025 for 2.5%)
      const annualDeduction = dep.cost * dep.rate;
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

    // Calculate tax position
    const taxPosition = calculateTaxPosition({
      incomes: incomeItems,
      expenses: expenseItems,
      depreciations: depreciationItems,
      superContributions: superTotals,
      financialYear,
    });

    return NextResponse.json({
      success: true,
      financialYear: taxPosition.financialYear,
      isCurrent: taxPosition.financialYear === currentFY.year,
      summary: {
        totalIncome: Math.round(taxPosition.income.total),
        totalDeductions: Math.round(taxPosition.deductions.total),
        taxableIncome: Math.round(taxPosition.tax.taxableIncome),
        taxPayable: Math.round(taxPosition.tax.netTax),
        paygWithheld: taxPosition.paygWithheld,
        estimatedRefund: taxPosition.estimatedRefund,
        isRefund: taxPosition.estimatedRefund >= 0,
        effectiveRate: taxPosition.tax.effectiveRate,
        marginalRate: taxPosition.tax.marginalRate,
      },
      income: {
        salary: Math.round(taxPosition.income.salary),
        rental: Math.round(taxPosition.income.rental),
        dividends: Math.round(taxPosition.income.dividends),
        interest: Math.round(taxPosition.income.interest),
        capitalGains: Math.round(taxPosition.income.capitalGains),
        other: Math.round(taxPosition.income.other),
        total: Math.round(taxPosition.income.total),
        frankingCredits: Math.round(taxPosition.income.frankingCredits),
      },
      deductions: {
        workRelated: Math.round(taxPosition.deductions.workRelated),
        property: Math.round(taxPosition.deductions.property),
        investment: Math.round(taxPosition.deductions.investment),
        depreciation: Math.round(taxPosition.deductions.depreciation),
        other: Math.round(taxPosition.deductions.other),
        total: Math.round(taxPosition.deductions.total),
      },
      tax: {
        assessableIncome: Math.round(taxPosition.tax.assessableIncome),
        taxableIncome: Math.round(taxPosition.tax.taxableIncome),
        taxOnIncome: Math.round(taxPosition.tax.taxOnIncome),
        medicareLevy: Math.round(taxPosition.tax.medicareLevy),
        medicareSurcharge: Math.round(taxPosition.tax.medicareSurcharge),
        grossTax: Math.round(taxPosition.tax.grossTax),
        offsets: {
          lito: Math.round(taxPosition.tax.offsets.lito),
          sapto: Math.round(taxPosition.tax.offsets.sapto),
          frankingCredits: Math.round(taxPosition.tax.offsets.frankingCredits),
          foreignTax: Math.round(taxPosition.tax.offsets.foreignTax),
          other: Math.round(taxPosition.tax.offsets.other),
          total: Math.round(taxPosition.tax.offsets.total),
        },
        netTax: Math.round(taxPosition.tax.netTax),
        effectiveRate: taxPosition.tax.effectiveRate,
        marginalRate: taxPosition.tax.marginalRate,
      },
      super: taxPosition.superContributions,
      warnings: taxPosition.warnings,
      recommendations: taxPosition.recommendations,
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
}

/**
 * POST /api/tax/position - Calculate quick tax position for a scenario
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
}
