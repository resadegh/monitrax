/**
 * INVESTMENT STRATEGY PAGE
 * Phase 11 - AI Strategy Engine UI V2
 *
 * Strategy recommendations specific to an investment holding
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
  BarChart3,
  Bot,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Percent,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface Investment {
  id: string;
  name: string;
  symbol: string;
  type: string;
  currentValue: number;
  purchasePrice: number;
  quantity: number;
  performance: number;
  allocation: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function InvestmentStrategyPage() {
  const params = useParams();
  const investmentId = params.id as string;

  const [investment, setInvestment] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(false);

  useEffect(() => {
    if (investmentId) {
      fetchInvestment();
    }
  }, [investmentId]);

  async function fetchInvestment() {
    try {
      setLoading(true);
      const response = await fetch(`/api/investments/holdings/${investmentId}`);
      if (response.ok) {
        const data = await response.json();
        setInvestment(data.data || data);
      }
    } catch (error) {
      console.error('Failed to fetch investment:', error);
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
            <p className="text-gray-500 dark:text-gray-400">Loading investment...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!investment) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Investment not found.</p>
          <Link href="/dashboard/investments/holdings" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            ← Back to Holdings
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const gain = investment.currentValue - investment.purchasePrice;
  const gainPercent = ((gain / investment.purchasePrice) * 100).toFixed(2);
  const isPositive = gain >= 0;

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/dashboard/investments/holdings"
        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Holdings
      </Link>

      {/* Investment Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <BarChart3 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {investment.name}
                </h1>
                {investment.symbol && (
                  <p className="text-gray-500 dark:text-gray-400 font-mono">{investment.symbol}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                    {investment.type}
                  </span>
                  {investment.allocation && (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                      {investment.allocation}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant={showAiPanel ? 'default' : 'outline'}
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={showAiPanel ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
            >
              <Bot className="h-4 w-4 mr-2" />
              Ask AI about this investment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <DollarSign className="h-4 w-4" />
              Current Value
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(investment.currentValue)}
            </p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${isPositive ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              Total Return
            </div>
            <p className={`text-2xl font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(gain)}
            </p>
            <p className={`text-xs ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? '+' : ''}{gainPercent}%
            </p>
          </CardContent>
        </Card>
        {investment.performance !== undefined && (
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Percent className="h-4 w-4" />
                Performance
              </div>
              <p className={`text-2xl font-bold ${investment.performance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {investment.performance >= 0 ? '+' : ''}{investment.performance.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        )}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
              <DollarSign className="h-4 w-4" />
              Cost Basis
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(investment.purchasePrice)}
            </p>
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
              <CardDescription>AI-powered recommendations for this investment</CardDescription>
            </CardHeader>
            <CardContent>
              <EntityStrategyTab
                entityType="investment"
                entityId={investmentId}
                entityName={investment.name}
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
                <CardDescription>Ask questions about this investment</CardDescription>
              </CardHeader>
              <CardContent>
                <AiAdvisorPanel
                  mode="entity"
                  entityId={investmentId}
                  entityType="investment"
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
