'use client';

/**
 * TAX OPTIMIZATION WIDGET
 * Phase 29 - Cashflow Intelligence Center
 *
 * Displays tax summary and optimization opportunities.
 * Shows PAYG withheld, effective rate, and recommendations.
 */

import Link from 'next/link';
import {
  Receipt,
  TrendingDown,
  Lightbulb,
  ChevronRight,
  Info,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface TaxRecommendation {
  id: string;
  title: string;
  description: string;
  potentialSaving: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  actionUrl?: string;
}

interface Props {
  estimatedAnnualTax: number;
  deductibleExpenses: number;
  potentialSavings: number;
  recommendations: TaxRecommendation[];
  effectiveTaxRate: number;
  paygWithheld: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function priorityToColor(priority: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (priority) {
    case 'HIGH': return 'bg-green-100 text-green-700';
    case 'MEDIUM': return 'bg-blue-100 text-blue-700';
    case 'LOW': return 'bg-gray-100 text-gray-700';
  }
}

// =============================================================================
// RECOMMENDATION CARD
// =============================================================================

function RecommendationCard({ rec }: { rec: TaxRecommendation }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0 p-1.5 bg-yellow-100 rounded-lg">
        <Lightbulb className="h-4 w-4 text-yellow-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900">{rec.title}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityToColor(rec.priority)}`}>
            {rec.priority}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-2">{rec.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-green-600">
            Save up to {formatCurrency(rec.potentialSaving)}
          </span>
          {rec.actionUrl && (
            <Link
              href={rec.actionUrl}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              Learn more <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TaxOptimization({
  estimatedAnnualTax,
  deductibleExpenses,
  potentialSavings,
  recommendations,
  effectiveTaxRate,
  paygWithheld,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900">Tax Summary</h3>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Info className="h-3.5 w-3.5" />
            <span>Estimates only</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 px-6 py-4">
        {/* Estimated Tax */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Estimated Annual Tax</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(estimatedAnnualTax)}
          </p>
        </div>

        {/* Effective Rate */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Effective Rate</p>
          <p className="text-xl font-bold text-gray-900">
            {effectiveTaxRate.toFixed(1)}%
          </p>
        </div>

        {/* PAYG Withheld */}
        <div>
          <p className="text-xs text-gray-500 mb-1">PAYG Withheld (YTD)</p>
          <p className="text-lg font-semibold text-gray-700">
            {formatCurrency(paygWithheld)}
          </p>
        </div>

        {/* Deductions */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Deductible Expenses</p>
          <p className="text-lg font-semibold text-gray-700">
            {formatCurrency(deductibleExpenses)}
          </p>
        </div>
      </div>

      {/* Potential Savings */}
      {potentialSavings > 0 && (
        <div className="mx-6 mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">
              Potential savings: {formatCurrency(potentialSavings)}
            </span>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="px-6 pb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Opportunities</h4>
          <div className="space-y-3">
            {recommendations.slice(0, 2).map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Based on current income and deductions. Consult a tax professional for advice.
        </p>
      </div>
    </div>
  );
}
