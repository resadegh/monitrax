import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

// Helper to normalize amount to annual
function normalizeToAnnual(amount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY': return amount * 52;
    case 'FORTNIGHTLY': return amount * 26;
    case 'MONTHLY': return amount * 12;
    case 'ANNUAL': return amount;
    default: return amount * 12;
  }
}

// Helper to normalize amount to monthly
function normalizeToMonthly(amount: number, frequency: string): number {
  return normalizeToAnnual(amount, frequency) / 12;
}

// Calculate rental yield
function calculateRentalYield(annualRent: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return (annualRent / propertyValue) * 100;
}

// Calculate LVR
function calculateLVR(loanBalance: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return (loanBalance / propertyValue) * 100;
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch all user data in parallel
      const [properties, loans, accounts, income, expenses, investmentAccounts] = await Promise.all([
        prisma.property.findMany({
          where: { userId },
          include: {
            loans: true,
            income: true,
            expenses: true,
            depreciationSchedules: true,
          },
        }),
        prisma.loan.findMany({
          where: { userId },
          include: {
            property: true,
            offsetAccount: true,
            expenses: true,
          },
        }),
        prisma.account.findMany({
          where: { userId },
        }),
        prisma.income.findMany({
          where: { userId },
          include: {
            property: true,
            investmentAccount: true,
          },
        }),
        prisma.expense.findMany({
          where: { userId },
          include: {
            property: true,
            loan: true,
            investmentAccount: true,
          },
        }),
        prisma.investmentAccount.findMany({
          where: { userId },
          include: {
            holdings: true,
            transactions: true,
            incomes: true,
            expenses: true,
          },
        }),
      ]);

      // Calculate totals
      const totalPropertyValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
      const totalAccountBalances = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

      // Calculate investment value (units * averagePrice for each holding)
      const totalInvestmentValue = investmentAccounts.reduce((sum, acc) => {
        return sum + acc.holdings.reduce((holdingSum, h) => holdingSum + (h.units * h.averagePrice), 0);
      }, 0);

      const totalAssets = totalPropertyValue + totalAccountBalances + totalInvestmentValue;
      const totalLiabilities = loans.reduce((sum, l) => sum + l.principal, 0);
      const netWorth = totalAssets - totalLiabilities;

      // Cashflow calculations
      const totalAnnualIncome = income.reduce((sum, i) => sum + normalizeToAnnual(i.amount, i.frequency), 0);
      const totalAnnualExpenses = expenses.reduce((sum, e) => sum + normalizeToAnnual(e.amount, e.frequency), 0);
      const monthlyNetCashflow = (totalAnnualIncome - totalAnnualExpenses) / 12;
      const annualNetCashflow = totalAnnualIncome - totalAnnualExpenses;

      // Property details with linked data
      const propertySnapshots = properties.map(property => {
        const propertyLoans = loans.filter(l => l.propertyId === property.id);
        const totalLoanBalance = propertyLoans.reduce((sum, l) => sum + l.principal, 0);
        const equity = property.currentValue - totalLoanBalance;
        const lvr = calculateLVR(totalLoanBalance, property.currentValue);

        // Calculate rental income for this property
        const propertyIncome = income.filter(i => i.propertyId === property.id);
        const annualRentalIncome = propertyIncome
          .filter(i => i.type === 'RENT' || i.type === 'RENTAL')
          .reduce((sum, i) => sum + normalizeToAnnual(i.amount, i.frequency), 0);
        const rentalYield = calculateRentalYield(annualRentalIncome, property.currentValue);

        // Calculate property expenses
        const propertyExpenses = expenses.filter(e => e.propertyId === property.id);
        const annualPropertyExpenses = propertyExpenses.reduce((sum, e) => sum + normalizeToAnnual(e.amount, e.frequency), 0);

        // Calculate loan interest for this property
        const annualInterest = propertyLoans.reduce((sum, l) => {
          return sum + (l.principal * l.interestRateAnnual);
        }, 0);

        const propertyCashflow = annualRentalIncome - annualPropertyExpenses - annualInterest;

        return {
          id: property.id,
          name: property.name,
          type: property.type,
          address: property.address,
          marketValue: property.currentValue,
          purchasePrice: property.purchasePrice,
          loans: propertyLoans.map(l => ({
            id: l.id,
            name: l.name,
            principal: l.principal,
            interestRate: l.interestRateAnnual,
            rateType: l.rateType,
            isInterestOnly: l.isInterestOnly,
          })),
          equity,
          lvr: Math.round(lvr * 100) / 100,
          rentalYield: Math.round(rentalYield * 100) / 100,
          cashflow: {
            annualIncome: annualRentalIncome,
            annualExpenses: annualPropertyExpenses,
            annualInterest,
            annualNet: propertyCashflow,
            monthlyNet: propertyCashflow / 12,
          },
          depreciationSchedules: property.depreciationSchedules.length,
        };
      });

      // Investment accounts snapshot
      const investmentSnapshots = investmentAccounts.map(acc => {
        const accountValue = acc.holdings.reduce((sum, h) => sum + (h.units * h.averagePrice), 0);
        return {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          platform: acc.platform,
          currency: acc.currency,
          totalValue: accountValue,
          holdings: acc.holdings.map(h => ({
            id: h.id,
            ticker: h.ticker,
            type: h.type,
            units: h.units,
            averagePrice: h.averagePrice,
            currentValue: h.units * h.averagePrice,
            frankingPercentage: h.frankingPercentage,
          })),
          transactionCount: acc.transactions.length,
        };
      });

      // Tax exposure (placeholder - would need full tax calculation)
      // TODO: Integrate with full tax engine when available
      const taxableIncome = income
        .filter(i => i.isTaxable)
        .reduce((sum, i) => sum + normalizeToAnnual(i.amount, i.frequency), 0);

      const deductibleExpenses = expenses
        .filter(e => e.isTaxDeductible)
        .reduce((sum, e) => sum + normalizeToAnnual(e.amount, e.frequency), 0);

      // Estimated CGT exposure (unrealised gains on investments)
      // TODO: Implement proper CGT calculation with cost base tracking
      const estimatedUnrealisedGains = 0; // Placeholder

      const snapshot = {
        generatedAt: new Date().toISOString(),
        userId,

        // Summary
        netWorth,
        totalAssets,
        totalLiabilities,

        // Cashflow
        cashflow: {
          totalIncome: totalAnnualIncome,
          totalExpenses: totalAnnualExpenses,
          monthlyNetCashflow: Math.round(monthlyNetCashflow * 100) / 100,
          annualNetCashflow: Math.round(annualNetCashflow * 100) / 100,
          savingsRate: totalAnnualIncome > 0
            ? Math.round((annualNetCashflow / totalAnnualIncome) * 10000) / 100
            : 0,
        },

        // Assets breakdown
        assets: {
          properties: {
            count: properties.length,
            totalValue: totalPropertyValue,
          },
          accounts: {
            count: accounts.length,
            totalValue: totalAccountBalances,
          },
          investments: {
            count: investmentAccounts.length,
            totalValue: totalInvestmentValue,
          },
        },

        // Liabilities breakdown
        liabilities: {
          loans: {
            count: loans.length,
            totalValue: totalLiabilities,
          },
        },

        // Gearing metrics
        gearing: {
          portfolioLVR: totalAssets > 0
            ? Math.round((totalLiabilities / totalAssets) * 10000) / 100
            : 0,
          debtToIncome: totalAnnualIncome > 0
            ? Math.round((totalLiabilities / totalAnnualIncome) * 100) / 100
            : 0,
        },

        // Property details
        properties: propertySnapshots,

        // Investment details
        investments: {
          totalValue: totalInvestmentValue,
          accounts: investmentSnapshots,
        },

        // Tax exposure (estimates)
        taxExposure: {
          taxableIncome,
          deductibleExpenses,
          estimatedTaxableIncome: taxableIncome - deductibleExpenses,
          projectedTax: 0, // TODO: Calculate using tax engine
          cgtExposure: estimatedUnrealisedGains,
          _note: 'Tax projections are estimates. Use /api/calculate/tax for accurate calculations.',
        },
      };

      return NextResponse.json(snapshot);
    } catch (error) {
      console.error('Portfolio snapshot error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
