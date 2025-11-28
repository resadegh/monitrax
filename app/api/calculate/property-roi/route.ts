/**
 * Property ROI Calculation API
 * POST /api/calculate/property-roi
 *
 * Calculate property return on investment metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/middleware';
import prisma from '@/lib/db';
import { toAnnual } from '@/lib/utils/frequencies';
import { Frequency } from '@/lib/types/prisma-enums';

// =============================================================================
// REQUEST SCHEMA
// =============================================================================

const propertyROISchema = z.object({
  propertyId: z.string().optional(),
  // Or provide data directly
  propertyData: z
    .object({
      currentValue: z.number().positive(),
      purchasePrice: z.number().positive(),
      purchaseDate: z.string().optional(),
      annualRent: z.number().min(0).default(0),
      annualExpenses: z.number().min(0).default(0),
      loanBalance: z.number().min(0).default(0),
      annualInterest: z.number().min(0).default(0),
      annualDepreciation: z.number().min(0).default(0),
      deposit: z.number().min(0).optional(),
    })
    .optional(),
});

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

interface PropertyROIResult {
  // Yield metrics
  grossYield: number;
  netYield: number;
  cashOnCashReturn: number;

  // Position metrics
  equity: number;
  lvr: number;
  capitalGrowth: number;
  capitalGrowthPercent: number;

  // Cashflow metrics
  annualRent: number;
  annualExpenses: number;
  annualInterest: number;
  netOperatingIncome: number;
  cashflowBeforeTax: number;
  cashflowAfterDepreciation: number;
  isCashflowPositive: boolean;

  // Gearing
  negativeGearingBenefit: number;
  totalReturn: number;
  totalReturnPercent: number;
}

function calculatePropertyROI(
  currentValue: number,
  purchasePrice: number,
  annualRent: number,
  annualExpenses: number,
  loanBalance: number,
  annualInterest: number,
  annualDepreciation: number,
  deposit: number
): PropertyROIResult {
  // Yield calculations
  const grossYield = currentValue > 0 ? (annualRent / currentValue) * 100 : 0;

  const netOperatingIncome = annualRent - annualExpenses;
  const netYield = currentValue > 0 ? (netOperatingIncome / currentValue) * 100 : 0;

  // Equity and LVR
  const equity = currentValue - loanBalance;
  const lvr = currentValue > 0 ? (loanBalance / currentValue) * 100 : 0;

  // Capital growth
  const capitalGrowth = currentValue - purchasePrice;
  const capitalGrowthPercent = purchasePrice > 0 ? (capitalGrowth / purchasePrice) * 100 : 0;

  // Cashflow
  const cashflowBeforeTax = netOperatingIncome - annualInterest;
  const cashflowAfterDepreciation = cashflowBeforeTax + annualDepreciation; // Depreciation is non-cash
  const isCashflowPositive = cashflowBeforeTax > 0;

  // Negative gearing benefit (simplified at 37% marginal rate)
  const marginalTaxRate = 0.37;
  const negativeGearingBenefit =
    cashflowBeforeTax < 0 ? Math.abs(cashflowBeforeTax) * marginalTaxRate : 0;

  // Cash on cash return (based on initial deposit/equity invested)
  const initialInvestment = deposit || purchasePrice - loanBalance + purchasePrice * 0.05; // Assume 5% costs if no deposit provided
  const annualCashReturn = cashflowBeforeTax + negativeGearingBenefit;
  const cashOnCashReturn =
    initialInvestment > 0 ? (annualCashReturn / initialInvestment) * 100 : 0;

  // Total return (cash + growth)
  const totalReturn = annualCashReturn + capitalGrowth;
  const totalReturnPercent = initialInvestment > 0 ? (totalReturn / initialInvestment) * 100 : 0;

  return {
    grossYield: Math.round(grossYield * 100) / 100,
    netYield: Math.round(netYield * 100) / 100,
    cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
    equity: Math.round(equity * 100) / 100,
    lvr: Math.round(lvr * 100) / 100,
    capitalGrowth: Math.round(capitalGrowth * 100) / 100,
    capitalGrowthPercent: Math.round(capitalGrowthPercent * 100) / 100,
    annualRent: Math.round(annualRent * 100) / 100,
    annualExpenses: Math.round(annualExpenses * 100) / 100,
    annualInterest: Math.round(annualInterest * 100) / 100,
    netOperatingIncome: Math.round(netOperatingIncome * 100) / 100,
    cashflowBeforeTax: Math.round(cashflowBeforeTax * 100) / 100,
    cashflowAfterDepreciation: Math.round(cashflowAfterDepreciation * 100) / 100,
    isCashflowPositive,
    negativeGearingBenefit: Math.round(negativeGearingBenefit * 100) / 100,
    totalReturn: Math.round(totalReturn * 100) / 100,
    totalReturnPercent: Math.round(totalReturnPercent * 100) / 100,
  };
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();

      // Validate input
      const parseResult = propertyROISchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: parseResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const input = parseResult.data;
      let propertyData = input.propertyData;

      // Fetch from database if propertyId provided
      if (input.propertyId && !propertyData) {
        const property = await prisma.property.findFirst({
          where: {
            id: input.propertyId,
            userId: authReq.user!.userId,
          },
          include: {
            loans: {
              include: { offsetAccount: true },
            },
            income: true,
            expenses: true,
            depreciationSchedules: true,
          },
        });

        if (!property) {
          return NextResponse.json({ error: 'Property not found' }, { status: 404 });
        }

        // Calculate annual rent
        const annualRent = property.income.reduce(
          (sum: number, i: any) => sum + toAnnual(i.amount, i.frequency as Frequency),
          0
        );

        // Calculate annual expenses
        const annualExpenses = property.expenses.reduce(
          (sum: number, e: any) => sum + toAnnual(e.amount, e.frequency as Frequency),
          0
        );

        // Calculate loan balance and interest
        const loanBalance = property.loans.reduce((sum: number, l: any) => sum + l.principal, 0);
        const annualInterest = property.loans.reduce((sum: number, l: any) => {
          const effectivePrincipal = Math.max(0, l.principal - (l.offsetAccount?.currentBalance || 0));
          return sum + effectivePrincipal * l.interestRateAnnual;
        }, 0);

        // Calculate depreciation
        const annualDepreciation = property.depreciationSchedules.reduce(
          (sum: number, d: any) => sum + d.cost * (d.rate / 100),
          0
        );

        propertyData = {
          currentValue: property.currentValue,
          purchasePrice: property.purchasePrice,
          purchaseDate: property.purchaseDate.toISOString(),
          annualRent,
          annualExpenses,
          loanBalance,
          annualInterest,
          annualDepreciation,
        };
      }

      if (!propertyData) {
        return NextResponse.json(
          { error: 'Either propertyId or propertyData must be provided' },
          { status: 400 }
        );
      }

      // Calculate ROI
      const result = calculatePropertyROI(
        propertyData.currentValue,
        propertyData.purchasePrice,
        propertyData.annualRent,
        propertyData.annualExpenses,
        propertyData.loanBalance,
        propertyData.annualInterest,
        propertyData.annualDepreciation,
        propertyData.deposit || 0
      );

      // Diagnostics
      const diagnostics: { warnings: string[]; assumptions: string[] } = {
        warnings: [],
        assumptions: [],
      };

      if (result.lvr > 80) {
        diagnostics.warnings.push('LVR exceeds 80% - may require LMI');
      }

      if (result.grossYield < 3) {
        diagnostics.warnings.push('Gross yield below 3% - below market average');
      }

      if (!result.isCashflowPositive && result.negativeGearingBenefit === 0) {
        diagnostics.warnings.push('Negative cashflow without tax benefits');
      }

      diagnostics.assumptions.push('Marginal tax rate assumed at 37%');
      diagnostics.assumptions.push('All expenses included in calculations');
      if (!propertyData.deposit) {
        diagnostics.assumptions.push('Initial investment estimated (5% purchase costs + equity)');
      }

      const response = {
        input: {
          currentValue: propertyData.currentValue,
          purchasePrice: propertyData.purchasePrice,
          loanBalance: propertyData.loanBalance,
          annualRent: propertyData.annualRent,
          annualExpenses: propertyData.annualExpenses,
        },
        output: result,
        diagnostics,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Property ROI calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
