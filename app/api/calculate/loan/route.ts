/**
 * Loan Calculation API
 * POST /api/calculate/loan
 *
 * Calculate loan amortisation, repayments, and projections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/middleware';

// =============================================================================
// REQUEST SCHEMA
// =============================================================================

const loanCalculationSchema = z.object({
  principal: z.number().positive('Principal must be positive'),
  interestRate: z.number().min(0).max(1, 'Interest rate should be decimal (e.g., 0.06 for 6%)'),
  termMonths: z.number().int().positive('Term must be positive'),
  type: z.enum(['PI', 'IO']).default('PI'),
  offsetBalance: z.number().min(0).default(0),
  extraRepayment: z.number().min(0).default(0),
  frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY']).default('MONTHLY'),
});

// =============================================================================
// CALCULATION FUNCTIONS
// =============================================================================

interface AmortisationRow {
  period: number;
  date: string;
  openingBalance: number;
  payment: number;
  principal: number;
  interest: number;
  closingBalance: number;
}

function calculateMonthlyRepaymentPI(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (termMonths <= 0 || annualRate <= 0) return principal;

  const monthlyRate = annualRate / 12;
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return principal * ((monthlyRate * factor) / (factor - 1));
}

function calculateMonthlyRepaymentIO(
  principal: number,
  annualRate: number,
  offsetBalance: number = 0
): number {
  const effectivePrincipal = Math.max(0, principal - offsetBalance);
  return effectivePrincipal * (annualRate / 12);
}

function generateAmortisationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
  offsetBalance: number,
  extraRepayment: number,
  isIO: boolean
): AmortisationRow[] {
  const schedule: AmortisationRow[] = [];
  let balance = principal;
  const monthlyRate = annualRate / 12;
  const startDate = new Date();

  const basePayment = isIO
    ? calculateMonthlyRepaymentIO(principal, annualRate, offsetBalance)
    : calculateMonthlyRepaymentPI(principal, annualRate, termMonths);

  const totalPayment = basePayment + extraRepayment;

  for (let period = 1; period <= termMonths && balance > 0.01; period++) {
    const date = new Date(startDate);
    date.setMonth(date.getMonth() + period);

    const effectiveBalance = Math.max(0, balance - offsetBalance);
    const interest = effectiveBalance * monthlyRate;

    let principalPaid: number;
    let payment: number;

    if (isIO) {
      // Interest-only: payment covers interest, extra goes to principal
      payment = Math.min(interest + extraRepayment, balance + interest);
      principalPaid = Math.min(extraRepayment, balance);
    } else {
      // P&I: payment covers interest + principal
      payment = Math.min(totalPayment, balance + interest);
      principalPaid = Math.min(payment - interest, balance);
    }

    const closingBalance = Math.max(0, balance - principalPaid);

    schedule.push({
      period,
      date: date.toISOString().split('T')[0],
      openingBalance: Math.round(balance * 100) / 100,
      payment: Math.round(payment * 100) / 100,
      principal: Math.round(principalPaid * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      closingBalance: Math.round(closingBalance * 100) / 100,
    });

    balance = closingBalance;
  }

  return schedule;
}

function convertToFrequency(monthlyAmount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY':
      return (monthlyAmount * 12) / 52;
    case 'FORTNIGHTLY':
      return (monthlyAmount * 12) / 26;
    case 'MONTHLY':
    default:
      return monthlyAmount;
  }
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async () => {
    try {
      const body = await request.json();

      // Validate input
      const parseResult = loanCalculationSchema.safeParse(body);
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
      const isIO = input.type === 'IO';

      // Calculate base repayment
      const monthlyRepayment = isIO
        ? calculateMonthlyRepaymentIO(input.principal, input.interestRate, input.offsetBalance)
        : calculateMonthlyRepaymentPI(input.principal, input.interestRate, input.termMonths);

      // Generate amortisation schedule
      const schedule = generateAmortisationSchedule(
        input.principal,
        input.interestRate,
        input.termMonths,
        input.offsetBalance,
        input.extraRepayment,
        isIO
      );

      // Calculate totals
      const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
      const totalPayments = schedule.reduce((sum, row) => sum + row.payment, 0);
      const actualTermMonths = schedule.length;
      const payoffDate = schedule.length > 0 ? schedule[schedule.length - 1].date : null;

      // Calculate savings from extra repayments
      const baseSchedule = generateAmortisationSchedule(
        input.principal,
        input.interestRate,
        input.termMonths,
        input.offsetBalance,
        0,
        isIO
      );
      const baseInterest = baseSchedule.reduce((sum, row) => sum + row.interest, 0);
      const interestSaved = baseInterest - totalInterest;
      const monthsSaved = baseSchedule.length - actualTermMonths;

      // Diagnostics
      const diagnostics: { warnings: string[]; assumptions: string[] } = {
        warnings: [],
        assumptions: [],
      };

      if (isIO && input.extraRepayment === 0) {
        diagnostics.warnings.push(
          'Interest-only loan with no extra repayments will never pay off principal'
        );
      }

      if (input.offsetBalance >= input.principal) {
        diagnostics.warnings.push('Offset balance equals or exceeds principal - no interest charged');
      }

      if (input.interestRate > 0.15) {
        diagnostics.warnings.push('Interest rate appears unusually high');
      }

      diagnostics.assumptions.push('Monthly compounding assumed');
      diagnostics.assumptions.push('No rate changes during loan term');
      if (input.offsetBalance > 0) {
        diagnostics.assumptions.push('Offset balance assumed constant');
      }

      const response = {
        input: {
          principal: input.principal,
          interestRate: input.interestRate,
          termMonths: input.termMonths,
          type: input.type,
          offsetBalance: input.offsetBalance,
          extraRepayment: input.extraRepayment,
          frequency: input.frequency,
        },
        output: {
          monthlyRepayment: Math.round(monthlyRepayment * 100) / 100,
          frequencyRepayment: Math.round(convertToFrequency(monthlyRepayment, input.frequency) * 100) / 100,
          totalInterest: Math.round(totalInterest * 100) / 100,
          totalPayments: Math.round(totalPayments * 100) / 100,
          actualTermMonths,
          payoffDate,
          interestSaved: Math.round(interestSaved * 100) / 100,
          monthsSaved,
          effectivePrincipal: Math.round((input.principal - input.offsetBalance) * 100) / 100,
          amortisationSchedule: schedule.slice(0, 60), // First 5 years
        },
        diagnostics,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('Loan calculation error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
