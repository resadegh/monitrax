/**
 * Phase 17C: Property Decision Support for CFO Dashboard
 * Lightweight property insights leveraging masterFinancialService
 *
 * All data comes from existing centralized calculations - no duplicate logic.
 */

import { getPropertyMetrics, PropertyMetrics } from '@/lib/services/masterFinancialService';
import {
  CFOPropertyInsights,
  CFOPropertyAlert,
  CFOPropertyPerformance,
} from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

// ============================================================================
// Property Insights Calculator
// ============================================================================

export async function calculateCFOPropertyInsights(userId: string): Promise<CFOPropertyInsights> {
  // Get property metrics from centralized service
  const properties = await getPropertyMetrics(userId);

  if (properties.length === 0) {
    return {
      portfolioSummary: {
        totalProperties: 0,
        totalValue: 0,
        totalEquity: 0,
        averageLVR: 0,
        totalMonthlyIncome: 0,
        totalMonthlyCashflow: 0,
      },
      propertyAlerts: [],
      topPerformer: null,
      underperformer: null,
      metadata: {
        calculatedAt: new Date(),
        propertyCount: 0,
      },
    };
  }

  // Calculate portfolio summary
  const totalValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalEquity = properties.reduce((sum, p) => sum + p.equity, 0);
  const totalLoanBalance = totalValue - totalEquity;
  const averageLVR = totalValue > 0 ? (totalLoanBalance / totalValue) * 100 : 0;
  const totalMonthlyIncome = properties.reduce((sum, p) => sum + p.annualRentalIncome / 12, 0);
  const totalMonthlyCashflow = properties.reduce((sum, p) => sum + p.monthlyCashflow, 0);

  // Generate alerts
  const propertyAlerts = generatePropertyAlerts(properties);

  // Find top performer and underperformer
  const { topPerformer, underperformer } = findPerformanceExtremes(properties);

  return {
    portfolioSummary: {
      totalProperties: properties.length,
      totalValue: Math.round(totalValue),
      totalEquity: Math.round(totalEquity),
      averageLVR: Math.round(averageLVR * 10) / 10,
      totalMonthlyIncome: Math.round(totalMonthlyIncome),
      totalMonthlyCashflow: Math.round(totalMonthlyCashflow),
    },
    propertyAlerts,
    topPerformer,
    underperformer,
    metadata: {
      calculatedAt: new Date(),
      propertyCount: properties.length,
    },
  };
}

// ============================================================================
// Alert Generation
// ============================================================================

