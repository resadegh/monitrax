/**
 * Tax-Time Report Generator
 * Compiles all tax-relevant data for annual tax filing
 */

import type { ReportContext, ReportConfig, AnyReportSection } from '../types';
import { createMetricSection, createTableSection, formatCurrency } from './index';

export function generateTaxTimeReport(
  context: ReportContext,
  config: ReportConfig
): AnyReportSection[] {
  const sections: AnyReportSection[] = [];

  const incomes = context.incomes || [];
  const expenses = context.expenses || [];
  const depreciation = context.depreciationSchedules || [];
  const properties = context.properties || [];

  // Calculate tax-relevant totals
  const taxableIncome = incomes
    .filter((i) => i.isTaxable)
    .reduce((sum, i) => sum + i.annualAmount, 0);
  const deductibleExpenses = expenses
    .filter((e) => e.isDeductible)
    .reduce((sum, e) => sum + e.annualAmount, 0);
  const totalDepreciation = depreciation.reduce((sum, d) => sum + d.annualDeduction, 0);
  const totalDeductions = deductibleExpenses + totalDepreciation;
  const netTaxableIncome = taxableIncome - totalDeductions;

  // Property-related calculations
  const rentalIncome = incomes
    .filter((i) => i.linkedPropertyName && i.category.toLowerCase().includes('rent'))
    .reduce((sum, i) => sum + i.annualAmount, 0);
  const propertyExpenses = expenses
    .filter((e) => e.linkedPropertyName && e.isDeductible)
    .reduce((sum, e) => sum + e.annualAmount, 0);

  // Section 1: Tax Summary
  sections.push(
    createMetricSection('tax-summary', 'Tax Summary', 1, [
      {
        label: 'Total Taxable Income',
        value: formatCurrency(taxableIncome),
        format: 'currency',
        description: 'All income marked as taxable',
      },
      {
        label: 'Total Deductions',
        value: formatCurrency(totalDeductions),
        format: 'currency',
        description: 'Deductible expenses + depreciation',
      },
      {
        label: 'Net Taxable Income',
        value: formatCurrency(netTaxableIncome),
        format: 'currency',
        description: 'Taxable income minus deductions',
      },
      {
        label: 'Depreciation Claims',
        value: formatCurrency(totalDepreciation),
        format: 'currency',
      },
    ])
  );

  // Section 2: Income Breakdown
  const taxableIncomes = incomes.filter((i) => i.isTaxable);
  if (taxableIncomes.length > 0) {
    sections.push(
      createTableSection(
        'taxable-income',
        'Taxable Income',
        2,
        [
          { key: 'source', label: 'Source', format: 'text', align: 'left' },
          { key: 'category', label: 'Category', format: 'text', align: 'left' },
          { key: 'annualAmount', label: 'Annual Amount', format: 'currency', align: 'right' },
          { key: 'property', label: 'Property', format: 'text', align: 'left' },
        ],
        taxableIncomes.map((i) => ({
          source: i.source,
          category: i.category,
          annualAmount: i.annualAmount,
          property: i.linkedPropertyName || '-',
        })),
        {
          annualAmount: taxableIncome,
        }
      )
    );
  }

  // Section 3: Deductible Expenses
  const deductibles = expenses.filter((e) => e.isDeductible);
  if (deductibles.length > 0) {
    // Group by category
    const byCategory = deductibles.reduce((acc, e) => {
      if (!acc[e.category]) {
        acc[e.category] = 0;
      }
      acc[e.category] += e.annualAmount;
      return acc;
    }, {} as Record<string, number>);

    sections.push(
      createTableSection(
        'deductible-expenses',
        'Deductible Expenses',
        3,
        [
          { key: 'description', label: 'Description', format: 'text', align: 'left' },
          { key: 'category', label: 'Category', format: 'text', align: 'left' },
          { key: 'annualAmount', label: 'Annual Amount', format: 'currency', align: 'right' },
          { key: 'property', label: 'Property', format: 'text', align: 'left' },
        ],
        deductibles.map((e) => ({
          description: e.description,
          category: e.category,
          annualAmount: e.annualAmount,
          property: e.linkedPropertyName || '-',
        })),
        {
          annualAmount: deductibleExpenses,
        }
      )
    );

    // Category summary
    sections.push(
      createTableSection(
        'deductions-by-category',
        'Deductions by Category',
        4,
        [
          { key: 'category', label: 'Category', format: 'text', align: 'left' },
          { key: 'amount', label: 'Amount', format: 'currency', align: 'right' },
        ],
        Object.entries(byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => ({
            category,
            amount,
          })),
        {
          amount: deductibleExpenses,
        }
      )
    );
  }

  // Section 4: Depreciation Schedules
  if (depreciation.length > 0) {
    sections.push(
      createTableSection(
        'depreciation-claims',
        'Depreciation Claims',
        5,
        [
          { key: 'asset', label: 'Asset', format: 'text', align: 'left' },
          { key: 'property', label: 'Property', format: 'text', align: 'left' },
          { key: 'category', label: 'Division', format: 'text', align: 'left' },
          { key: 'method', label: 'Method', format: 'text', align: 'left' },
          { key: 'cost', label: 'Cost', format: 'currency', align: 'right' },
          { key: 'rate', label: 'Rate', format: 'percentage', align: 'right' },
          { key: 'claim', label: 'Annual Claim', format: 'currency', align: 'right' },
        ],
        depreciation.map((d) => ({
          asset: d.assetName,
          property: d.propertyName,
          category: d.category,
          method: d.method === 'PRIME_COST' ? 'Prime Cost' : 'Diminishing Value',
          cost: d.cost,
          rate: d.rate,
          claim: d.annualDeduction,
        })),
        {
          cost: depreciation.reduce((sum, d) => sum + d.cost, 0),
          claim: totalDepreciation,
        }
      )
    );
  }

  // Section 5: Rental Property Summary
  if (properties.length > 0) {
    const rentalProperties = properties.filter(
      (p) => p.linkedIncomesCount > 0 || p.annualDepreciation > 0
    );

    if (rentalProperties.length > 0) {
      sections.push(
        createTableSection(
          'rental-summary',
          'Rental Property Summary',
          6,
          [
            { key: 'name', label: 'Property', format: 'text', align: 'left' },
            { key: 'address', label: 'Address', format: 'text', align: 'left' },
            { key: 'incomes', label: 'Income Sources', format: 'number', align: 'center' },
            { key: 'expenses', label: 'Expenses', format: 'number', align: 'center' },
            { key: 'depreciation', label: 'Depreciation', format: 'currency', align: 'right' },
          ],
          rentalProperties.map((p) => ({
            name: p.name,
            address: p.address || '-',
            incomes: p.linkedIncomesCount,
            expenses: p.linkedExpensesCount,
            depreciation: p.annualDepreciation,
          }))
        )
      );
    }
  }

  // Section 6: Important Notes
  sections.push({
    id: 'tax-notes',
    title: 'Important Notes',
    order: 7,
    visible: true,
    type: 'text',
    content:
      'This report is generated for informational purposes only. ' +
      'Please consult with a qualified tax professional before filing your tax return. ' +
      'Verify all figures against your official records and receipts.',
    annotations: [
      'Depreciation claims should be supported by a Quantity Surveyor report for investment properties.',
      'Work-related expenses require proper documentation and must be directly related to earning income.',
      'Interest on investment loans may be fully deductible if the funds are used for income-producing purposes.',
    ],
  });

  return sections;
}
