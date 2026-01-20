'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Calculator,
  DollarSign,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// ============================================================================
// PHASE 2: EXPENSE TREND INDICATOR
// ============================================================================

export interface ExpenseTrendData {
  currentMonth: number;
  previousMonth: number;
  threeMonthAvg: number;
  percentChange: number;
  trend: 'up' | 'down' | 'stable';
}

interface ExpenseTrendIndicatorProps {
  data: ExpenseTrendData;
  label?: string;
}

export function ExpenseTrendIndicator({ data, label = 'vs last month' }: ExpenseTrendIndicatorProps) {
  const { percentChange, trend } = data;

  const getTrendConfig = () => {
    if (trend === 'up') {
      return {
        icon: TrendingUp,
        color: 'text-red-600',
        bgColor: 'bg-red-100 dark:bg-red-950/50',
        label: 'Spending increased',
      };
    }
    if (trend === 'down') {
      return {
        icon: TrendingDown,
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-950/50',
        label: 'Spending decreased',
      };
    }
    return {
      icon: Minus,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      label: 'Spending stable',
    };
  };

  const config = getTrendConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.bgColor} ${config.color} cursor-help`}>
            <Icon className="h-3 w-3" />
            <span>{Math.abs(percentChange).toFixed(1)}%</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-semibold">{config.label}</p>
            <p>This month: {formatCurrency(data.currentMonth)}</p>
            <p>Last month: {formatCurrency(data.previousMonth)}</p>
            <p>3-month avg: {formatCurrency(data.threeMonthAvg)}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// PHASE 2: CALCULATION FORMULA TOOLTIP
// ============================================================================

export interface FormulaComponent {
  label: string;
  value: number;
  operator?: '+' | '-' | '×' | '÷' | '=';
  color?: 'green' | 'red' | 'blue' | 'purple';
  drillDownUrl?: string;
}

interface CalculationTooltipProps {
  title: string;
  formula: string;
  components: FormulaComponent[];
  result: number;
  resultLabel?: string;
  children: React.ReactNode;
}

export function CalculationTooltip({
  title,
  formula,
  components,
  result,
  resultLabel = 'Result',
  children,
}: CalculationTooltipProps) {
  const getColorClass = (color?: string) => {
    switch (color) {
      case 'green': return 'text-green-600';
      case 'red': return 'text-red-600';
      case 'blue': return 'text-blue-600';
      case 'purple': return 'text-purple-600';
      default: return '';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className="cursor-help inline-flex items-center gap-1">
            {children}
            <Info className="h-3 w-3 text-muted-foreground opacity-50 hover:opacity-100 transition-opacity" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-b pb-2">
              <Calculator className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">{title}</span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{formula}</p>
            <div className="space-y-1 pt-1">
              {components.map((comp, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {comp.operator && <span className="mr-1 font-mono">{comp.operator}</span>}
                    {comp.label}
                  </span>
                  <span className={`font-medium ${getColorClass(comp.color)}`}>
                    {formatCurrency(comp.value)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs font-bold border-t pt-1 mt-1">
                <span>= {resultLabel}</span>
                <span className={result >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(result)}
                </span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// PHASE 2: INVESTMENT INCOME DISPLAY (for account cards)
// ============================================================================

export interface InvestmentIncomeData {
  accountId: string;
  monthlyDividends: number;
  monthlyDistributions: number;
  annualDividends: number;
  annualDistributions: number;
  totalMonthlyIncome: number;
  totalAnnualIncome: number;
}

interface InvestmentIncomeDisplayProps {
  data: InvestmentIncomeData;
  compact?: boolean;
}

export function InvestmentIncomeDisplay({ data, compact = false }: InvestmentIncomeDisplayProps) {
  if (data.totalMonthlyIncome === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 text-xs text-green-600">
        <DollarSign className="h-3 w-3" />
        <span>+{formatCurrency(data.totalMonthlyIncome)}/mo income</span>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t space-y-1">
      <p className="text-xs text-muted-foreground font-medium">Investment Income</p>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Monthly</span>
        <span className="text-sm font-semibold text-green-600">
          +{formatCurrency(data.totalMonthlyIncome)}
        </span>
      </div>
      {data.monthlyDividends > 0 && data.monthlyDistributions > 0 && (
        <div className="text-xs text-muted-foreground pl-2 space-y-0.5">
          <div className="flex justify-between">
            <span>Dividends</span>
            <span>{formatCurrency(data.monthlyDividends)}</span>
          </div>
          <div className="flex justify-between">
            <span>Distributions</span>
            <span>{formatCurrency(data.monthlyDistributions)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to calculate investment income from income records
export function calculateInvestmentIncome(
  accountId: string,
  income: Array<{
    type: string;
    investmentAccountId?: string | null;
    netAnnual: number;
  }>
): InvestmentIncomeData {
  const linkedIncome = income.filter(
    (i) => i.investmentAccountId === accountId
  );

  const annualDividends = linkedIncome
    .filter((i) => i.type === 'DIVIDEND')
    .reduce((sum, i) => sum + i.netAnnual, 0);

  const annualDistributions = linkedIncome
    .filter((i) => i.type === 'DISTRIBUTION')
    .reduce((sum, i) => sum + i.netAnnual, 0);

  return {
    accountId,
    monthlyDividends: annualDividends / 12,
    monthlyDistributions: annualDistributions / 12,
    annualDividends,
    annualDistributions,
    totalMonthlyIncome: (annualDividends + annualDistributions) / 12,
    totalAnnualIncome: annualDividends + annualDistributions,
  };
}

// ============================================================================
// PHASE 3: LINKAGE HEALTH INDICATOR
// ============================================================================

export interface LinkageHealthData {
  completenessScore: number;
  orphanCount: number;
  warningCount: number;
  status: 'excellent' | 'good' | 'warning' | 'poor';
}

interface LinkageHealthIndicatorProps {
  data: LinkageHealthData;
  showDetails?: boolean;
}

export function LinkageHealthIndicator({ data, showDetails = false }: LinkageHealthIndicatorProps) {
  const getStatusConfig = () => {
    switch (data.status) {
      case 'excellent':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100 dark:bg-green-950/50',
          icon: CheckCircle2,
          label: 'Data Complete',
        };
      case 'good':
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-100 dark:bg-blue-950/50',
          icon: CheckCircle2,
          label: 'Mostly Complete',
        };
      case 'warning':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-100 dark:bg-yellow-950/50',
          icon: AlertCircle,
          label: 'Missing Links',
        };
      case 'poor':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100 dark:bg-red-950/50',
          icon: AlertCircle,
          label: 'Incomplete Data',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs cursor-help ${config.bgColor} ${config.color}`}>
            <Icon className="h-3 w-3" />
            <span>{data.completenessScore}%</span>
            {showDetails && <span className="hidden sm:inline">{config.label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-semibold">Data Completeness: {data.completenessScore}%</p>
            {data.orphanCount > 0 && (
              <p className="text-yellow-600">{data.orphanCount} unlinked entities</p>
            )}
            {data.warningCount > 0 && (
              <p className="text-orange-600">{data.warningCount} data warnings</p>
            )}
            <p className="text-muted-foreground pt-1">
              Click for details
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Helper to calculate linkage health status
export function calculateLinkageHealthStatus(
  completenessScore: number,
  orphanCount: number,
  warningCount: number
): LinkageHealthData {
  let status: LinkageHealthData['status'] = 'excellent';

  if (completenessScore < 50 || orphanCount > 5) {
    status = 'poor';
  } else if (completenessScore < 75 || orphanCount > 2) {
    status = 'warning';
  } else if (completenessScore < 90 || orphanCount > 0) {
    status = 'good';
  }

  return {
    completenessScore,
    orphanCount,
    warningCount,
    status,
  };
}

// ============================================================================
// PHASE 4: ENTITY COMPARISON CHART (Mini Bar Chart)
// ============================================================================

export interface EntityComparisonItem {
  name: string;
  type: 'property' | 'investment' | 'loan' | 'asset';
  cashflow: number;
  color: string;
}

interface EntityComparisonChartProps {
  items: EntityComparisonItem[];
  title?: string;
}

export function EntityComparisonChart({ items, title = 'Cashflow Contributors' }: EntityComparisonChartProps) {
  if (items.length === 0) {
    return null;
  }

  // Sort by absolute cashflow value
  const sortedItems = [...items].sort((a, b) => Math.abs(b.cashflow) - Math.abs(a.cashflow));
  const maxAbsValue = Math.max(...items.map(i => Math.abs(i.cashflow)));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedItems.slice(0, 6).map((item, idx) => {
            const isPositive = item.cashflow >= 0;
            const widthPercent = maxAbsValue > 0 ? (Math.abs(item.cashflow) / maxAbsValue) * 100 : 0;

            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.name}</span>
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {item.type}
                    </Badge>
                  </div>
                  <span className={`font-semibold flex-shrink-0 ml-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{formatCurrency(item.cashflow)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
          {sortedItems.length > 6 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{sortedItems.length - 6} more entities
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to build entity comparison data
export function buildEntityComparisonData(
  properties: Array<{ name: string; cashflow: { monthlyNet: number } }>,
  investments: Array<{ name: string; monthlyIncome: number }>,
  loans: Array<{ name: string; netCashflowImpact: number }>
): EntityComparisonItem[] {
  const items: EntityComparisonItem[] = [];

  // Properties
  properties.forEach((p) => {
    items.push({
      name: p.name,
      type: 'property',
      cashflow: p.cashflow.monthlyNet,
      color: '#3b82f6', // blue
    });
  });

  // Investments (income only)
  investments.forEach((inv) => {
    if (inv.monthlyIncome > 0) {
      items.push({
        name: inv.name,
        type: 'investment',
        cashflow: inv.monthlyIncome,
        color: '#a855f7', // purple
      });
    }
  });

  // Loans (negative impact)
  loans.forEach((loan) => {
    items.push({
      name: loan.name,
      type: 'loan',
      cashflow: -loan.netCashflowImpact,
      color: '#f97316', // orange
    });
  });

  return items;
}

// ============================================================================
// PHASE 4: QUICK ACTION BUTTONS
// ============================================================================

interface QuickActionProps {
  label: string;
  href: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'outline' | 'ghost';
}

export function QuickActionButton({ label, href, icon, variant = 'outline' }: QuickActionProps) {
  return (
    <Link href={href}>
      <Button variant={variant} size="sm" className="gap-2">
        {icon}
        {label}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </Link>
  );
}

interface QuickActionsBarProps {
  actions: QuickActionProps[];
}

export function QuickActionsBar({ actions }: QuickActionsBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, idx) => (
        <QuickActionButton key={idx} {...action} />
      ))}
    </div>
  );
}
