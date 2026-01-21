/**
 * Phase 17D: Investment Decision Support for CFO Dashboard
 * Lightweight investment insights leveraging masterFinancialService
 *
 * All data comes from existing centralized calculations - no duplicate logic.
 */

import { getInvestmentMetrics, InvestmentMetrics } from '@/lib/services/masterFinancialService';
import { prisma } from '@/lib/prisma';
import {
  CFOInvestmentInsights,
  CFOInvestmentAlert,
  CFOInvestmentPerformance,
  CFOAllocationAnalysis,
  CFOAssetAllocation,
  CFORebalanceAction,
  CFOPerformanceMetrics,
} from '../types';

// ============================================================================
// Constants
// ============================================================================

// Default target allocation for "Moderate" risk profile
const DEFAULT_TARGET_ALLOCATION: Record<string, number> = {
  SHARE: 40,
  ETF: 20,
  MANAGED_FUND: 15,
  CRYPTO: 5,
  OTHER: 20,
};

// Concentration threshold (any single holding > this % triggers alert)
const CONCENTRATION_THRESHOLD = 30;

// Drift threshold for rebalancing alerts
const DRIFT_THRESHOLD = 10;

// CGT discount rate for assets held > 12 months
const CGT_DISCOUNT = 0.5;

// ============================================================================
// Investment Insights Calculator
// ============================================================================

export async function calculateCFOInvestmentInsights(userId: string): Promise<CFOInvestmentInsights> {
  // Get investment metrics from centralized service
  const investmentMetrics = await getInvestmentMetrics(userId);

  if (investmentMetrics.holdingsCount === 0) {
    return createEmptyInsights();
  }

  // Get detailed holdings for performance analysis
  const holdings = await getDetailedHoldings(userId);

  // Calculate allocation analysis
  const allocationAnalysis = calculateAllocationAnalysis(investmentMetrics, holdings);

  // Calculate performance metrics
  const performanceMetrics = await calculatePerformanceMetrics(userId, investmentMetrics, holdings);

  // Generate alerts
  const investmentAlerts = generateInvestmentAlerts(investmentMetrics, allocationAnalysis, holdings);

  // Find top performer and underperformer
  const { topPerformer, underperformer } = findPerformanceExtremes(holdings);

  // Calculate dividend yield
  const dividendYieldPercent = calculateDividendYield(holdings, investmentMetrics.totalValue);

  return {
    portfolioSummary: {
      totalValue: Math.round(investmentMetrics.totalValue),
      totalCostBase: Math.round(investmentMetrics.totalCostBase),
      unrealisedGain: Math.round(investmentMetrics.unrealisedGain),
      unrealisedGainPercent: Math.round(investmentMetrics.unrealisedGainPercent * 10) / 10,
      holdingsCount: investmentMetrics.holdingsCount,
      dividendYieldPercent: Math.round(dividendYieldPercent * 10) / 10,
    },
    allocationAnalysis,
    performanceMetrics,
    investmentAlerts,
    topPerformer,
    underperformer,
    metadata: {
      calculatedAt: new Date(),
      holdingsCount: investmentMetrics.holdingsCount,
    },
  };
}

// ============================================================================
// Helper Types
// ============================================================================

