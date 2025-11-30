/**
 * Loan & Debt Report Generator
 */

import type { ReportContext, ReportConfig, AnyReportSection } from '../types';
import { createMetricSection, createTableSection, formatCurrency } from './index';

export function generateLoanDebtReport(
  context: ReportContext,
  config: ReportConfig
): AnyReportSection[] {
  const sections: AnyReportSection[] = [];

  const loans = context.loans || [];

  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal, 0);
  const totalBalance = loans.reduce((sum, l) => sum + l.currentBalance, 0);
  const totalMonthlyRepayments = loans.reduce((sum, l) => sum + l.monthlyRepayment, 0);
  const paidOff = totalPrincipal - totalBalance;
  const avgRate = loans.length > 0
    ? loans.reduce((sum, l) => sum + l.interestRate, 0) / loans.length
    : 0;

  // Group by type
  const byType = loans.reduce((acc, l) => {
    if (!acc[l.type]) {
      acc[l.type] = { count: 0, balance: 0 };
    }
    acc[l.type].count++;
    acc[l.type].balance += l.currentBalance;
    return acc;
  }, {} as Record<string, { count: number; balance: number }>);

  // Section 1: Debt Summary
  sections.push(
    createMetricSection('debt-summary', 'Debt Summary', 1, [
      {
        label: 'Total Outstanding',
        value: formatCurrency(totalBalance),
        format: 'currency',
        description: 'Current balance across all loans',
      },
      {
        label: 'Original Principal',
        value: formatCurrency(totalPrincipal),
        format: 'currency',
      },
      {
        label: 'Amount Paid Off',
        value: formatCurrency(paidOff),
        format: 'currency',
        trend: {
          value: totalPrincipal > 0 ? Math.round((paidOff / totalPrincipal) * 100) : 0,
          isPositive: true,
          period: 'repaid',
        },
      },
      {
        label: 'Monthly Repayments',
        value: formatCurrency(totalMonthlyRepayments),
        format: 'currency',
      },
      {
        label: 'Annual Repayments',
        value: formatCurrency(totalMonthlyRepayments * 12),
        format: 'currency',
      },
      {
        label: 'Average Interest Rate',
        value: `${avgRate.toFixed(2)}%`,
        format: 'percentage',
      },
    ])
  );

  // Section 2: Loan Details
  if (loans.length > 0) {
    sections.push(
      createTableSection(
        'loan-details',
        'Loan Details',
        2,
        [
          { key: 'name', label: 'Loan', format: 'text', align: 'left' },
          { key: 'type', label: 'Type', format: 'text', align: 'left' },
          { key: 'lender', label: 'Lender', format: 'text', align: 'left' },
          { key: 'principal', label: 'Principal', format: 'currency', align: 'right' },
          { key: 'balance', label: 'Balance', format: 'currency', align: 'right' },
          { key: 'rate', label: 'Rate', format: 'percentage', align: 'right' },
          { key: 'rateType', label: 'Rate Type', format: 'text', align: 'left' },
          { key: 'monthly', label: 'Monthly', format: 'currency', align: 'right' },
        ],
        loans.map((l) => ({
          name: l.name,
          type: l.type,
          lender: l.lender || '-',
          principal: l.principal,
          balance: l.currentBalance,
          rate: l.interestRate,
          rateType: l.rateType,
          monthly: l.monthlyRepayment,
        })),
        {
          principal: totalPrincipal,
          balance: totalBalance,
          monthly: totalMonthlyRepayments,
        }
      )
    );
  }

  // Section 3: Debt by Type
  if (Object.keys(byType).length > 0) {
    sections.push(
      createTableSection(
        'debt-by-type',
        'Debt by Type',
        3,
        [
          { key: 'type', label: 'Loan Type', format: 'text', align: 'left' },
          { key: 'count', label: 'Count', format: 'number', align: 'center' },
          { key: 'balance', label: 'Total Balance', format: 'currency', align: 'right' },
          { key: 'percentage', label: '% of Total', format: 'percentage', align: 'right' },
        ],
        Object.entries(byType).map(([type, data]) => ({
          type,
          count: data.count,
          balance: data.balance,
          percentage: totalBalance > 0 ? (data.balance / totalBalance) * 100 : 0,
        }))
      )
    );
  }

  // Section 4: Property-Linked Loans
  const propertyLoans = loans.filter((l) => l.linkedPropertyName);
  if (propertyLoans.length > 0) {
    sections.push(
      createTableSection(
        'property-loans',
        'Property-Linked Loans',
        4,
        [
          { key: 'name', label: 'Loan', format: 'text', align: 'left' },
          { key: 'property', label: 'Property', format: 'text', align: 'left' },
          { key: 'balance', label: 'Balance', format: 'currency', align: 'right' },
          { key: 'rate', label: 'Rate', format: 'percentage', align: 'right' },
        ],
        propertyLoans.map((l) => ({
          name: l.name,
          property: l.linkedPropertyName,
          balance: l.currentBalance,
          rate: l.interestRate,
        }))
      )
    );
  }

  return sections;
}
