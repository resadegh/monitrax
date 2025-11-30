/**
 * Property Portfolio Report Generator
 */

import type { ReportContext, ReportConfig, AnyReportSection } from '../types';
import { createMetricSection, createTableSection, formatCurrency, formatDate } from './index';

export function generatePropertyPortfolioReport(
  context: ReportContext,
  config: ReportConfig
): AnyReportSection[] {
  const sections: AnyReportSection[] = [];

  const properties = context.properties || [];
  const depreciation = context.depreciationSchedules || [];

  const totalValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
  const totalEquity = properties.reduce((sum, p) => sum + p.equity, 0);
  const totalPurchasePrice = properties.reduce((sum, p) => sum + p.purchasePrice, 0);
  const capitalGrowth = totalValue - totalPurchasePrice;
  const totalDepreciation = depreciation.reduce((sum, d) => sum + d.annualDeduction, 0);
  const avgLvr = properties.length > 0
    ? properties.reduce((sum, p) => sum + p.lvr, 0) / properties.length
    : 0;

  // Section 1: Portfolio Metrics
  sections.push(
    createMetricSection('portfolio-metrics', 'Portfolio Summary', 1, [
      {
        label: 'Total Portfolio Value',
        value: formatCurrency(totalValue),
        format: 'currency',
      },
      {
        label: 'Total Equity',
        value: formatCurrency(totalEquity),
        format: 'currency',
      },
      {
        label: 'Total Purchase Cost',
        value: formatCurrency(totalPurchasePrice),
        format: 'currency',
      },
      {
        label: 'Capital Growth',
        value: formatCurrency(capitalGrowth),
        format: 'currency',
        trend: {
          value: totalPurchasePrice > 0 ? Math.round((capitalGrowth / totalPurchasePrice) * 100) : 0,
          isPositive: capitalGrowth >= 0,
          period: 'total gain',
        },
      },
      {
        label: 'Average LVR',
        value: `${avgLvr.toFixed(1)}%`,
        format: 'percentage',
      },
      {
        label: 'Number of Properties',
        value: properties.length,
        format: 'number',
      },
    ])
  );

  // Section 2: Tax Benefits
  sections.push(
    createMetricSection('tax-benefits', 'Tax Benefits', 2, [
      {
        label: 'Annual Depreciation',
        value: formatCurrency(totalDepreciation),
        format: 'currency',
        description: 'Total tax deductions from depreciation',
      },
      {
        label: 'Depreciation Schedules',
        value: depreciation.length,
        format: 'number',
      },
    ])
  );

  // Section 3: Property Details
  if (properties.length > 0) {
    sections.push(
      createTableSection(
        'property-details',
        'Property Details',
        3,
        [
          { key: 'name', label: 'Property', format: 'text', align: 'left' },
          { key: 'type', label: 'Type', format: 'text', align: 'left' },
          { key: 'purchasePrice', label: 'Purchase', format: 'currency', align: 'right' },
          { key: 'currentValue', label: 'Value', format: 'currency', align: 'right' },
          { key: 'equity', label: 'Equity', format: 'currency', align: 'right' },
          { key: 'lvr', label: 'LVR', format: 'percentage', align: 'right' },
          { key: 'annualDepreciation', label: 'Depreciation', format: 'currency', align: 'right' },
        ],
        properties.map((p) => ({
          name: p.name,
          type: p.type,
          purchasePrice: p.purchasePrice,
          currentValue: p.currentValue,
          equity: p.equity,
          lvr: p.lvr,
          annualDepreciation: p.annualDepreciation,
        })),
        {
          purchasePrice: totalPurchasePrice,
          currentValue: totalValue,
          equity: totalEquity,
          annualDepreciation: totalDepreciation,
        }
      )
    );
  }

  // Section 4: Linked Entities Summary
  if (properties.length > 0) {
    sections.push(
      createTableSection(
        'linked-entities',
        'Linked Entities',
        4,
        [
          { key: 'name', label: 'Property', format: 'text', align: 'left' },
          { key: 'loans', label: 'Loans', format: 'number', align: 'center' },
          { key: 'incomes', label: 'Income', format: 'number', align: 'center' },
          { key: 'expenses', label: 'Expenses', format: 'number', align: 'center' },
        ],
        properties.map((p) => ({
          name: p.name,
          loans: p.linkedLoansCount,
          incomes: p.linkedIncomesCount,
          expenses: p.linkedExpensesCount,
        }))
      )
    );
  }

  // Section 5: Depreciation Schedules
  if (depreciation.length > 0) {
    sections.push(
      createTableSection(
        'depreciation-schedules',
        'Depreciation Schedules',
        5,
        [
          { key: 'assetName', label: 'Asset', format: 'text', align: 'left' },
          { key: 'propertyName', label: 'Property', format: 'text', align: 'left' },
          { key: 'category', label: 'Category', format: 'text', align: 'left' },
          { key: 'cost', label: 'Cost', format: 'currency', align: 'right' },
          { key: 'rate', label: 'Rate', format: 'percentage', align: 'right' },
          { key: 'annualDeduction', label: 'Annual', format: 'currency', align: 'right' },
          { key: 'remainingYears', label: 'Remaining', format: 'text', align: 'right' },
        ],
        depreciation.map((d) => ({
          assetName: d.assetName,
          propertyName: d.propertyName,
          category: d.category,
          cost: d.cost,
          rate: d.rate,
          annualDeduction: d.annualDeduction,
          remainingYears: `${d.remainingYears} yrs`,
        })),
        {
          cost: depreciation.reduce((sum, d) => sum + d.cost, 0),
          annualDeduction: totalDepreciation,
        }
      )
    );
  }

  return sections;
}
