import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { runDebtPlan, LoanInput, PlannerSettings } from '@/lib/planning/debtPlanner';

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const settings: PlannerSettings = body.settings;

      if (!settings || !settings.strategy || !settings.surplusPerPeriod || !settings.surplusFrequency) {
        return NextResponse.json(
          { error: 'Missing required planner settings' },
          { status: 400 }
        );
      }

      // Fetch user's loans with offset account balances
      const loans = await prisma.loan.findMany({
        where: { userId: authReq.user!.userId },
        include: { offsetAccount: true },
      });

      if (loans.length === 0) {
        return NextResponse.json(
          { error: 'No loans found for user' },
          { status: 404 }
        );
      }

      // Convert to LoanInput format
      const loanInputs: LoanInput[] = loans.map((loan) => ({
        id: loan.id,
        name: loan.name,
        type: loan.type,
        principal: loan.principal,
        interestRateAnnual: loan.interestRateAnnual,
        rateType: loan.rateType,
        fixedExpiry: loan.fixedExpiry,
        isInterestOnly: loan.isInterestOnly,
        termMonthsRemaining: loan.termMonthsRemaining,
        minRepayment: loan.minRepayment,
        repaymentFrequency: loan.repaymentFrequency,
        offsetBalance: loan.offsetAccount?.currentBalance || 0,
        extraRepaymentCap: loan.extraRepaymentCap,
      }));

      // Run debt planner
      const planResult = runDebtPlan(loanInputs, settings);

      return NextResponse.json({ plan: planResult });
    } catch (error) {
      console.error('Debt planner error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
