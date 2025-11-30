/**
 * Investment Report Generator
 */

import type { ReportContext, ReportConfig, AnyReportSection } from '../types';
import { createMetricSection, createTableSection, formatCurrency } from './index';

export function generateInvestmentReport(
  context: ReportContext,
  config: ReportConfig
): AnyReportSection[] {
  const sections: AnyReportSection[] = [];

  const investments = context.investments || [];

  const totalValue = investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalCostBasis = investments.reduce((sum, i) => sum + (i.units * i.averageCost), 0);
  const totalGainLoss = investments.reduce((sum, i) => sum + i.totalGainLoss, 0);
  const overallReturn = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  // Group by account
  const byAccount = investments.reduce((acc, i) => {
    if (!acc[i.accountName]) {
      acc[i.accountName] = { holdings: [], totalValue: 0, totalGainLoss: 0 };
    }
    acc[i.accountName].holdings.push(i);
    acc[i.accountName].totalValue += i.currentValue;
    acc[i.accountName].totalGainLoss += i.totalGainLoss;
    return acc;
  }, {} as Record<string, { holdings: typeof investments; totalValue: number; totalGainLoss: number }>);

  // Section 1: Portfolio Summary
  sections.push(
    createMetricSection('investment-summary', 'Investment Summary', 1, [
      {
        label: 'Total Portfolio Value',
        value: formatCurrency(totalValue),
        format: 'currency',
      },
      {
        label: 'Total Cost Basis',
        value: formatCurrency(totalCostBasis),
        format: 'currency',
      },
      {
        label: 'Total Gain/Loss',
        value: formatCurrency(totalGainLoss),
        format: 'currency',
        trend: {
          value: Math.round(overallReturn * 10) / 10,
          isPositive: totalGainLoss >= 0,
          period: 'total return',
        },
      },
      {
        label: 'Number of Holdings',
        value: investments.length,
        format: 'number',
      },
      {
        label: 'Investment Accounts',
        value: Object.keys(byAccount).length,
        format: 'number',
      },
    ])
  );

  // Section 2: Holdings Detail
  if (investments.length > 0) {
    sections.push(
      createTableSection(
        'holdings-detail',
        'Investment Holdings',
        2,
        [
          { key: 'symbol', label: 'Symbol', format: 'text', align: 'left' },
          { key: 'name', label: 'Name', format: 'text', align: 'left' },
          { key: 'units', label: 'Units', format: 'number', align: 'right' },
          { key: 'avgCost', label: 'Avg Cost', format: 'currency', align: 'right' },
          { key: 'currentPrice', label: 'Price', format: 'currency', align: 'right' },
          { key: 'currentValue', label: 'Value', format: 'currency', align: 'right' },
          { key: 'gainLoss', label: 'Gain/Loss', format: 'currency', align: 'right' },
          { key: 'returnPct', label: 'Return %', format: 'percentage', align: 'right' },
        ],
        investments.map((i) => ({
          symbol: i.symbol,
          name: i.name,
          units: i.units,
          avgCost: i.averageCost,
          currentPrice: i.currentPrice,
          currentValue: i.currentValue,
          gainLoss: i.totalGainLoss,
          returnPct: i.totalGainLossPercent,
        })),
        {
          currentValue: totalValue,
          gainLoss: totalGainLoss,
        }
      )
    );
  }

  // Section 3: By Account Summary
  if (Object.keys(byAccount).length > 0) {
    sections.push(
      createTableSection(
        'by-account',
        'By Account',
        3,
        [
          { key: 'account', label: 'Account', format: 'text', align: 'left' },
          { key: 'holdings', label: 'Holdings', format: 'number', align: 'center' },
          { key: 'value', label: 'Value', format: 'currency', align: 'right' },
          { key: 'gainLoss', label: 'Gain/Loss', format: 'currency', align: 'right' },
          { key: 'allocation', label: 'Allocation', format: 'percentage', align: 'right' },
        ],
        Object.entries(byAccount).map(([account, data]) => ({
          account,
          holdings: data.holdings.length,
          value: data.totalValue,
          gainLoss: data.totalGainLoss,
          allocation: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0,
        })),
        {
          value: totalValue,
          gainLoss: totalGainLoss,
        }
      )
    );
  }

  // Section 4: Top Performers
  if (investments.length > 0) {
    const topPerformers = [...investments]
      .sort((a, b) => b.totalGainLossPercent - a.totalGainLossPercent)
      .slice(0, 5);

    sections.push(
      createTableSection(
        'top-performers',
        'Top 5 Performers',
        4,
        [
          { key: 'symbol', label: 'Symbol', format: 'text', align: 'left' },
          { key: 'name', label: 'Name', format: 'text', align: 'left' },
          { key: 'returnPct', label: 'Return %', format: 'percentage', align: 'right' },
          { key: 'gainLoss', label: 'Gain/Loss', format: 'currency', align: 'right' },
        ],
        topPerformers.map((i) => ({
          symbol: i.symbol,
          name: i.name,
          returnPct: i.totalGainLossPercent,
          gainLoss: i.totalGainLoss,
        }))
      )
    );
  }

  return sections;
}
