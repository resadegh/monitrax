/**
 * Financial Overview Report Generator
 */

import type { ReportContext, ReportConfig, AnyReportSection } from '../types';
import { createMetricSection, createTableSection, formatCurrency, formatPercentage } from './index';

export function generateFinancialOverviewReport(
  context: ReportContext,
  config: ReportConfig
): AnyReportSection[] {
  const sections: AnyReportSection[] = [];

  // Section 1: Key Metrics
  sections.push(
    createMetricSection('key-metrics', 'Key Financial Metrics', 1, [
      {
        label: 'Net Worth',
        value: formatCurrency(context.netWorth),
        format: 'currency',
        description: 'Total assets minus total liabilities',
      },
      {
        label: 'Total Assets',
        value: formatCurrency(context.totalAssets),
        format: 'currency',
        description: 'Properties + Accounts + Investments',
      },
      {
        label: 'Total Liabilities',
        value: formatCurrency(context.totalLiabilities),
        format: 'currency',
        description: 'All outstanding loans and debts',
      },
      {
        label: 'Health Score',
        value: `${context.healthScore}/100`,
        format: 'text',
        description: 'Overall financial health indicator',
      },
      {
        label: 'Cashflow Runway',
        value: `${context.cashflowRunway} months`,
        format: 'text',
        description: 'Months of expenses covered by liquid assets',
      },
    ])
  );

  // Section 2: Portfolio Counts
  sections.push(
    createMetricSection('portfolio-counts', 'Portfolio Overview', 2, [
      { label: 'Properties', value: context.counts.properties, format: 'number' },
      { label: 'Loans', value: context.counts.loans, format: 'number' },
      { label: 'Accounts', value: context.counts.accounts, format: 'number' },
      { label: 'Investment Accounts', value: context.counts.investments, format: 'number' },
      { label: 'Income Sources', value: context.counts.incomes, format: 'number' },
      { label: 'Expense Categories', value: context.counts.expenses, format: 'number' },
    ])
  );

  // Section 3: Properties Summary (if available)
  if (context.properties && context.properties.length > 0) {
    const totalPropertyValue = context.properties.reduce((sum, p) => sum + p.currentValue, 0);
    const totalEquity = context.properties.reduce((sum, p) => sum + p.equity, 0);

    sections.push(
      createTableSection(
        'properties-summary',
        'Property Portfolio',
        3,
        [
          { key: 'name', label: 'Property', format: 'text', align: 'left' },
          { key: 'currentValue', label: 'Value', format: 'currency', align: 'right' },
          { key: 'equity', label: 'Equity', format: 'currency', align: 'right' },
          { key: 'lvr', label: 'LVR', format: 'percentage', align: 'right' },
        ],
        context.properties.map((p) => ({
          name: p.name,
          currentValue: p.currentValue,
          equity: p.equity,
          lvr: p.lvr,
        })),
        {
          currentValue: totalPropertyValue,
          equity: totalEquity,
        }
      )
    );
  }

  // Section 4: Loans Summary (if available)
  if (context.loans && context.loans.length > 0) {
    const totalBalance = context.loans.reduce((sum, l) => sum + l.currentBalance, 0);
    const avgRate = context.loans.length > 0
      ? context.loans.reduce((sum, l) => sum + l.interestRate, 0) / context.loans.length
      : 0;

    sections.push(
      createTableSection(
        'loans-summary',
        'Loans & Debt',
        4,
        [
          { key: 'name', label: 'Loan', format: 'text', align: 'left' },
          { key: 'currentBalance', label: 'Balance', format: 'currency', align: 'right' },
          { key: 'interestRate', label: 'Rate', format: 'percentage', align: 'right' },
          { key: 'monthlyRepayment', label: 'Monthly', format: 'currency', align: 'right' },
        ],
        context.loans.map((l) => ({
          name: l.name,
          currentBalance: l.currentBalance,
          interestRate: l.interestRate,
          monthlyRepayment: l.monthlyRepayment,
        })),
        {
          currentBalance: totalBalance,
        }
      )
    );
  }

  // Section 5: Accounts Summary (if available)
  if (context.accounts && context.accounts.length > 0) {
    const totalBalance = context.accounts.reduce((sum, a) => sum + a.balance, 0);

    sections.push(
      createTableSection(
        'accounts-summary',
        'Bank Accounts',
        5,
        [
          { key: 'name', label: 'Account', format: 'text', align: 'left' },
          { key: 'type', label: 'Type', format: 'text', align: 'left' },
          { key: 'institution', label: 'Institution', format: 'text', align: 'left' },
          { key: 'balance', label: 'Balance', format: 'currency', align: 'right' },
        ],
        context.accounts.map((a) => ({
          name: a.name,
          type: a.type,
          institution: a.institution || '-',
          balance: a.balance,
        })),
        {
          balance: totalBalance,
        }
      )
    );
  }

  // Section 6: Investments Summary (if available)
  if (context.investments && context.investments.length > 0) {
    const totalValue = context.investments.reduce((sum, i) => sum + i.currentValue, 0);
    const totalGainLoss = context.investments.reduce((sum, i) => sum + i.totalGainLoss, 0);

    sections.push(
      createTableSection(
        'investments-summary',
        'Investments',
        6,
        [
          { key: 'symbol', label: 'Symbol', format: 'text', align: 'left' },
          { key: 'name', label: 'Name', format: 'text', align: 'left' },
          { key: 'currentValue', label: 'Value', format: 'currency', align: 'right' },
          { key: 'totalGainLoss', label: 'Gain/Loss', format: 'currency', align: 'right' },
        ],
        context.investments.map((i) => ({
          symbol: i.symbol,
          name: i.name,
          currentValue: i.currentValue,
          totalGainLoss: i.totalGainLoss,
        })),
        {
          currentValue: totalValue,
          totalGainLoss: totalGainLoss,
        }
      )
    );
  }

  return sections;
}
