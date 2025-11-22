/**
 * Debug API - Portfolio Intelligence Engine
 * Internal QA endpoint for testing Phase 4 intelligence engine.
 *
 * DO NOT expose in production without proper authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  generatePortfolioIntelligence,
  PortfolioInput,
  PropertyInput,
  LoanInput,
  AccountInput,
  IncomeInput,
  ExpenseInput,
  InvestmentInput
} from '@/lib/intelligence/portfolioEngine';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch all user data
      const [
        properties,
        loans,
        accounts,
        income,
        expenses,
        investmentAccounts
      ] = await Promise.all([
        prisma.property.findMany({ where: { userId } }),
        prisma.loan.findMany({ where: { userId } }),
        prisma.account.findMany({ where: { userId } }),
        prisma.income.findMany({ where: { userId } }),
        prisma.expense.findMany({ where: { userId } }),
        prisma.investmentAccount.findMany({
          where: { userId },
          include: { holdings: true }
        })
      ]);

      // Transform to PortfolioInput format
      const portfolioInput: PortfolioInput = {
        properties: properties.map((p): PropertyInput => ({
          id: p.id,
          name: p.name,
          type: p.type as 'HOME' | 'INVESTMENT',
          currentValue: p.currentValue,
          purchasePrice: p.purchasePrice,
          purchaseDate: p.purchaseDate
        })),

        loans: loans.map((l): LoanInput => {
          // Find offset account balance if linked
          const offsetAccount = l.offsetAccountId
            ? accounts.find(a => a.id === l.offsetAccountId)
            : null;

          return {
            id: l.id,
            name: l.name,
            type: l.type as 'HOME' | 'INVESTMENT',
            principal: l.principal,
            interestRate: l.interestRateAnnual,
            isInterestOnly: l.isInterestOnly,
            propertyId: l.propertyId || undefined,
            offsetBalance: offsetAccount?.currentBalance || 0
          };
        }),

        accounts: accounts.map((a): AccountInput => ({
          id: a.id,
          name: a.name,
          type: a.type as 'OFFSET' | 'SAVINGS' | 'TRANSACTIONAL' | 'CREDIT_CARD',
          currentBalance: a.currentBalance
        })),

        income: income.map((i): IncomeInput => ({
          id: i.id,
          name: i.name,
          type: i.type as 'SALARY' | 'RENT' | 'INVESTMENT' | 'OTHER',
          amount: i.amount,
          frequency: i.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL',
          isTaxable: i.isTaxable,
          propertyId: i.propertyId || undefined
        })),

        expenses: expenses.map((e): ExpenseInput => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          frequency: e.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL',
          isEssential: e.isEssential,
          isTaxDeductible: e.isTaxDeductible,
          propertyId: e.propertyId || undefined
        })),

        investments: investmentAccounts.flatMap(account =>
          account.holdings.map((h): InvestmentInput => ({
            id: h.id,
            ticker: h.ticker,
            units: h.units,
            averagePrice: h.averagePrice,
            currentPrice: h.averagePrice, // Would need market data for current price
            type: h.type as 'SHARE' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO'
          }))
        )
      };

      // Generate intelligence report
      const intelligence = generatePortfolioIntelligence(portfolioInput);

      return NextResponse.json({
        success: true,
        userId,
        dataSnapshot: {
          propertiesCount: properties.length,
          loansCount: loans.length,
          accountsCount: accounts.length,
          incomeStreamsCount: income.length,
          expensesCount: expenses.length,
          investmentHoldingsCount: portfolioInput.investments.length
        },
        intelligence
      });
    } catch (error) {
      console.error('Intelligence engine error:', error);
      return NextResponse.json(
        {
          error: 'Intelligence engine failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
  });
}
