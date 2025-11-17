'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  TrendingUp,
  Wallet,
  Home,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Receipt,
} from 'lucide-react';

interface DashboardStats {
  totalProperties: number;
  totalPropertyValue: number;
  totalLoans: number;
  totalLoanBalance: number;
  totalIncome: number;
  totalExpenses: number;
  netWorth: number;
  monthlyFlow: number;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    totalPropertyValue: 0,
    totalLoans: 0,
    totalLoanBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    netWorth: 0,
    monthlyFlow: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async () => {
    try {
      // Fetch all data in parallel
      const [propertiesRes, loansRes, incomeRes, expensesRes] = await Promise.all([
        fetch('/api/properties', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/loans', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/income', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/expenses', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const properties = propertiesRes.ok ? await propertiesRes.json() : [];
      const loans = loansRes.ok ? await loansRes.json() : [];
      const income = incomeRes.ok ? await incomeRes.json() : [];
      const expenses = expensesRes.ok ? await expensesRes.json() : [];

      // Calculate stats
      const totalPropertyValue = properties.reduce((sum: number, p: any) => sum + (p.currentValue || 0), 0);
      const totalLoanBalance = loans.reduce((sum: number, l: any) => sum + l.principal, 0);

      // Convert all income to monthly
      const totalMonthlyIncome = income.reduce((sum: number, i: any) => {
        const amount = i.amount;
        switch (i.frequency) {
          case 'WEEKLY': return sum + (amount * 52 / 12);
          case 'FORTNIGHTLY': return sum + (amount * 26 / 12);
          case 'MONTHLY': return sum + amount;
          case 'ANNUALLY': return sum + (amount / 12);
          default: return sum;
        }
      }, 0);

      // Convert all expenses to monthly
      const totalMonthlyExpenses = expenses.reduce((sum: number, e: any) => {
        const amount = e.amount;
        switch (e.frequency) {
          case 'WEEKLY': return sum + (amount * 52 / 12);
          case 'FORTNIGHTLY': return sum + (amount * 26 / 12);
          case 'MONTHLY': return sum + amount;
          case 'ANNUALLY': return sum + (amount / 12);
          default: return sum;
        }
      }, 0);

      setStats({
        totalProperties: properties.length,
        totalPropertyValue,
        totalLoans: loans.length,
        totalLoanBalance,
        totalIncome: totalMonthlyIncome,
        totalExpenses: totalMonthlyExpenses,
        netWorth: totalPropertyValue - totalLoanBalance,
        monthlyFlow: totalMonthlyIncome - totalMonthlyExpenses,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Dashboard"
        description="Welcome to your financial overview"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Net Worth"
              value={formatCurrency(stats.netWorth)}
              description={`${formatCurrency(stats.totalPropertyValue)} in assets`}
              icon={Wallet}
              variant="purple"
            />
            <StatCard
              title="Monthly Cash Flow"
              value={formatCurrency(stats.monthlyFlow)}
              description={stats.monthlyFlow >= 0 ? 'Positive cash flow' : 'Negative cash flow'}
              icon={stats.monthlyFlow >= 0 ? ArrowUpRight : ArrowDownRight}
              variant={stats.monthlyFlow >= 0 ? 'green' : 'orange'}
            />
            <StatCard
              title="Properties"
              value={stats.totalProperties}
              description={formatCurrency(stats.totalPropertyValue)}
              icon={Home}
              variant="blue"
            />
            <StatCard
              title="Total Debt"
              value={formatCurrency(stats.totalLoanBalance)}
              description={`Across ${stats.totalLoans} loan${stats.totalLoans !== 1 ? 's' : ''}`}
              icon={Banknote}
              variant="orange"
            />
          </div>

          {/* Monthly Overview */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-l-4 border-l-green-500 dark:border-l-green-400 bg-gradient-to-br from-green-50 to-white dark:from-green-950/50 dark:to-slate-800 hover:shadow-lg hover:shadow-green-100 dark:hover:shadow-green-900/50 transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span>Monthly Income</span>
                </CardTitle>
                <CardDescription>Total income per month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700 dark:text-green-400">{formatCurrency(stats.totalIncome)}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 dark:border-l-orange-400 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950/50 dark:to-slate-800 hover:shadow-lg hover:shadow-orange-100 dark:hover:shadow-orange-900/50 transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                    <ArrowDownRight className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span>Monthly Expenses</span>
                </CardTitle>
                <CardDescription>Total expenses per month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">{formatCurrency(stats.totalExpenses)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/dashboard/properties">
                  <Button variant="outline" className="w-full h-auto flex-col items-start gap-2 p-4">
                    <Home className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Properties</div>
                      <div className="text-xs text-muted-foreground">Manage your properties</div>
                    </div>
                  </Button>
                </Link>

                <Link href="/dashboard/loans">
                  <Button variant="outline" className="w-full h-auto flex-col items-start gap-2 p-4">
                    <Banknote className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Loans</div>
                      <div className="text-xs text-muted-foreground">Track your loans</div>
                    </div>
                  </Button>
                </Link>

                <Link href="/dashboard/debt-planner">
                  <Button variant="outline" className="w-full h-auto flex-col items-start gap-2 p-4">
                    <Calculator className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Debt Planner</div>
                      <div className="text-xs text-muted-foreground">Optimize repayments</div>
                    </div>
                  </Button>
                </Link>

                <Link href="/dashboard/tax">
                  <Button variant="outline" className="w-full h-auto flex-col items-start gap-2 p-4">
                    <Receipt className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Tax Calculator</div>
                      <div className="text-xs text-muted-foreground">View estimates</div>
                    </div>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Getting Started */}
          {stats.totalProperties === 0 && stats.totalLoans === 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle>Getting Started with Monitrax</CardTitle>
                <CardDescription>
                  Set up your financial profile to get the most out of Monitrax
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary">1.</span>
                    <span>Add your properties (home, investments)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary">2.</span>
                    <span>Add your loans and link them to properties</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary">3.</span>
                    <span>Add your income sources</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary">4.</span>
                    <span>Add your expenses</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-primary">5.</span>
                    <span>Use the Debt Planner to optimize your repayments</span>
                  </li>
                </ol>
                <div className="mt-4">
                  <Link href="/dashboard/properties">
                    <Button>Get Started</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
