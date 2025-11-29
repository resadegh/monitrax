/**
 * LOAN STRATEGY PAGE
 * Phase 11 - AI Strategy Engine UI V2
 *
 * Strategy recommendations specific to a loan
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EntityStrategyTab from '@/components/strategy/EntityStrategyTab';
import AiAdvisorPanel from '@/components/strategy/AiAdvisorPanel';
import {
  ArrowLeft,
  Wallet,
  Bot,
  DollarSign,
  Percent,
  Calendar,
  RefreshCw,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface Loan {
  id: string;
  name: string;
  lender: string;
  loanType: string;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  remainingTermMonths: number;
  originalAmount: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function LoanStrategyPage() {
  const params = useParams();
  const loanId = params.id as string;

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    if (loanId) {
      fetchLoan();
    }
  }, [loanId]);

  async function fetchLoan() {
    try {
      setLoading(true);
      const response = await fetch(`/api/loans/${loanId}`);
      if (response.ok) {
        const data = await response.json();
        setLoan(data.data || data);
      }
    } catch (error) {
      console.error('Failed to fetch loan:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading loan...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!loan) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Wallet className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loan not found.</p>
          <Link href="/dashboard/loans" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            ← Back to Loans
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const paidOff = loan.originalAmount - loan.currentBalance;
  const paidOffPercent = ((paidOff / loan.originalAmount) * 100).toFixed(1);
  const remainingYears = (loan.remainingTermMonths / 12).toFixed(1);

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/dashboard/loans"
        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Loans
      </Link>

      {/* Loan Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Wallet className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loan.name || `${loan.lender} Loan`}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">{loan.lender}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {loan.loanType}
                  </span>
                </div>
              </div>
            </div>
            <Button
              variant={showAiPanel ? 'default' : 'outline'}
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={showAiPanel ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
            >
              <Bot className="h-4 w-4 mr-2" />
              Ask AI about this loan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <DollarSign className="h-4 w-4" />
              Current Balance
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(loan.currentBalance)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <Percent className="h-4 w-4" />
              Interest Rate
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {loan.interestRate.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <DollarSign className="h-4 w-4" />
              Monthly Payment
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(loan.monthlyPayment)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <Calendar className="h-4 w-4" />
              Remaining Term
            </div>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {remainingYears} years
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{paidOffPercent}% paid off</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy Recommendations */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Recommendations</CardTitle>
              <CardDescription>AI-powered recommendations for this loan</CardDescription>
            </CardHeader>
            <CardContent>
              <EntityStrategyTab
                entityType="loan"
                entityId={loanId}
                entityName={loan.name || `${loan.lender} Loan`}
              />
            </CardContent>
          </Card>
        </div>

        {/* AI Advisor Panel */}
        {showAiPanel && (
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  AI Advisor
                </CardTitle>
                <CardDescription>Ask questions about this loan</CardDescription>
              </CardHeader>
              <CardContent>
                <AiAdvisorPanel
                  mode="entity"
                  entityId={loanId}
                  entityType="loan"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
