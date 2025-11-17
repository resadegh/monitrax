'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

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
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Dashboard</h1>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Net Worth */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Net Worth</h3>
                  <span className="text-2xl">💎</span>
                </div>
                <p className={`text-2xl font-bold ${stats.netWorth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(stats.netWorth)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Assets: {formatCurrency(stats.totalPropertyValue)} | Debts: {formatCurrency(stats.totalLoanBalance)}
                </p>
              </div>

              {/* Monthly Cash Flow */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Monthly Cash Flow</h3>
                  <span className="text-2xl">💸</span>
                </div>
                <p className={`text-2xl font-bold ${stats.monthlyFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(stats.monthlyFlow)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Income: {formatCurrency(stats.totalIncome)} | Expenses: {formatCurrency(stats.totalExpenses)}
                </p>
              </div>

              {/* Properties */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Properties</h3>
                  <span className="text-2xl">🏠</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{stats.totalProperties}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Total Value: {formatCurrency(stats.totalPropertyValue)}
                </p>
              </div>

              {/* Loans */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Loans</h3>
                  <span className="text-2xl">💰</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{stats.totalLoans}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Total Balance: {formatCurrency(stats.totalLoanBalance)}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <a
                  href="/dashboard/properties"
                  className="flex items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <span className="text-2xl mr-3">🏠</span>
                  <div>
                    <h3 className="font-medium text-gray-800">Manage Properties</h3>
                    <p className="text-xs text-gray-600">Add or edit properties</p>
                  </div>
                </a>

                <a
                  href="/dashboard/loans"
                  className="flex items-center p-4 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <span className="text-2xl mr-3">💰</span>
                  <div>
                    <h3 className="font-medium text-gray-800">Manage Loans</h3>
                    <p className="text-xs text-gray-600">Track and manage loans</p>
                  </div>
                </a>

                <a
                  href="/dashboard/debt-planner"
                  className="flex items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <span className="text-2xl mr-3">📈</span>
                  <div>
                    <h3 className="font-medium text-gray-800">Debt Planner</h3>
                    <p className="text-xs text-gray-600">Optimize repayments</p>
                  </div>
                </a>

                <a
                  href="/dashboard/tax"
                  className="flex items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <span className="text-2xl mr-3">🧾</span>
                  <div>
                    <h3 className="font-medium text-gray-800">Tax Calculator</h3>
                    <p className="text-xs text-gray-600">View tax estimates</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Getting Started */}
            {stats.totalProperties === 0 && stats.totalLoans === 0 && (
              <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h2 className="text-xl font-bold text-blue-900 mb-4">🚀 Getting Started</h2>
                <p className="text-blue-800 mb-4">
                  Welcome to Monitrax! Start by adding your financial information:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-blue-800">
                  <li>Add your properties (home, investments)</li>
                  <li>Add your loans and link them to properties</li>
                  <li>Add your income sources</li>
                  <li>Add your expenses</li>
                  <li>Use the Debt Planner to optimize your repayments</li>
                </ol>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
