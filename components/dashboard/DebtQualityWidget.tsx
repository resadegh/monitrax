'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Home,
  Building2,
  Car,
  CreditCard,
  GraduationCap,
  Briefcase,
  Wallet,
  ArrowRight,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// Debt quality categorization based on tax deductibility and wealth-building potential
export type DebtCategory = 'good' | 'neutral' | 'bad';

export interface DebtBreakdown {
  type: string;
  principal: number;
  interestRate: number;
  monthlyRepayment: number;
  propertyName?: string | null;
  isDeductible: boolean;
}

export interface DebtQualityData {
  goodDebt: {
    total: number;
    loans: DebtBreakdown[];
    weightedRate: number;
  };
  neutralDebt: {
    total: number;
    loans: DebtBreakdown[];
    weightedRate: number;
  };
  badDebt: {
    total: number;
    loans: DebtBreakdown[];
    weightedRate: number;
  };
  totalDebt: number;
  debtQualityScore: number; // 0-100, higher = more "good" debt
  marginalTaxRate?: number;
}

interface DebtQualityWidgetProps {
  data: DebtQualityData;
  onDrillDown?: (category: DebtCategory) => void;
}

// Calculate effective interest rate after tax benefits
function calculateEffectiveRate(rate: number, isDeductible: boolean, marginalTaxRate: number = 0.37): number {
  if (!isDeductible) return rate;
  // Effective rate = nominal rate × (1 - marginal tax rate)
  return rate * (1 - marginalTaxRate);
}

// Get icon for loan type
function getLoanTypeIcon(type: string) {
  switch (type) {
    case 'INVESTMENT':
      return Building2;
    case 'HOME':
      return Home;
    case 'CAR':
      return Car;
    case 'BUSINESS':
      return Briefcase;
    case 'STUDENT':
      return GraduationCap;
    case 'PERSONAL':
    case 'LINE_OF_CREDIT':
    default:
      return CreditCard;
  }
}

// Get category label and color
function getCategoryConfig(category: DebtCategory) {
  switch (category) {
    case 'good':
      return {
        label: 'Good Debt',
        description: 'Tax-deductible, wealth-building',
        color: 'text-green-600',
        bgColor: 'bg-green-100 dark:bg-green-950/50',
        borderColor: 'border-green-500',
        progressColor: 'bg-green-500',
        icon: TrendingUp,
      };
    case 'neutral':
      return {
        label: 'Neutral Debt',
        description: 'Primary residence',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100 dark:bg-blue-950/50',
        borderColor: 'border-blue-500',
        progressColor: 'bg-blue-500',
        icon: Home,
      };
    case 'bad':
      return {
        label: 'Bad Debt',
        description: 'Consumer, non-deductible',
        color: 'text-red-600',
        bgColor: 'bg-red-100 dark:bg-red-950/50',
        borderColor: 'border-red-500',
        progressColor: 'bg-red-500',
        icon: TrendingDown,
      };
  }
}

// Get score interpretation
function getScoreInterpretation(score: number): { label: string; color: string; message: string } {
  if (score >= 80) {
    return {
      label: 'Excellent',
      color: 'text-green-600',
      message: 'Your debt is mostly wealth-building',
    };
  }
  if (score >= 60) {
    return {
      label: 'Good',
      color: 'text-blue-600',
      message: 'Good mix with room to improve',
    };
  }
  if (score >= 40) {
    return {
      label: 'Fair',
      color: 'text-yellow-600',
      message: 'Consider reducing consumer debt',
    };
  }
  if (score >= 20) {
    return {
      label: 'Poor',
      color: 'text-orange-600',
      message: 'High consumer debt - prioritize payoff',
    };
  }
  return {
    label: 'Critical',
    color: 'text-red-600',
    message: 'Focus on eliminating bad debt',
  };
}

