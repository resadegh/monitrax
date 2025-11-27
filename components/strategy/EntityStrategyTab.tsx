/**
 * ENTITY STRATEGY TAB COMPONENT
 * Phase 11 - Stage 7: UI Components
 *
 * Reusable component showing entity-specific strategy recommendations
 * Used in property, loan, and investment detail views
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface StrategyRecommendation {
  id: string;
  category: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  sbsScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED' | 'EXPIRED';
  financialImpact: {
    min: number;
    max: number;
    monthlySavings?: number;
    totalSavings?: number;
  };
  createdAt: string;
}

interface EntityStrategyTabProps {
  entityType: 'property' | 'loan' | 'investment';
  entityId: string;
  entityName: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function EntityStrategyTab({
  entityType,
  entityId,
  entityName,
}: EntityStrategyTabProps) {
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Map entity type to strategy category
  const getCategoryFilter = () => {
    switch (entityType) {
      case 'property':
        return 'PROPERTY';
      case 'loan':
        return 'DEBT';
      case 'investment':
        return 'INVESTMENT';
      default:
        return '';
    }
  };

  useEffect(() => {
    fetchEntityRecommendations();
  }, [entityId, entityType]);

  async function fetchEntityRecommendations() {
    try {
      setLoading(true);
      setError(null);

      // Fetch recommendations filtered by category
      const category = getCategoryFilter();
      const response = await fetch(`/api/strategy?category=${category}&status=PENDING`);

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const data = await response.json();
      const allRecs = data.data?.recommendations || [];

      // Filter to only those that affect this specific entity
      const entityRecs = allRecs.filter((rec: StrategyRecommendation & { affectedEntities?: Array<{ id: string }> }) => {
        // Check if this entity is in the affected entities
        if (rec.affectedEntities) {
          return rec.affectedEntities.some((entity: { id: string }) => entity.id === entityId);
        }
        // For now, show all recommendations of matching category
        return true;
      });

      setRecommendations(entityRecs.slice(0, 5)); // Show top 5
    } catch (err) {
      console.error('Failed to fetch entity recommendations:', err);
      setError('Unable to load strategy recommendations');
    } finally {
      setLoading(false);
    }
  }

  // Accept recommendation
  async function acceptRecommendation(id: string) {
    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });

      if (response.ok) {
        await fetchEntityRecommendations();
      }
    } catch (error) {
      console.error('Failed to accept recommendation:', error);
    }
  }

  // Dismiss recommendation
  async function dismissRecommendation(id: string) {
    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISMISSED', notes: 'Dismissed from entity view' }),
      });

      if (response.ok) {
        await fetchEntityRecommendations();
      }
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error);
    }
  }

  // Get severity color
  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  // Get SBS badge color
  function getSBSColor(score: number) {
    if (score >= 80) return 'bg-purple-100 text-purple-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 40) return 'bg-gray-100 text-gray-700';
    return 'bg-gray-50 text-gray-500';
  }

  // Format currency
  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Get entity type label
  function getEntityTypeLabel() {
    switch (entityType) {
      case 'property':
        return 'Property';
      case 'loan':
        return 'Loan';
      case 'investment':
        return 'Investment';
      default:
        return 'Entity';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
        <span className="text-sm text-gray-500">Loading strategy recommendations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-10 w-10 mx-auto text-yellow-500 mb-3" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchEntityRecommendations}
          className="mt-4 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12">
        <Lightbulb className="h-12 w-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium">No strategy recommendations</p>
        <p className="text-sm text-gray-500 mt-1">
          This {getEntityTypeLabel().toLowerCase()} has no pending strategy recommendations.
        </p>
        <Link
          href="/strategy"
          className="inline-block mt-4 px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
        >
          View All Strategies
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">
            Strategy Recommendations for {entityName}
          </h3>
        </div>
        <Link
          href="/strategy"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View All →
        </Link>
      </div>

      {/* Recommendations List */}
      <div className="space-y-3">
        {recommendations.map((rec) => (
          <div
            key={rec.id}
            className={`p-4 rounded-lg border ${getSeverityColor(rec.severity)}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSBSColor(rec.sbsScore)}`}>
                    SBS: {rec.sbsScore}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
                    {rec.confidence}
                  </span>
                </div>
                <h4 className="font-medium text-gray-900 mb-1">{rec.title}</h4>
                <p className="text-sm text-gray-600 line-clamp-2">{rec.summary}</p>

                {/* Financial Impact */}
                {rec.financialImpact && (rec.financialImpact.monthlySavings || rec.financialImpact.totalSavings) && (
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    {rec.financialImpact.monthlySavings && (
                      <span className="text-green-700">
                        Save {formatCurrency(rec.financialImpact.monthlySavings)}/month
                      </span>
                    )}
                    {rec.financialImpact.totalSavings && (
                      <span className="text-green-700">
                        Total: {formatCurrency(rec.financialImpact.totalSavings)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => acceptRecommendation(rec.id)}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                  title="Accept recommendation"
                >
                  <CheckCircle className="h-5 w-5" />
                </button>
                <button
                  onClick={() => dismissRecommendation(rec.id)}
                  className="p-1.5 text-gray-400 hover:bg-gray-50 rounded transition-colors"
                  title="Dismiss recommendation"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* View Details Link */}
            <div className="mt-3 pt-3 border-t border-current/10">
              <Link
                href={`/strategy/${rec.id}`}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                View Full Details →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="pt-4 border-t">
        <p className="text-xs text-gray-500 text-center">
          Showing top {recommendations.length} recommendations. {' '}
          <Link href="/strategy" className="text-blue-600 hover:text-blue-800">
            View all strategies
          </Link>
        </p>
      </div>
    </div>
  );
}
