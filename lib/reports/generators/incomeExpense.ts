/**
 * Income & Expense Report Generator
 */

import type { ReportContext, ReportConfig, AnyReportSection } from '../types';
import { createMetricSection, createTableSection, formatCurrency } from './index';

export function generateIncomeExpenseReport(
  context: ReportContext,
  config: ReportConfig
): AnyReportSection[] {
  const sections: AnyReportSection[] = [];

  const incomes = context.incomes || [];
  const expenses = context.expenses || [];

  const totalAnnualIncome = incomes.reduce((sum, i) => sum + i.annualAmount, 0);
  const totalAnnualExpenses = expenses.reduce((sum, e) => sum + e.annualAmount, 0);
  const netAnnualCashflow = totalAnnualIncome - totalAnnualExpenses;
  const taxableIncome = incomes.filter((i) => i.isTaxable).reduce((sum, i) => sum + i.annualAmount, 0);
  const deductibleExpenses = expenses.filter((e) => e.isDeductible).reduce((sum, e) => sum + e.annualAmount, 0);

  // Section 1: Summary Metrics
  sections.push(
    createMetricSection('cashflow-summary', 'Cashflow Summary', 1, [
      {
        label: 'Total Annual Income',
        value: formatCurrency(totalAnnualIncome),
        format: 'currency',
      },
      {
        label: 'Total Annual Expenses',
        value: formatCurrency(totalAnnualExpenses),
        format: 'currency',
      },
      {
        label: 'Net Annual Cashflow',
        value: formatCurrency(netAnnualCashflow),
        format: 'currency',
        trend: {
          value: totalAnnualIncome > 0 ? Math.round((netAnnualCashflow / totalAnnualIncome) * 100) : 0,
          isPositive: netAnnualCashflow >= 0,
          period: 'savings rate',
        },
      },
      {
        label: 'Monthly Surplus/Deficit',
        value: formatCurrency(netAnnualCashflow / 12),
        format: 'currency',
      },
    ])
  );

  // Section 2: Tax Summary
  sections.push(
    createMetricSection('tax-summary', 'Tax-Related Summary', 2, [
      {
        label: 'Taxable Income',
        value: formatCurrency(taxableIncome),
        format: 'currency',
        description: 'Income marked as taxable',
      },
      {
        label: 'Deductible Expenses',
        value: formatCurrency(deductibleExpenses),
        format: 'currency',
        description: 'Expenses marked as tax deductible',
      },
    ])
  );

  // Section 3: Income Breakdown
  if (incomes.length > 0) {
    // Group by category
    const incomeByCategory = incomes.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + i.annualAmount;
      return acc;
    }, {} as Record<string, number>);

    sections.push(
      createTableSection(
        'income-breakdown',
        'Income Sources',
        3,
        [
          { key: 'source', label: 'Source', format: 'text', align: 'left' },
          { key: 'category', label: 'Category', format: 'text', align: 'left' },
          { key: 'amount', label: 'Amount', format: 'currency', align: 'right' },
          { key: 'frequency', label: 'Frequency', format: 'text', align: 'left' },
          { key: 'annualAmount', label: 'Annual', format: 'currency', align: 'right' },
          { key: 'linkedProperty', label: 'Property', format: 'text', align: 'left' },
        ],
        incomes.map((i) => ({
          source: i.source,
          category: i.category,
          amount: i.amount,
          frequency: i.frequency,
          annualAmount: i.annualAmount,
          linkedProperty: i.linkedPropertyName || '-',
        })),
        {
          annualAmount: totalAnnualIncome,
        }
      )
    );

    // Category summary
    sections.push(
      createTableSection(
        'income-by-category',
        'Income by Category',
        4,
        [
          { key: 'category', label: 'Category', format: 'text', align: 'left' },
          { key: 'amount', label: 'Annual Amount', format: 'currency', align: 'right' },
          { key: 'percentage', label: '% of Total', format: 'percentage', align: 'right' },
        ],
        Object.entries(incomeByCategory).map(([category, amount]) => ({
          category,
          amount,
          percentage: totalAnnualIncome > 0 ? (amount / totalAnnualIncome) * 100 : 0,
        }))
      )
    );
  }

  // Section 4: Expense Breakdown
  if (expenses.length > 0) {
    // Group by category
    const expenseByCategory = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.annualAmount;
      return acc;
    }, {} as Record<string, number>);

    sections.push(
      createTableSection(
        'expense-breakdown',
        'Expense Details',
        5,
        [
          { key: 'description', label: 'Description', format: 'text', align: 'left' },
          { key: 'category', label: 'Category', format: 'text', align: 'left' },
          { key: 'amount', label: 'Amount', format: 'currency', align: 'right' },
          { key: 'frequency', label: 'Frequency', format: 'text', align: 'left' },
          { key: 'annualAmount', label: 'Annual', format: 'currency', align: 'right' },
          { key: 'deductible', label: 'Deductible', format: 'text', align: 'center' },
        ],
        expenses.map((e) => ({
          description: e.description,
          category: e.category,
          amount: e.amount,
          frequency: e.frequency,
          annualAmount: e.annualAmount,
          deductible: e.isDeductible ? 'Yes' : 'No',
        })),
        {
          annualAmount: totalAnnualExpenses,
        }
      )
    );

    // Category summary
    sections.push(
      createTableSection(
        'expense-by-category',
        'Expenses by Category',
        6,
        [
          { key: 'category', label: 'Category', format: 'text', align: 'left' },
          { key: 'amount', label: 'Annual Amount', format: 'currency', align: 'right' },
          { key: 'percentage', label: '% of Total', format: 'percentage', align: 'right' },
        ],
        Object.entries(expenseByCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => ({
            category,
            amount,
            percentage: totalAnnualExpenses > 0 ? (amount / totalAnnualExpenses) * 100 : 0,
          }))
      )
    );
  }

  return sections;
}
