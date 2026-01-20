'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Flame,
  Droplets,
  Target,
  ArrowRight,
  Info,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

interface HealthScoreProps {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    savingsRate: { score: number; weight: number; value: number };
    emergencyFund: { score: number; weight: number; value: number };
    debtToIncome: { score: number; weight: number; value: number };
    diversification: { score: number; weight: number; value: number };
  };
}

export function FinancialHealthScore({ score, grade, breakdown }: HealthScoreProps) {
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100 dark:bg-green-950/50';
      case 'B': return 'text-blue-600 bg-blue-100 dark:bg-blue-950/50';
      case 'C': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50';
      case 'D': return 'text-orange-600 bg-orange-100 dark:bg-orange-950/50';
      case 'F': return 'text-red-600 bg-red-100 dark:bg-red-950/50';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 65) return 'text-blue-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 35) return 'text-orange-600';
    return 'text-red-600';
  };

  const getMessage = (grade: string) => {
    switch (grade) {
      case 'A': return 'Excellent financial health!';
      case 'B': return 'Good, with room to improve';
      case 'C': return 'Average - focus on weak areas';
      case 'D': return 'Needs attention';
      case 'F': return 'Critical - take action now';
      default: return '';
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <Shield className="w-full h-full" />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          Financial Health Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Score Circle */}
          <div className="relative">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted/20"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${score * 2.51} 251`}
                className={getScoreColor(score)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
          </div>

          {/* Grade & Message */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge className={`text-lg px-3 py-1 ${getGradeColor(grade)}`}>
                Grade {grade}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{getMessage(grade)}</p>

            {/* Mini breakdown */}
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Savings</span>
                <span className={breakdown.savingsRate.value >= 20 ? 'text-green-600' : breakdown.savingsRate.value >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                  {breakdown.savingsRate.value.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Emergency Fund</span>
                <span className={breakdown.emergencyFund.value >= 6 ? 'text-green-600' : breakdown.emergencyFund.value >= 3 ? 'text-yellow-600' : 'text-red-600'}>
                  {breakdown.emergencyFund.value.toFixed(1)} mo
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Debt/Income</span>
                <span className={breakdown.debtToIncome.value <= 30 ? 'text-green-600' : breakdown.debtToIncome.value <= 50 ? 'text-yellow-600' : 'text-red-600'}>
                  {breakdown.debtToIncome.value.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface EmergencyFundProps {
  liquidCash: number;
  monthlyExpenses: number;
  monthsCovered: number;
  target: number;
  status: 'danger' | 'warning' | 'good' | 'excellent';
  gap: number;
}

export function EmergencyFundTracker({
  liquidCash,
  monthlyExpenses,
  monthsCovered,
  target,
  status,
  gap,
}: EmergencyFundProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'danger':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-100 dark:bg-red-950/50',
          progressColor: 'bg-red-500',
          icon: AlertTriangle,
          label: 'Critical',
        };
      case 'warning':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-100 dark:bg-orange-950/50',
          progressColor: 'bg-orange-500',
          icon: AlertTriangle,
          label: 'Building',
        };
      case 'good':
        return {
          color: 'text-blue-600',
          bgColor: 'bg-blue-100 dark:bg-blue-950/50',
          progressColor: 'bg-blue-500',
          icon: TrendingUp,
          label: 'Good',
        };
      case 'excellent':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-100 dark:bg-green-950/50',
          progressColor: 'bg-green-500',
          icon: CheckCircle2,
          label: 'Excellent',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const progressPercentage = Math.min((monthsCovered / target) * 100, 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Emergency Fund
          </div>
          <Badge className={config.bgColor + ' ' + config.color}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main metric */}
          <div className="text-center py-2">
            <div className={`text-4xl font-bold ${config.color}`}>
              {monthsCovered.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">
              months of expenses covered
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress to {target} months</span>
              <span>{progressPercentage.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${config.progressColor} rounded-full transition-all duration-500`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            {/* Month markers */}
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>0</span>
              <span>3</span>
              <span>6</span>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t text-sm">
            <div>
              <p className="text-muted-foreground">Cash Available</p>
              <p className="font-semibold">{formatCurrency(liquidCash)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Monthly Expenses</p>
              <p className="font-semibold">{formatCurrency(monthlyExpenses)}</p>
            </div>
          </div>

          {/* Gap message */}
          {gap > 0 && (
            <div className={`text-sm p-3 rounded-lg ${config.bgColor}`}>
              <p className={config.color}>
                Save <strong>{formatCurrency(gap)}</strong> more to reach your {target}-month target
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface SpendingItem {
  name: string;
  category: string;
  monthlyAmount: number;
  annualAmount: number;
  percentageOfIncome: number;
  suggestion?: string;
}

interface MoneyBleedingProps {
  items: SpendingItem[];
  monthlyIncome: number;
}

export function MoneyBleedingCard({ items, monthlyIncome }: MoneyBleedingProps) {
  const topItems = items.slice(0, 5);
  const totalMonthly = topItems.reduce((sum, item) => sum + item.monthlyAmount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Droplets className="h-5 w-5 text-red-500" />
          Where Your Money Goes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topItems.map((item, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate max-w-[180px]">
                    {item.name}
                  </span>
                  {item.percentageOfIncome > 10 && (
                    <Flame className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(item.monthlyAmount)}/mo
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.percentageOfIncome > 15
                        ? 'bg-red-500'
                        : item.percentageOfIncome > 10
                        ? 'bg-orange-500'
                        : item.percentageOfIncome > 5
                        ? 'bg-yellow-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(item.percentageOfIncome * 3, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {item.percentageOfIncome.toFixed(1)}%
                </span>
              </div>
              {item.suggestion && (
                <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {item.suggestion}
                </p>
              )}
            </div>
          ))}

          {/* Total */}
          <div className="pt-3 mt-3 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Top 5 expenses total</span>
            <span className="font-bold">{formatCurrency(totalMonthly)}/mo</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface CategorySpending {
  category: string;
  monthlyAmount: number;
  annualAmount: number;
  percentage: number;
  items: Array<{ name: string; monthlyAmount: number }>;
}

interface SpendingByCategoryProps {
  categories: CategorySpending[];
}

export function SpendingByCategory({ categories }: SpendingByCategoryProps) {
  const topCategories = categories.slice(0, 6);
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-cyan-500',
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-purple-600" />
          Spending by Category
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topCategories.map((cat, index) => (
            <div key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`} />
                  <span className="font-medium">{cat.category}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold">{formatCurrency(cat.monthlyAmount)}</span>
                  <span className="text-muted-foreground text-xs ml-1">
                    ({cat.percentage.toFixed(0)}%)
                  </span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden ml-5">
                <div
                  className={`h-full ${colors[index % colors.length]} rounded-full transition-all duration-500`}
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface Insight {
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  metric?: string;
  action?: string;
}

interface ActionableInsightsProps {
  insights: Insight[];
}

export function ActionableInsights({ insights }: ActionableInsightsProps) {
  const getInsightStyle = (type: Insight['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
          icon: CheckCircle2,
          iconColor: 'text-green-600',
        };
      case 'warning':
        return {
          bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
          icon: AlertTriangle,
          iconColor: 'text-orange-600',
        };
      case 'danger':
        return {
          bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
          icon: AlertTriangle,
          iconColor: 'text-red-600',
        };
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
          icon: Info,
          iconColor: 'text-blue-600',
        };
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          What You Should Know
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const style = getInsightStyle(insight.type);
            const Icon = style.icon;

            return (
              <div
                key={index}
                className={`p-3 rounded-lg border ${style.bg}`}
              >
                <div className="flex gap-3">
                  <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${style.iconColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      {insight.metric && (
                        <Badge variant="secondary" className="text-xs">
                          {insight.metric}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {insight.message}
                    </p>
                    {insight.action && (
                      <p className="text-xs text-primary mt-2 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        {insight.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface MonthlyBudgetProps {
  income: number;
  essentialExpenses: number;
  discretionaryExpenses: number;
  loanPayments: number;
  remaining: number;
  dailyBudget: number;
}

export function MonthlyBudgetSummary({
  income,
  essentialExpenses,
  discretionaryExpenses,
  loanPayments,
  remaining,
  dailyBudget,
}: MonthlyBudgetProps) {
  const totalExpenses = essentialExpenses + discretionaryExpenses + loanPayments;
  const spentPercentage = income > 0 ? (totalExpenses / income) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-green-600" />
          This Month&apos;s Budget
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main flow visualization */}
          <div className="relative">
            {/* Income bar */}
            <div className="h-8 bg-green-100 dark:bg-green-950/50 rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-between px-3">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Income</span>
                <span className="text-sm font-bold text-green-700 dark:text-green-400">{formatCurrency(income)}</span>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center py-1">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Expenses breakdown bar */}
            <div className="h-8 bg-muted rounded-lg relative overflow-hidden flex">
              {essentialExpenses > 0 && (
                <div
                  className="h-full bg-blue-500 flex items-center justify-center"
                  style={{ width: `${(essentialExpenses / income) * 100}%` }}
                >
                  {(essentialExpenses / income) > 0.15 && (
                    <span className="text-xs text-white font-medium">Essential</span>
                  )}
                </div>
              )}
              {discretionaryExpenses > 0 && (
                <div
                  className="h-full bg-purple-500 flex items-center justify-center"
                  style={{ width: `${(discretionaryExpenses / income) * 100}%` }}
                >
                  {(discretionaryExpenses / income) > 0.15 && (
                    <span className="text-xs text-white font-medium">Wants</span>
                  )}
                </div>
              )}
              {loanPayments > 0 && (
                <div
                  className="h-full bg-orange-500 flex items-center justify-center"
                  style={{ width: `${(loanPayments / income) * 100}%` }}
                >
                  {(loanPayments / income) > 0.15 && (
                    <span className="text-xs text-white font-medium">Loans</span>
                  )}
                </div>
              )}
              {remaining > 0 && (
                <div
                  className="h-full bg-green-500 flex items-center justify-center"
                  style={{ width: `${(remaining / income) * 100}%` }}
                >
                  {(remaining / income) > 0.1 && (
                    <span className="text-xs text-white font-medium">Saved</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Essential</span>
              <span className="ml-auto font-medium">{formatCurrency(essentialExpenses)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-muted-foreground">Wants</span>
              <span className="ml-auto font-medium">{formatCurrency(discretionaryExpenses)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Loans</span>
              <span className="ml-auto font-medium">{formatCurrency(loanPayments)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Saved</span>
              <span className="ml-auto font-medium text-green-600">{formatCurrency(remaining)}</span>
            </div>
          </div>

          {/* Daily budget */}
          {dailyBudget > 0 && (
            <div className="pt-3 border-t text-center">
              <p className="text-sm text-muted-foreground">Daily spending budget</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(dailyBudget)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