export function DebtQualityWidget({ data, onDrillDown }: DebtQualityWidgetProps) {
  const { goodDebt, neutralDebt, badDebt, totalDebt, debtQualityScore, marginalTaxRate = 0.37 } = data;
  const interpretation = getScoreInterpretation(debtQualityScore);

  // Calculate percentages
  const goodPercent = totalDebt > 0 ? (goodDebt.total / totalDebt) * 100 : 0;
  const neutralPercent = totalDebt > 0 ? (neutralDebt.total / totalDebt) * 100 : 0;
  const badPercent = totalDebt > 0 ? (badDebt.total / totalDebt) * 100 : 0;

  // No debt scenario
  if (totalDebt === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-green-600" />
            Debt Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-green-600">Debt Free!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No liabilities recorded
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Debt Quality
          </div>
          <Badge className={`${interpretation.color} bg-opacity-20`}>
            {interpretation.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Score Circle */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-muted/20"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${debtQualityScore * 2.01} 201`}
                  className={interpretation.color}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-bold ${interpretation.color}`}>
                  {debtQualityScore}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{interpretation.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {formatCurrency(totalDebt)}
              </p>
            </div>
          </div>

          {/* Stacked Bar */}
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded-full overflow-hidden flex">
              {goodPercent > 0 && (
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${goodPercent}%` }}
                  title={`Good Debt: ${formatCurrency(goodDebt.total)}`}
                />
              )}
              {neutralPercent > 0 && (
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${neutralPercent}%` }}
                  title={`Neutral Debt: ${formatCurrency(neutralDebt.total)}`}
                />
              )}
              {badPercent > 0 && (
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${badPercent}%` }}
                  title={`Bad Debt: ${formatCurrency(badDebt.total)}`}
                />
              )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-3">
            {/* Good Debt */}
            {goodDebt.total > 0 && (
              <div
                className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
                onClick={() => onDrillDown?.('good')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-400">
                      Good Debt
                    </span>
                    <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                      Tax Deductible
                    </Badge>
                  </div>
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(goodDebt.total)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{goodDebt.loans.length} loan{goodDebt.loans.length !== 1 ? 's' : ''} (Investment, Business)</span>
                  <span>
                    Effective rate: {calculateEffectiveRate(goodDebt.weightedRate, true, marginalTaxRate).toFixed(2)}%
                    <span className="text-green-600 ml-1">
                      (saves {((goodDebt.weightedRate - calculateEffectiveRate(goodDebt.weightedRate, true, marginalTaxRate)) * goodDebt.total / 100).toFixed(0)}/yr)
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Neutral Debt */}
            {neutralDebt.total > 0 && (
              <div
                className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                onClick={() => onDrillDown?.('neutral')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-700 dark:text-blue-400">
                      Neutral Debt
                    </span>
                  </div>
                  <span className="font-bold text-blue-700 dark:text-blue-400">
                    {formatCurrency(neutralDebt.total)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{neutralDebt.loans.length} loan{neutralDebt.loans.length !== 1 ? 's' : ''} (Primary Residence)</span>
                  <span>Rate: {neutralDebt.weightedRate.toFixed(2)}%</span>
                </div>
              </div>
            )}

            {/* Bad Debt */}
            {badDebt.total > 0 && (
              <div
                className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
                onClick={() => onDrillDown?.('bad')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-700 dark:text-red-400">
                      Bad Debt
                    </span>
                    <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                      Prioritize Payoff
                    </Badge>
                  </div>
                  <span className="font-bold text-red-700 dark:text-red-400">
                    {formatCurrency(badDebt.total)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{badDebt.loans.length} loan{badDebt.loans.length !== 1 ? 's' : ''} (Car, Personal, Credit)</span>
                  <span>Rate: {badDebt.weightedRate.toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Link */}
          <div className="pt-2 border-t">
            <Link
              href="/dashboard/debt-planner"
              className="flex items-center justify-between text-sm text-primary hover:underline"
            >
              <span>View Debt Payoff Strategy</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to calculate debt quality data from loans
export function calculateDebtQuality(
  loans: Array<{
    id: string;
    name: string;
    type: string;
    principal: number;
    interestRate: number;
    minRepayment?: number;
    repaymentFrequency?: string;
    propertyId?: string | null;
    propertyName?: string | null;
    annualRepayment?: number;
  }>,
  marginalTaxRate: number = 0.37
): DebtQualityData {
  const goodLoans: DebtBreakdown[] = [];
  const neutralLoans: DebtBreakdown[] = [];
  const badLoans: DebtBreakdown[] = [];

  loans.forEach(loan => {
    const breakdown: DebtBreakdown = {
      type: loan.type,
      principal: loan.principal,
      interestRate: loan.interestRate,
      monthlyRepayment: (loan.annualRepayment || 0) / 12,
      propertyName: loan.propertyName,
      isDeductible: loan.type === 'INVESTMENT' || loan.type === 'BUSINESS',
    };

    // Categorize based on loan type
    switch (loan.type) {
      case 'INVESTMENT':
      case 'BUSINESS':
        // Good debt: tax-deductible, wealth-building
        goodLoans.push(breakdown);
        break;
      case 'HOME':
        // Neutral debt: primary residence (not deductible in Australia)
        neutralLoans.push(breakdown);
        break;
      case 'CAR':
      case 'PERSONAL':
      case 'LINE_OF_CREDIT':
      case 'STUDENT':
      default:
        // Bad debt: consumer debt, depreciating assets
        badLoans.push(breakdown);
        break;
    }
  });

  // Calculate totals and weighted rates
  const calcCategoryTotal = (loans: DebtBreakdown[]) => ({
    total: loans.reduce((sum, l) => sum + l.principal, 0),
    loans,
    weightedRate: loans.length > 0
      ? loans.reduce((sum, l) => sum + (l.interestRate * l.principal), 0) /
        loans.reduce((sum, l) => sum + l.principal, 0)
      : 0,
  });

  const goodDebt = calcCategoryTotal(goodLoans);
  const neutralDebt = calcCategoryTotal(neutralLoans);
  const badDebt = calcCategoryTotal(badLoans);
  const totalDebt = goodDebt.total + neutralDebt.total + badDebt.total;

  // Calculate debt quality score (0-100)
  // Higher score = more "good" debt relative to total
  // Formula: (goodDebt * 100 + neutralDebt * 50 + badDebt * 0) / totalDebt
  let debtQualityScore = 0;
  if (totalDebt > 0) {
    debtQualityScore = Math.round(
      ((goodDebt.total * 100) + (neutralDebt.total * 50) + (badDebt.total * 0)) / totalDebt
    );
  }

  return {
    goodDebt,
    neutralDebt,
    badDebt,
    totalDebt,
    debtQualityScore,
    marginalTaxRate,
  };
}
