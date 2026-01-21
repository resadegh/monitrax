/**
 * Phase 17C: Property Decision Support for CFO Dashboard
 * Lightweight property insights leveraging masterFinancialService
 *
 * All data comes from existing centralized calculations - no duplicate logic.
 */

import { getPropertyMetrics, PropertyMetrics } from '@/lib/services/masterFinancialService';

// ============================================================================
// Types
// ============================================================================

export interface CFOPropertyInsights {
  // Portfolio Summary
  portfolioSummary: {
    totalProperties: number;
    totalValue: number;
    totalEquity: number;
    averageLVR: number;
    totalMonthlyIncome: number;
    totalMonthlyCashflow: number;
  };

  // Property Alerts
  propertyAlerts: PropertyAlert[];

  // Top Performers & Underperformers
  topPerformer: PropertyPerformance | null;
  underperformer: PropertyPerformance | null;

  // Metadata
  metadata: {
    calculatedAt: Date;
    propertyCount: number;
  };
}

export interface PropertyAlert {
  type: PropertyAlertType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  propertyId: string;
  propertyName: string;
  title: string;
  description: string;
  value: number;
  action: string;
}

export type PropertyAlertType =
  | 'high_lvr'
  | 'low_yield'
  | 'negative_cashflow'
  | 'low_growth'
  | 'high_vacancy_risk';

export interface PropertyPerformance {
  propertyId: string;
  propertyName: string;
  metric: string;
  value: number;
  description: string;
}

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
  const totalMonthlyIncome = properties.reduce((sum, p) => sum + p.monthlyRentalIncome, 0);
  const totalMonthlyCashflow = properties.reduce((sum, p) => sum + p.netMonthlyCashflow, 0);

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

function generatePropertyAlerts(properties: PropertyMetrics[]): PropertyAlert[] {
  const alerts: PropertyAlert[] = [];

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
    if (property.netMonthlyCashflow < -500) {
      alerts.push({
        type: 'negative_cashflow',
        severity: property.netMonthlyCashflow < -1000 ? 'high' : 'medium',
        propertyId: property.id,
        propertyName: property.name,
        title: `Negative Cashflow: $${Math.abs(property.netMonthlyCashflow).toFixed(0)}/mo`,
        description: `${property.name} costs you ${Math.abs(property.netMonthlyCashflow).toFixed(0)}/month out of pocket.`,
        value: property.netMonthlyCashflow,
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
  topPerformer: PropertyPerformance | null;
  underperformer: PropertyPerformance | null;
} {
  if (properties.length === 0) {
    return { topPerformer: null, underperformer: null };
  }

  // Find best yield
  const propertiesWithYield = properties.filter(p => p.rentalYield > 0);
  let topPerformer: PropertyPerformance | null = null;
  let underperformer: PropertyPerformance | null = null;

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
      p.netMonthlyCashflow > best.netMonthlyCashflow ? p : best
    );

    if (bestCashflow.netMonthlyCashflow > 0) {
      topPerformer = {
        propertyId: bestCashflow.id,
        propertyName: bestCashflow.name,
        metric: 'Monthly Cashflow',
        value: bestCashflow.netMonthlyCashflow,
        description: `+$${bestCashflow.netMonthlyCashflow.toFixed(0)}/mo positive cashflow`,
      };
    }

    const worstCashflow = properties.reduce((worst, p) =>
      p.netMonthlyCashflow < worst.netMonthlyCashflow ? p : worst
    );

    if (worstCashflow.netMonthlyCashflow < 0) {
      underperformer = {
        propertyId: worstCashflow.id,
        propertyName: worstCashflow.name,
        metric: 'Monthly Cashflow',
        value: worstCashflow.netMonthlyCashflow,
        description: `-$${Math.abs(worstCashflow.netMonthlyCashflow).toFixed(0)}/mo negative cashflow`,
      };
    }
  }

  return { topPerformer, underperformer };
}