interface DetailedHolding {
  id: string;
  ticker: string;
  name: string;
  type: string;
  units: number;
  averagePrice: number;
  currentPrice: number | null;
  currentValue: number;
  costBase: number;
  unrealisedGain: number;
  unrealisedGainPercent: number;
  frankingPercentage: number | null;
  firstPurchaseDate: Date | null;
  isLongTermHold: boolean; // > 12 months
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getDetailedHoldings(userId: string): Promise<DetailedHolding[]> {
  const accounts = await prisma.investmentAccount.findMany({
    where: { userId },
    include: {
      holdings: true,
    },
  });

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const holdings: DetailedHolding[] = [];

  for (const account of accounts) {
    for (const holding of account.holdings) {
      const currentPrice = holding.currentPrice || holding.averagePrice;
      const currentValue = holding.units * currentPrice;
      const costBase = holding.totalCostBasis || holding.units * holding.averagePrice;
      const unrealisedGain = currentValue - costBase;
      const unrealisedGainPercent = costBase > 0 ? (unrealisedGain / costBase) * 100 : 0;
      const isLongTermHold = holding.firstPurchaseDate
        ? holding.firstPurchaseDate < oneYearAgo
        : false;

      holdings.push({
        id: holding.id,
        ticker: holding.ticker,
        name: holding.name || holding.ticker,
        type: holding.type || 'OTHER',
        units: holding.units,
        averagePrice: holding.averagePrice,
        currentPrice,
        currentValue,
        costBase,
        unrealisedGain,
        unrealisedGainPercent,
        frankingPercentage: holding.frankingPercentage,
        firstPurchaseDate: holding.firstPurchaseDate,
        isLongTermHold,
      });
    }
  }

  return holdings;
}

// ============================================================================
// Allocation Analysis
// ============================================================================

function calculateAllocationAnalysis(
  metrics: InvestmentMetrics,
  holdings: DetailedHolding[]
): CFOAllocationAnalysis {
  const totalValue = metrics.totalValue;

  // Build current allocation from metrics
  const currentAllocation: CFOAssetAllocation[] = Object.entries(metrics.byType).map(
    ([assetType, data]) => ({
      assetType,
      value: Math.round(data.value),
      percentage: Math.round(data.percentage * 10) / 10,
      targetPercentage: DEFAULT_TARGET_ALLOCATION[assetType] || 0,
    })
  );

  // Add missing asset types with 0 allocation
  for (const [assetType, targetPct] of Object.entries(DEFAULT_TARGET_ALLOCATION)) {
    if (!currentAllocation.find((a) => a.assetType === assetType)) {
      currentAllocation.push({
        assetType,
        value: 0,
        percentage: 0,
        targetPercentage: targetPct,
      });
    }
  }

  // Calculate drift from target
  let totalDrift = 0;
  const rebalanceActions: CFORebalanceAction[] = [];

  for (const allocation of currentAllocation) {
    const target = DEFAULT_TARGET_ALLOCATION[allocation.assetType] || 0;
    const drift = Math.abs(allocation.percentage - target);
    totalDrift += drift;

    if (drift >= DRIFT_THRESHOLD) {
      const action: 'buy' | 'sell' | 'hold' =
        allocation.percentage < target ? 'buy' : allocation.percentage > target ? 'sell' : 'hold';

      const amountToAdjust = Math.abs(((target - allocation.percentage) / 100) * totalValue);

      rebalanceActions.push({
        assetType: allocation.assetType,
        action,
        currentPercent: Math.round(allocation.percentage * 10) / 10,
        targetPercent: target,
        amountToAdjust: Math.round(amountToAdjust),
        description:
          action === 'buy'
            ? `Consider buying ~$${Math.round(amountToAdjust).toLocaleString()} of ${allocation.assetType}`
            : `Consider selling ~$${Math.round(amountToAdjust).toLocaleString()} of ${allocation.assetType}`,
      });
    }
  }

  // Check concentration risk (any single holding > 30%)
  let topHolding: string | null = null;
  let topHoldingPercent = 0;

  for (const holding of holdings) {
    const holdingPercent = totalValue > 0 ? (holding.currentValue / totalValue) * 100 : 0;
    if (holdingPercent > topHoldingPercent) {
      topHoldingPercent = holdingPercent;
      topHolding = holding.name;
    }
  }

  const hasConcentrationRisk = topHoldingPercent > CONCENTRATION_THRESHOLD;

  return {
    currentAllocation,
    targetAllocation: currentAllocation.map((a) => ({
      ...a,
      percentage: a.targetPercentage || 0,
    })),
    driftFromTarget: Math.round(totalDrift / 2), // Average drift
    rebalanceActions,
    concentrationRisk: {
      hasRisk: hasConcentrationRisk,
      topHolding,
      topHoldingPercent: Math.round(topHoldingPercent * 10) / 10,
    },
  };
}

// ============================================================================
// Performance Metrics
// ============================================================================

async function calculatePerformanceMetrics(
  userId: string,
  metrics: InvestmentMetrics,
  holdings: DetailedHolding[]
): Promise<CFOPerformanceMetrics> {
  // Calculate total return
  const totalReturn = metrics.unrealisedGain;
  const totalReturnPercent = metrics.unrealisedGainPercent;

  // Get dividend income from last 12 months
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const dividendIncome = await prisma.income.aggregate({
    where: {
      userId,
      type: 'DIVIDEND',
      date: { gte: oneYearAgo },
    },
    _sum: {
      amount: true,
    },
  });

  // Calculate franking credits (estimate based on dividend income and average franking %)
  const avgFrankingPct = holdings.reduce((sum, h) => sum + (h.frankingPercentage || 0), 0) /
    (holdings.filter(h => h.frankingPercentage).length || 1);
  const frankingCredits = ((dividendIncome._sum.amount || 0) * (avgFrankingPct / 100) * 30) / 70; // Gross-up calculation

  // Calculate unrealised CGT (with 50% discount for long-term holds)
  let unrealisedCGT = 0;
  for (const holding of holdings) {
    if (holding.unrealisedGain > 0) {
      const taxableGain = holding.isLongTermHold
        ? holding.unrealisedGain * CGT_DISCOUNT
        : holding.unrealisedGain;
      // Assume 37% marginal rate for estimation
      unrealisedCGT += taxableGain * 0.37;
    }
  }

  // Calculate annualised return (CAGR) if we have first purchase date
  let annualisedReturn: number | null = null;
  const oldestPurchase = holdings
    .filter((h) => h.firstPurchaseDate)
    .sort((a, b) => (a.firstPurchaseDate?.getTime() || 0) - (b.firstPurchaseDate?.getTime() || 0))[0];

  if (oldestPurchase?.firstPurchaseDate) {
    const years =
      (Date.now() - oldestPurchase.firstPurchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years >= 1 && metrics.totalCostBase > 0) {
      // CAGR = (FV/PV)^(1/n) - 1
      annualisedReturn =
        (Math.pow(metrics.totalValue / metrics.totalCostBase, 1 / years) - 1) * 100;
    }
  }

  return {
    totalReturn: Math.round(totalReturn),
    totalReturnPercent: Math.round(totalReturnPercent * 10) / 10,
    annualisedReturn: annualisedReturn ? Math.round(annualisedReturn * 10) / 10 : null,
    dividendIncome: Math.round(dividendIncome._sum.amount || 0),
    frankingCredits: Math.round(frankingCredits),
    unrealisedCGT: Math.round(unrealisedCGT),
  };
}

// ============================================================================
// Alert Generation
// ============================================================================

function generateInvestmentAlerts(
  metrics: InvestmentMetrics,
  allocation: CFOAllocationAnalysis,
  holdings: DetailedHolding[]
): CFOInvestmentAlert[] {
  const alerts: CFOInvestmentAlert[] = [];

  // Concentration risk alert
  if (allocation.concentrationRisk.hasRisk) {
    alerts.push({
      type: 'concentration_high',
      severity: allocation.concentrationRisk.topHoldingPercent > 50 ? 'high' : 'medium',
      holdingName: allocation.concentrationRisk.topHolding || undefined,
      title: `High Concentration: ${allocation.concentrationRisk.topHoldingPercent.toFixed(0)}%`,
      description: `${allocation.concentrationRisk.topHolding} makes up ${allocation.concentrationRisk.topHoldingPercent.toFixed(0)}% of your portfolio`,
      value: allocation.concentrationRisk.topHoldingPercent,
      action: 'Consider diversifying to reduce single-stock risk',
    });
  }

  // Rebalancing needed alert
  if (allocation.driftFromTarget > DRIFT_THRESHOLD) {
    alerts.push({
      type: 'rebalance_needed',
      severity: allocation.driftFromTarget > 20 ? 'high' : 'medium',
      title: `Portfolio Drift: ${allocation.driftFromTarget.toFixed(0)}%`,
      description: `Your allocation has drifted ${allocation.driftFromTarget.toFixed(0)}% from target`,
      value: allocation.driftFromTarget,
      action: 'Review rebalancing opportunities',
    });
  }

  // Underperforming holdings (loss > 20%)
  for (const holding of holdings) {
    if (holding.unrealisedGainPercent < -20) {
      alerts.push({
        type: 'underperforming',
        severity: holding.unrealisedGainPercent < -40 ? 'high' : 'medium',
        holdingId: holding.id,
        holdingName: holding.name,
        title: `Underperforming: ${holding.ticker}`,
        description: `${holding.name} is down ${Math.abs(holding.unrealisedGainPercent).toFixed(0)}%`,
        value: holding.unrealisedGainPercent,
        action: 'Review hold/sell decision',
      });
    }
  }

  // CGT harvesting opportunity (significant gains with long-term holdings)
  const longTermGains = holdings
    .filter((h) => h.isLongTermHold && h.unrealisedGain > 5000)
    .reduce((sum, h) => sum + h.unrealisedGain, 0);

  if (longTermGains > 20000) {
    alerts.push({
      type: 'cgt_opportunity',
      severity: 'low',
      title: `CGT Planning Opportunity`,
      description: `$${longTermGains.toLocaleString()} in long-term gains eligible for 50% CGT discount`,
      value: longTermGains,
      action: 'Consider tax-loss harvesting or staged selling',
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================================
// Performance Extremes
// ============================================================================

function findPerformanceExtremes(holdings: DetailedHolding[]): {
  topPerformer: CFOInvestmentPerformance | null;
  underperformer: CFOInvestmentPerformance | null;
} {
  if (holdings.length === 0) {
    return { topPerformer: null, underperformer: null };
  }

  let topPerformer: CFOInvestmentPerformance | null = null;
  let underperformer: CFOInvestmentPerformance | null = null;

  // Find best performer by % gain
  const sortedByGain = [...holdings].sort(
    (a, b) => b.unrealisedGainPercent - a.unrealisedGainPercent
  );

  const best = sortedByGain[0];
  if (best.unrealisedGainPercent > 10) {
    topPerformer = {
      holdingId: best.id,
      holdingName: best.name,
      metric: 'Return',
      value: best.unrealisedGainPercent,
      description: `+${best.unrealisedGainPercent.toFixed(1)}% return ($${best.unrealisedGain.toLocaleString()} gain)`,
    };
  }

  // Find worst performer
  const worst = sortedByGain[sortedByGain.length - 1];
  if (worst.unrealisedGainPercent < -5 && worst.id !== best.id) {
    underperformer = {
      holdingId: worst.id,
      holdingName: worst.name,
      metric: 'Return',
      value: worst.unrealisedGainPercent,
      description: `${worst.unrealisedGainPercent.toFixed(1)}% return ($${Math.abs(worst.unrealisedGain).toLocaleString()} loss)`,
    };
  }

  return { topPerformer, underperformer };
}

// ============================================================================
// Dividend Yield Calculation
// ============================================================================

function calculateDividendYield(holdings: DetailedHolding[], totalValue: number): number {
  if (totalValue === 0) return 0;

  // Estimate yield based on franking percentage (rough approximation)
  // Holdings with franking credits typically yield 3-5%
  const frankedValue = holdings
    .filter((h) => h.frankingPercentage && h.frankingPercentage > 0)
    .reduce((sum, h) => sum + h.currentValue, 0);

  // Assume 4% average yield for franked holdings, 2% for others
  const estimatedDividends = frankedValue * 0.04 + (totalValue - frankedValue) * 0.02;

  return (estimatedDividends / totalValue) * 100;
}

// ============================================================================
// Empty State
// ============================================================================

function createEmptyInsights(): CFOInvestmentInsights {
  return {
    portfolioSummary: {
      totalValue: 0,
      totalCostBase: 0,
      unrealisedGain: 0,
      unrealisedGainPercent: 0,
      holdingsCount: 0,
      dividendYieldPercent: 0,
    },
    allocationAnalysis: {
      currentAllocation: [],
      targetAllocation: null,
      driftFromTarget: 0,
      rebalanceActions: [],
      concentrationRisk: {
        hasRisk: false,
        topHolding: null,
        topHoldingPercent: 0,
      },
    },
    performanceMetrics: {
      totalReturn: 0,
      totalReturnPercent: 0,
      annualisedReturn: null,
      dividendIncome: 0,
      frankingCredits: 0,
      unrealisedCGT: 0,
    },
    investmentAlerts: [],
    topPerformer: null,
    underperformer: null,
    metadata: {
      calculatedAt: new Date(),
      holdingsCount: 0,
    },
  };
}