function generatePropertyAlerts(properties: PropertyMetrics[]): CFOPropertyAlert[] {
  const alerts: CFOPropertyAlert[] = [];

  for (const property of properties) {
    // High LVR alert (>80%)
    if (property.lvr > 80) {
      alerts.push({
        type: 'high_lvr',
        severity: property.lvr > 90 ? 'high' : 'medium',
        propertyId: property.id,
        propertyName: property.name,
        title: `High LVR: ${property.lvr.toFixed(0)}%`,
        description: `${property.name} has LVR above 80%. Consider paying down to reduce risk.`,
        value: property.lvr,
        action: 'Focus extra repayments to reduce LVR',
      });
    }

    // Low yield alert (<3%)
    if (property.rentalYield > 0 && property.rentalYield < 3) {
      alerts.push({
        type: 'low_yield',
        severity: property.rentalYield < 2 ? 'high' : 'medium',
        propertyId: property.id,
        propertyName: property.name,
        title: `Low Yield: ${property.rentalYield.toFixed(1)}%`,
        description: `${property.name} yields below 3%. Consider rent review or strategy change.`,
        value: property.rentalYield,
        action: 'Review rental pricing or investment strategy',
      });
    }

    // Negative cashflow alert
    if (property.monthlyCashflow < -500) {
      alerts.push({
        type: 'negative_cashflow',
        severity: property.monthlyCashflow < -1000 ? 'high' : 'medium',
        propertyId: property.id,
        propertyName: property.name,
        title: `Negative Cashflow: $${Math.abs(property.monthlyCashflow).toFixed(0)}/mo`,
        description: `${property.name} costs you ${Math.abs(property.monthlyCashflow).toFixed(0)}/month out of pocket.`,
        value: property.monthlyCashflow,
        action: 'Review expenses or increase rent',
      });
    }

    // Low capital growth alert
    if (property.capitalGrowthPercent < 2 && property.capitalGrowthPercent >= 0) {
      alerts.push({
        type: 'low_growth',
        severity: 'low',
        propertyId: property.id,
        propertyName: property.name,
        title: `Low Growth: ${property.capitalGrowthPercent.toFixed(1)}%`,
        description: `${property.name} has minimal capital growth since purchase.`,
        value: property.capitalGrowthPercent,
        action: 'Review hold/sell decision',
      });
    }
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// ============================================================================
// Performance Analysis
// ============================================================================

function findPerformanceExtremes(properties: PropertyMetrics[]): {
  topPerformer: CFOPropertyPerformance | null;
  underperformer: CFOPropertyPerformance | null;
} {
  if (properties.length === 0) {
    return { topPerformer: null, underperformer: null };
  }

  // Find best yield
  const propertiesWithYield = properties.filter(p => p.rentalYield > 0);
  let topPerformer: CFOPropertyPerformance | null = null;
  let underperformer: CFOPropertyPerformance | null = null;

  if (propertiesWithYield.length > 0) {
    const bestYield = propertiesWithYield.reduce((best, p) =>
      p.rentalYield > best.rentalYield ? p : best
    );

    if (bestYield.rentalYield >= 4) {
      topPerformer = {
        propertyId: bestYield.id,
        propertyName: bestYield.name,
        metric: 'Rental Yield',
        value: bestYield.rentalYield,
        description: `${bestYield.rentalYield.toFixed(1)}% yield - strong performer`,
      };
    }

    const worstYield = propertiesWithYield.reduce((worst, p) =>
      p.rentalYield < worst.rentalYield ? p : worst
    );

    if (worstYield.rentalYield < 3 && worstYield.id !== bestYield.id) {
      underperformer = {
        propertyId: worstYield.id,
        propertyName: worstYield.name,
        metric: 'Rental Yield',
        value: worstYield.rentalYield,
        description: `${worstYield.rentalYield.toFixed(1)}% yield - below benchmark`,
      };
    }
  }

  // If no yield-based performance, use cashflow
  if (!topPerformer && !underperformer) {
    const bestCashflow = properties.reduce((best, p) =>
      p.monthlyCashflow > best.monthlyCashflow ? p : best
    );

    if (bestCashflow.monthlyCashflow > 0) {
      topPerformer = {
        propertyId: bestCashflow.id,
        propertyName: bestCashflow.name,
        metric: 'Monthly Cashflow',
        value: bestCashflow.monthlyCashflow,
        description: `+$${bestCashflow.monthlyCashflow.toFixed(0)}/mo positive cashflow`,
      };
    }

    const worstCashflow = properties.reduce((worst, p) =>
      p.monthlyCashflow < worst.monthlyCashflow ? p : worst
    );

    if (worstCashflow.monthlyCashflow < 0) {
      underperformer = {
        propertyId: worstCashflow.id,
        propertyName: worstCashflow.name,
        metric: 'Monthly Cashflow',
        value: worstCashflow.monthlyCashflow,
        description: `-$${Math.abs(worstCashflow.monthlyCashflow).toFixed(0)}/mo negative cashflow`,
      };
    }
  }

  return { topPerformer, underperformer };
}

// ============================================================================
// Q-DEC PR 2.E.3 — Decimal sibling
// ============================================================================

export interface CFOPropertyPortfolioSummaryDecimal {
  totalProperties: number;
  totalValue: Decimal;
  totalEquity: Decimal;
  averageLVR: Decimal;
  totalMonthlyIncome: Decimal;
  totalMonthlyCashflow: Decimal;
}

/**
 * Decimal sibling of the portfolio-summary computation inside
 * `calculateCFOPropertyInsights`. Pure aggregation: totals + weighted
 * LVR + monthly income from annual rental. Final outputs UN-rounded
 * (Float path rounds via `Math.round`/`Math.round(... * 10) / 10`;
 * Decimal path defers rounding to the API boundary).
 */
export function calculatePortfolioSummaryDecimal(
  properties: PropertyMetrics[],
): CFOPropertyPortfolioSummaryDecimal {
  const zero = new Decimal(0);

  if (properties.length === 0) {
    return {
      totalProperties: 0,
      totalValue: zero,
      totalEquity: zero,
      averageLVR: zero,
      totalMonthlyIncome: zero,
      totalMonthlyCashflow: zero,
    };
  }

  const totalValue = properties.reduce(
    (acc, p) => acc.plus(toDecimal(p.currentValue) ?? zero),
    zero,
  );
  const totalEquity = properties.reduce(
    (acc, p) => acc.plus(toDecimal(p.equity) ?? zero),
    zero,
  );
  const totalLoanBalance = totalValue.minus(totalEquity);
  const averageLVR = totalValue.gt(0)
    ? totalLoanBalance.div(totalValue).times(100)
    : zero;
  const totalMonthlyIncome = properties.reduce(
    (acc, p) => acc.plus((toDecimal(p.annualRentalIncome) ?? zero).div(12)),
    zero,
  );
  const totalMonthlyCashflow = properties.reduce(
    (acc, p) => acc.plus(toDecimal(p.monthlyCashflow) ?? zero),
    zero,
  );

  return {
    totalProperties: properties.length,
    totalValue,
    totalEquity,
    averageLVR,
    totalMonthlyIncome,
    totalMonthlyCashflow,
  };
}
