/**
 * TEST DATA EXPORTER
 * Exports all calculated values for external verification
 *
 * @module lib/testing/exporter
 */

import { PrismaClient } from '@prisma/client';
import type {
  TestExportOutput,
  NetWorthOutput,
  CashflowOutput,
  GearingOutput,
  PropertyMetricsOutput,
  LoanMetricsOutput,
  InvestmentMetricsOutput,
  DepreciationOutput,
  DebtPlanOutput,
  LinkageHealthOutput,
  InsightsOutput,
  TaxExposureOutput,
} from './types';

// =============================================================================
// FREQUENCY HELPERS
// =============================================================================

type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'HALF_YEARLY';

function toMonthly(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'WEEKLY':
      return (amount * 52) / 12;
    case 'FORTNIGHTLY':
      return (amount * 26) / 12;
    case 'MONTHLY':
      return amount;
    case 'QUARTERLY':
      return amount / 3;
    case 'HALF_YEARLY':
      return amount / 6;
    case 'ANNUAL':
      return amount / 12;
    default:
      return amount;
  }
}

function toAnnual(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'WEEKLY':
      return amount * 52;
    case 'FORTNIGHTLY':
      return amount * 26;
    case 'MONTHLY':
      return amount * 12;
    case 'QUARTERLY':
      return amount * 4;
    case 'HALF_YEARLY':
      return amount * 2;
    case 'ANNUAL':
      return amount;
    default:
      return amount;
  }
}

// =============================================================================
// EXPORTER CLASS
// =============================================================================

export class TestScenarioExporter {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Export all calculated data for a user
   */
  async exportScenario(
    userId: string,
    scenarioId: string,
    scenarioName: string
  ): Promise<TestExportOutput> {
    // Fetch all data
    const [
      properties,
      loans,
      accounts,
      income,
      expenses,
      investmentAccounts,
      depreciationSchedules,
    ] = await Promise.all([
      this.prisma.property.findMany({
        where: { userId },
        include: {
          loans: { include: { offsetAccount: true } },
          income: true,
          expenses: true,
          depreciationSchedules: true,
        },
      }),
      this.prisma.loan.findMany({
        where: { userId },
        include: { property: true, offsetAccount: true },
      }),
      this.prisma.account.findMany({
        where: { userId },
      }),
      this.prisma.income.findMany({
        where: { userId },
        include: { property: true, investmentAccount: true },
      }),
      this.prisma.expense.findMany({
        where: { userId },
        include: { property: true, loan: true },
      }),
      this.prisma.investmentAccount.findMany({
        where: { userId },
        include: {
          holdings: { include: { transactions: true } },
          transactions: true,
        },
      }),
      this.prisma.depreciationSchedule.findMany({
        where: { property: { userId } },
        include: { property: true },
      }),
    ]);

    // Calculate all outputs
    const netWorth = this.calculateNetWorth(properties, loans, accounts, investmentAccounts);
    const cashflow = this.calculateCashflow(income, expenses, loans);
    const gearing = this.calculateGearing(properties, loans, income);
    const propertyMetrics = this.calculatePropertyMetrics(properties, loans, income, expenses);
    const loanMetrics = this.calculateLoanMetrics(loans);
    const investmentMetrics = this.calculateInvestmentMetrics(investmentAccounts);
    const depreciation = this.calculateDepreciation(depreciationSchedules, properties);
    const linkageHealth = this.calculateLinkageHealth(
      properties,
      loans,
      accounts,
      income,
      expenses,
      investmentAccounts
    );
    const insights = this.generateInsights(
      properties,
      loans,
      accounts,
      income,
      expenses,
      investmentAccounts,
      netWorth,
      cashflow,
      gearing
    );
    const taxExposure = this.calculateTaxExposure(income, expenses, depreciation);

    return {
      meta: {
        exportedAt: new Date().toISOString(),
        scenarioId,
        scenarioName,
        userId,
        version: '1.0',
      },
      inputSummary: {
        properties: properties.length,
        loans: loans.length,
        accounts: accounts.length,
        income: income.length,
        expenses: expenses.length,
        investmentAccounts: investmentAccounts.length,
        holdings: investmentAccounts.reduce((sum: number, a: typeof investmentAccounts[0]) => sum + a.holdings.length, 0),
        investmentTransactions: investmentAccounts.reduce(
          (sum: number, a: typeof investmentAccounts[0]) => sum + a.transactions.length,
          0
        ),
        depreciationSchedules: depreciationSchedules.length,
      },
      calculatedOutputs: {
        netWorth,
        cashflow,
        gearing,
        propertyMetrics,
        loanMetrics,
        investmentMetrics,
        depreciation,
        linkageHealth,
        insights,
        taxExposure,
      },
      rawSnapshot: {
        properties,
        loans,
        accounts,
        income,
        expenses,
        investmentAccounts,
        depreciationSchedules,
      },
    };
  }

  /**
   * Calculate net worth
   */
  private calculateNetWorth(
    properties: any[],
    loans: any[],
    accounts: any[],
    investmentAccounts: any[]
  ): NetWorthOutput {
    // Assets
    const propertyValue = properties.reduce((sum, p) => sum + Number(p.currentValue), 0);
    const investmentValue = investmentAccounts.reduce((sum, a) => {
      const holdingsValue = a.holdings.reduce(
        (hSum: number, h: any) => hSum + Number(h.units) * Number(h.currentPrice || h.averagePrice),
        0
      );
      return sum + holdingsValue + Number(a.cashBalance || 0);
    }, 0);
    const accountValue = accounts
      .filter((a) => a.type !== 'CREDIT_CARD')
      .reduce((sum, a) => sum + Number(a.currentBalance), 0);

    const totalAssets = propertyValue + investmentValue + accountValue;

    // Liabilities
    const loanValue = loans.reduce((sum, l) => sum + Number(l.principal), 0);
    const creditCardValue = accounts
      .filter((a) => a.type === 'CREDIT_CARD')
      .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance)), 0);

    const totalLiabilities = loanValue + creditCardValue;

    return {
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      assetBreakdown: {
        properties: propertyValue,
        investments: investmentValue,
        accounts: accountValue,
        personalAssets: 0, // Would need Asset model
      },
      liabilityBreakdown: {
        loans: loanValue,
        creditCards: creditCardValue,
      },
    };
  }

  /**
   * Calculate cashflow
   */
  private calculateCashflow(income: any[], expenses: any[], loans: any[]): CashflowOutput {
    // Income calculations
    let grossIncome = 0;
    let netIncome = 0;
    let paygWithholding = 0;
    const incomeBreakdown: Record<string, number> = {};

    for (const inc of income) {
      const annualAmount = toAnnual(Number(inc.amount), inc.frequency as Frequency);
      grossIncome += annualAmount;

      if (inc.type === 'SALARY' && inc.salaryType === 'GROSS' && inc.paygWithholding) {
        paygWithholding += Number(inc.paygWithholding);
        netIncome += annualAmount - Number(inc.paygWithholding);
      } else if (inc.type === 'SALARY' && inc.salaryType === 'NET') {
        netIncome += annualAmount;
        // Estimate PAYG
        const estimatedGross = inc.grossAmount ? Number(inc.grossAmount) : annualAmount * 1.3;
        paygWithholding += estimatedGross - annualAmount;
        grossIncome = grossIncome - annualAmount + estimatedGross;
      } else {
        netIncome += annualAmount;
      }

      incomeBreakdown[inc.type] = (incomeBreakdown[inc.type] || 0) + annualAmount;
    }

    // Expense calculations
    let totalExpenses = 0;
    const expenseBreakdown: Record<string, number> = {};

    for (const exp of expenses) {
      const annualAmount = toAnnual(Number(exp.amount), exp.frequency as Frequency);
      totalExpenses += annualAmount;
      expenseBreakdown[exp.category] = (expenseBreakdown[exp.category] || 0) + annualAmount;
    }

    // Loan repayments
    let totalLoanRepayments = 0;
    for (const loan of loans) {
      const annualRepayment = toAnnual(
        Number(loan.minRepayment),
        loan.repaymentFrequency as Frequency
      );
      totalLoanRepayments += annualRepayment;
    }

    const annualNetCashflow = netIncome - totalExpenses - totalLoanRepayments;
    const monthlyNetCashflow = annualNetCashflow / 12;
    const savingsRate = netIncome > 0 ? (annualNetCashflow / netIncome) * 100 : 0;

    return {
      grossIncome,
      netIncome,
      paygWithholding,
      totalExpenses,
      totalLoanRepayments,
      monthlyNetCashflow,
      annualNetCashflow,
      savingsRate,
      incomeBreakdown,
      expenseBreakdown,
    };
  }

  /**
   * Calculate gearing metrics
   */
  private calculateGearing(properties: any[], loans: any[], income: any[]): GearingOutput {
    const totalPropertyValue = properties.reduce((sum, p) => sum + Number(p.currentValue), 0);
    const totalLoanValue = loans.reduce((sum, l) => sum + Number(l.principal), 0);
    const totalAnnualIncome = income.reduce(
      (sum, i) => sum + toAnnual(Number(i.amount), i.frequency as Frequency),
      0
    );

    const portfolioLVR = totalPropertyValue > 0 ? totalLoanValue / totalPropertyValue : 0;
    const debtToIncomeRatio = totalAnnualIncome > 0 ? totalLoanValue / totalAnnualIncome : 0;
    const debtToAssetRatio = totalPropertyValue > 0 ? totalLoanValue / totalPropertyValue : 0;

    // Per-property LVRs
    const propertyLVRs = properties.map((p) => {
      const propertyLoans = loans.filter((l) => l.propertyId === p.id);
      const propertyLoanTotal = propertyLoans.reduce((sum, l) => sum + Number(l.principal), 0);
      const lvr = Number(p.currentValue) > 0 ? propertyLoanTotal / Number(p.currentValue) : 0;
      const equity = Number(p.currentValue) - propertyLoanTotal;

      return {
        propertyName: p.name,
        lvr,
        equity,
      };
    });

    return {
      portfolioLVR,
      debtToIncomeRatio,
      debtToAssetRatio,
      propertyLVRs,
    };
  }

  /**
   * Calculate per-property metrics
   */
  private calculatePropertyMetrics(
    properties: any[],
    loans: any[],
    income: any[],
    expenses: any[]
  ): PropertyMetricsOutput[] {
    return properties.map((p) => {
      const propertyLoans = loans.filter((l) => l.propertyId === p.id);
      const totalLoans = propertyLoans.reduce((sum, l) => sum + Number(l.principal), 0);
      const propertyIncome = income.filter((i) => i.propertyId === p.id);
      const propertyExpenses = expenses.filter((e) => e.propertyId === p.id);

      const annualIncome = propertyIncome.reduce(
        (sum, i) => sum + toAnnual(Number(i.amount), i.frequency as Frequency),
        0
      );
      const annualExpenses = propertyExpenses.reduce(
        (sum, e) => sum + toAnnual(Number(e.amount), e.frequency as Frequency),
        0
      );

      // Calculate interest
      let annualInterest = 0;
      let annualLoanRepayments = 0;
      for (const loan of propertyLoans) {
        const offsetBalance = loan.offsetAccount
          ? Number(loan.offsetAccount.currentBalance)
          : 0;
        const effectivePrincipal = Math.max(0, Number(loan.principal) - offsetBalance);
        annualInterest += effectivePrincipal * Number(loan.interestRateAnnual);
        annualLoanRepayments += toAnnual(
          Number(loan.minRepayment),
          loan.repaymentFrequency as Frequency
        );
      }

      const marketValue = Number(p.currentValue);
      const equity = marketValue - totalLoans;
      const lvr = marketValue > 0 ? totalLoans / marketValue : 0;
      const grossYield = marketValue > 0 ? annualIncome / marketValue : 0;
      const netYield = marketValue > 0 ? (annualIncome - annualExpenses - annualInterest) / marketValue : 0;
      const annualNetCashflow = annualIncome - annualExpenses - annualLoanRepayments;

      // Depreciation
      const annualDepreciation = p.depreciationSchedules
        ? p.depreciationSchedules.reduce((sum: number, d: any) => sum + Number(d.cost) * Number(d.rate), 0)
        : 0;

      return {
        propertyId: p.id,
        propertyName: p.name,
        marketValue,
        totalLoans,
        equity,
        lvr,
        grossYield,
        netYield,
        annualIncome,
        annualExpenses,
        annualInterest,
        annualLoanRepayments,
        annualNetCashflow,
        monthlyNetCashflow: annualNetCashflow / 12,
        annualDepreciation,
      };
    });
  }

  /**
   * Calculate per-loan metrics
   */
  private calculateLoanMetrics(loans: any[]): LoanMetricsOutput[] {
    return loans.map((loan) => {
      const principal = Number(loan.principal);
      const offsetBalance = loan.offsetAccount
        ? Number(loan.offsetAccount.currentBalance)
        : 0;
      const effectivePrincipal = Math.max(0, principal - offsetBalance);
      const interestRate = Number(loan.interestRateAnnual);

      const monthlyInterest = (effectivePrincipal * interestRate) / 12;
      const annualInterest = effectivePrincipal * interestRate;
      const monthlyRepayment = Number(loan.minRepayment);
      const annualRepayment = toAnnual(monthlyRepayment, loan.repaymentFrequency as Frequency);
      const interestSavedByOffset = (offsetBalance * interestRate);

      return {
        loanId: loan.id,
        loanName: loan.name,
        principal,
        effectivePrincipal,
        interestRate,
        monthlyInterest,
        annualInterest,
        monthlyRepayment,
        annualRepayment,
        offsetBalance,
        interestSavedByOffset,
      };
    });
  }

  /**
   * Calculate investment metrics
   */
  private calculateInvestmentMetrics(investmentAccounts: any[]): InvestmentMetricsOutput {
    let totalValue = 0;
    let totalCostBase = 0;

    const accounts = investmentAccounts.map((account) => {
      const holdings = account.holdings.map((h: any) => {
        const units = Number(h.units);
        const averagePrice = Number(h.averagePrice);
        const currentPrice = Number(h.currentPrice || h.averagePrice);
        const marketValue = units * currentPrice;
        const costBase = Number(h.totalCostBasis || units * averagePrice);
        const unrealisedGain = marketValue - costBase;
        const unrealisedGainPercent = costBase > 0 ? (unrealisedGain / costBase) * 100 : 0;

        totalValue += marketValue;
        totalCostBase += costBase;

        return {
          holdingId: h.id,
          ticker: h.ticker,
          units,
          averagePrice,
          currentPrice,
          marketValue,
          costBase,
          unrealisedGain,
          unrealisedGainPercent,
        };
      });

      const holdingsValue = holdings.reduce((sum: number, h: any) => sum + h.marketValue, 0);
      const cashBalance = Number(account.cashBalance || 0);
      totalValue += cashBalance;

      return {
        accountId: account.id,
        accountName: account.name,
        totalValue: holdingsValue + cashBalance,
        cashBalance,
        holdings,
      };
    });

    const totalUnrealisedGain = totalValue - totalCostBase;
    const totalUnrealisedGainPercent =
      totalCostBase > 0 ? (totalUnrealisedGain / totalCostBase) * 100 : 0;

    return {
      totalValue,
      totalCostBase,
      totalUnrealisedGain,
      totalUnrealisedGainPercent,
      accounts,
    };
  }

  /**
   * Calculate depreciation
   */
  private calculateDepreciation(schedules: any[], properties: any[]): DepreciationOutput {
    let totalDiv40 = 0;
    let totalDiv43 = 0;

    const byPropertyMap = new Map<string, any>();

    for (const schedule of schedules) {
      const annual = Number(schedule.cost) * Number(schedule.rate);
      if (schedule.category === 'DIV40') {
        totalDiv40 += annual;
      } else {
        totalDiv43 += annual;
      }

      const propertyId = schedule.propertyId;
      if (!byPropertyMap.has(propertyId)) {
        const property = properties.find((p) => p.id === propertyId);
        byPropertyMap.set(propertyId, {
          propertyId,
          propertyName: property?.name || 'Unknown',
          totalAnnual: 0,
          div40: 0,
          div43: 0,
          schedules: [],
        });
      }

      const propData = byPropertyMap.get(propertyId)!;
      propData.totalAnnual += annual;
      if (schedule.category === 'DIV40') {
        propData.div40 += annual;
      } else {
        propData.div43 += annual;
      }
      propData.schedules.push({
        assetName: schedule.assetName,
        category: schedule.category,
        method: schedule.method,
        originalCost: Number(schedule.cost),
        writtenDownValue: Number(schedule.cost), // Simplified - would need date calc
        annualDepreciation: annual,
      });
    }

    return {
      totalAnnualDepreciation: totalDiv40 + totalDiv43,
      totalDiv40,
      totalDiv43,
      byProperty: Array.from(byPropertyMap.values()),
    };
  }

  /**
   * Calculate linkage health
   */
  private calculateLinkageHealth(
    properties: any[],
    loans: any[],
    accounts: any[],
    income: any[],
    expenses: any[],
    investmentAccounts: any[]
  ): LinkageHealthOutput {
    const missingLinks: LinkageHealthOutput['missingLinks'] = [];
    const warnings: string[] = [];
    let orphanCount = 0;

    // Check loans without properties
    for (const loan of loans) {
      if (loan.type === 'INVESTMENT' && !loan.propertyId) {
        missingLinks.push({
          entityType: 'loan',
          entityId: loan.id,
          entityName: loan.name,
          missingLinkType: 'property',
        });
        orphanCount++;
      }
    }

    // Check rental income without properties
    for (const inc of income) {
      if ((inc.type === 'RENT' || inc.type === 'RENTAL') && !inc.propertyId) {
        missingLinks.push({
          entityType: 'income',
          entityId: inc.id,
          entityName: inc.name,
          missingLinkType: 'property',
        });
        orphanCount++;
      }
    }

    // Check investment income without account
    for (const inc of income) {
      if (inc.type === 'INVESTMENT' && !inc.investmentAccountId) {
        missingLinks.push({
          entityType: 'income',
          entityId: inc.id,
          entityName: inc.name,
          missingLinkType: 'investmentAccount',
        });
      }
    }

    // Check property expenses without property link
    for (const exp of expenses) {
      if (exp.sourceType === 'PROPERTY' && !exp.propertyId) {
        missingLinks.push({
          entityType: 'expense',
          entityId: exp.id,
          entityName: exp.name,
          missingLinkType: 'property',
        });
        orphanCount++;
      }
    }

    // Check investment accounts without holdings
    for (const account of investmentAccounts) {
      if (account.holdings.length === 0) {
        warnings.push(`Investment account "${account.name}" has no holdings`);
      }
    }

    // Calculate scores
    const totalEntities =
      properties.length +
      loans.length +
      accounts.length +
      income.length +
      expenses.length +
      investmentAccounts.length;
    const linkedEntities = totalEntities - orphanCount;
    const completenessScore = totalEntities > 0 ? (linkedEntities / totalEntities) * 100 : 100;

    // Cross-module consistency
    const linkedLoans = loans.filter((l) => l.propertyId).length;
    const linkedIncome = income.filter((i) => i.propertyId || i.investmentAccountId).length;
    const linkedExpenses = expenses.filter(
      (e) => e.propertyId || e.loanId || e.investmentAccountId
    ).length;
    const totalLinkable = loans.length + income.length + expenses.length;
    const totalLinked = linkedLoans + linkedIncome + linkedExpenses;
    const crossModuleConsistency = totalLinkable > 0 ? (totalLinked / totalLinkable) * 100 : 100;

    return {
      completenessScore,
      crossModuleConsistency,
      orphanCount,
      missingLinkCount: missingLinks.length,
      missingLinks,
      warnings,
    };
  }

  /**
   * Generate insights
   */
  private generateInsights(
    properties: any[],
    loans: any[],
    accounts: any[],
    income: any[],
    expenses: any[],
    investmentAccounts: any[],
    netWorth: NetWorthOutput,
    cashflow: CashflowOutput,
    gearing: GearingOutput
  ): InsightsOutput {
    const insights: InsightsOutput['topInsights'] = [];

    // High LVR check
    for (const prop of gearing.propertyLVRs) {
      if (prop.lvr > 0.9) {
        insights.push({
          id: `high-lvr-${prop.propertyName}`,
          severity: 'critical',
          category: 'RISK',
          title: 'High LVR Property',
          description: `${prop.propertyName} has LVR of ${(prop.lvr * 100).toFixed(1)}%`,
          affectedEntity: prop.propertyName,
        });
      } else if (prop.lvr > 0.8) {
        insights.push({
          id: `elevated-lvr-${prop.propertyName}`,
          severity: 'high',
          category: 'RISK',
          title: 'Elevated LVR Property',
          description: `${prop.propertyName} has LVR of ${(prop.lvr * 100).toFixed(1)}%`,
          affectedEntity: prop.propertyName,
        });
      }
    }

    // Negative cashflow
    if (cashflow.monthlyNetCashflow < 0) {
      insights.push({
        id: 'negative-cashflow',
        severity: 'critical',
        category: 'CASHFLOW',
        title: 'Negative Monthly Cashflow',
        description: `Monthly cashflow is -$${Math.abs(cashflow.monthlyNetCashflow).toFixed(0)}`,
      });
    }

    // Low savings rate
    if (cashflow.savingsRate < 10 && cashflow.savingsRate >= 0) {
      insights.push({
        id: 'low-savings-rate',
        severity: 'medium',
        category: 'CASHFLOW',
        title: 'Low Savings Rate',
        description: `Savings rate is only ${cashflow.savingsRate.toFixed(1)}%`,
      });
    }

    // Credit card debt
    if (netWorth.liabilityBreakdown.creditCards > 0) {
      insights.push({
        id: 'credit-card-debt',
        severity: 'high',
        category: 'DEBT',
        title: 'Credit Card Debt',
        description: `Outstanding credit card balance of $${netWorth.liabilityBreakdown.creditCards.toFixed(0)}`,
      });
    }

    // Interest-only loans
    const ioLoans = loans.filter((l) => l.isInterestOnly);
    if (ioLoans.length > 0) {
      insights.push({
        id: 'io-loans',
        severity: 'medium',
        category: 'DEBT',
        title: 'Interest-Only Loans',
        description: `${ioLoans.length} interest-only loan(s) - principal not reducing`,
      });
    }

    // Categorize by severity
    const bySeverity = {
      critical: insights.filter((i) => i.severity === 'critical').length,
      high: insights.filter((i) => i.severity === 'high').length,
      medium: insights.filter((i) => i.severity === 'medium').length,
      low: insights.filter((i) => i.severity === 'low').length,
    };

    // By category
    const byCategory: Record<string, number> = {};
    for (const insight of insights) {
      byCategory[insight.category] = (byCategory[insight.category] || 0) + 1;
    }

    return {
      totalCount: insights.length,
      bySeverity,
      byCategory,
      topInsights: insights.slice(0, 10),
    };
  }

  /**
   * Calculate tax exposure
   */
  private calculateTaxExposure(
    income: any[],
    expenses: any[],
    depreciation: DepreciationOutput
  ): TaxExposureOutput {
    let taxableIncome = 0;
    let frankingCredits = 0;
    let projectedPAYG = 0;

    for (const inc of income) {
      if (inc.isTaxable) {
        const annual = toAnnual(Number(inc.amount), inc.frequency as Frequency);
        taxableIncome += annual;

        // Franking credits
        if (inc.frankingPercentage) {
          const frankingRate = Number(inc.frankingPercentage) / 100;
          frankingCredits += annual * frankingRate * (0.3 / 0.7);
        }

        // PAYG
        if (inc.paygWithholding) {
          projectedPAYG += Number(inc.paygWithholding);
        }
      }
    }

    // Deductible expenses
    const deductibleExpenses = expenses
      .filter((e) => e.isTaxDeductible)
      .reduce((sum, e) => sum + toAnnual(Number(e.amount), e.frequency as Frequency), 0);

    const depreciationDeductions = depreciation.totalAnnualDepreciation;
    const estimatedTaxableIncome = taxableIncome - deductibleExpenses - depreciationDeductions;

    return {
      taxableIncome,
      deductibleExpenses,
      estimatedTaxableIncome,
      projectedPAYG,
      frankingCredits,
      depreciationDeductions,
    };
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Export all calculated data for a user
 */
export async function exportTestScenario(
  userId: string,
  scenarioId: string,
  scenarioName: string,
  prisma?: PrismaClient
): Promise<TestExportOutput> {
  const exporter = new TestScenarioExporter(prisma);
  try {
    return await exporter.exportScenario(userId, scenarioId, scenarioName);
  } finally {
    if (!prisma) {
      await exporter.disconnect();
    }
  }
}
