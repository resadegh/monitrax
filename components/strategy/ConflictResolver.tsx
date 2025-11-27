/**
 * CONFLICT RESOLUTION UI COMPONENT
 * Phase 11 - Stage 7: UI Components
 *
 * Side-by-side comparison of conflicting strategy recommendations
 * Allows users to choose between mutually exclusive options
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Scale,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface Recommendation {
  id: string;
  category: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  summary: string;
  sbsScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  financialImpact?: {
    min: number;
    max: number;
    monthlySavings?: number;
    totalSavings?: number;
  };
}

interface TradeoffAnalysis {
  option: Recommendation;
  pros: string[];
  cons: string[];
  financialImpact: number;
}

interface ConflictGroup {
  id: string;
  type: 'mutually_exclusive' | 'competing_priority' | 'same_entity';
  recommendations: Recommendation[];
  tradeoffAnalysis: TradeoffAnalysis[];
  suggestedResolution: string;
}

interface ConflictResolverProps {
  onResolved?: () => void;
  showTitle?: boolean;
  maxConflicts?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ConflictResolver({
  onResolved,
  showTitle = true,
  maxConflicts = 5,
}: ConflictResolverProps) {
  const [conflicts, setConflicts] = useState<ConflictGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetchConflicts();
  }, []);

  async function fetchConflicts() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/strategy/conflicts');

      if (!response.ok) {
        throw new Error('Failed to fetch conflicts');
      }

      const data = await response.json();
      setConflicts((data.data?.conflicts || []).slice(0, maxConflicts));
    } catch (err) {
      console.error('Failed to fetch conflicts:', err);
      setError('Unable to load conflicts');
    } finally {
      setLoading(false);
    }
  }

  // Accept a recommendation (and dismiss conflicting ones)
  async function resolveConflict(conflict: ConflictGroup, selectedId: string) {
    try {
      setResolving(selectedId);

      // Accept the selected recommendation
      await fetch(`/api/strategy/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });

      // Dismiss the other recommendations in this conflict
      for (const rec of conflict.recommendations) {
        if (rec.id !== selectedId) {
          await fetch(`/api/strategy/${rec.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'DISMISSED',
              notes: `Dismissed due to conflict resolution - chose ${conflict.recommendations.find(r => r.id === selectedId)?.title}`,
            }),
          });
        }
      }

      // Refresh conflicts
      await fetchConflicts();

      if (onResolved) {
        onResolved();
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(null);
    }
  }

  // Get conflict type label
  function getConflictTypeLabel(type: ConflictGroup['type']) {
    switch (type) {
      case 'mutually_exclusive':
        return 'Mutually Exclusive';
      case 'competing_priority':
        return 'Competing Priorities';
      case 'same_entity':
        return 'Same Entity';
      default:
        return 'Conflict';
    }
  }

  // Get conflict type color
  function getConflictTypeColor(type: ConflictGroup['type']) {
    switch (type) {
      case 'mutually_exclusive':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'competing_priority':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'same_entity':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
        <span className="text-sm text-gray-500">Loading conflicts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-10 w-10 mx-auto text-yellow-500 mb-3" />
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchConflicts}
          className="mt-4 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (conflicts.length === 0) {
    return (
      <div className="text-center py-12">
        <Scale className="h-12 w-12 mx-auto text-green-500 mb-3" />
        <p className="text-gray-600 font-medium">No Conflicts Detected</p>
        <p className="text-sm text-gray-500 mt-1">
          All your strategy recommendations are compatible.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {showTitle && (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Strategy Conflicts ({conflicts.length})
            </h2>
            <p className="text-sm text-gray-600">
              These recommendations need your decision
            </p>
          </div>
        </div>
      )}

      {/* Conflicts List */}
      <div className="space-y-4">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
          >
            {/* Conflict Header */}
            <button
              onClick={() =>
                setExpandedConflict(expandedConflict === conflict.id ? null : conflict.id)
              }
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded border ${getConflictTypeColor(
                    conflict.type
                  )}`}
                >
                  {getConflictTypeLabel(conflict.type)}
                </span>
                <span className="text-sm text-gray-700">
                  {conflict.recommendations.length} competing options
                </span>
              </div>
              {expandedConflict === conflict.id ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {/* Expanded Content */}
            {expandedConflict === conflict.id && (
              <div className="p-4 space-y-4">
                {/* Suggestion */}
                {conflict.suggestedResolution && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Scale className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">
                          Suggested Resolution
                        </p>
                        <p className="text-sm text-blue-700">{conflict.suggestedResolution}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {conflict.tradeoffAnalysis.map((tradeoff, index) => (
                    <div
                      key={tradeoff.option.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      {/* Option Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-gray-500">
                              Option {String.fromCharCode(65 + index)}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-xs font-medium rounded ${getSBSColor(
                                tradeoff.option.sbsScore
                              )}`}
                            >
                              SBS: {tradeoff.option.sbsScore}
                            </span>
                          </div>
                          <h4 className="font-semibold text-gray-900">{tradeoff.option.title}</h4>
                        </div>
                      </div>

                      {/* Summary */}
                      <p className="text-sm text-gray-600 mb-4">{tradeoff.option.summary}</p>

                      {/* Financial Impact */}
                      {tradeoff.financialImpact !== 0 && (
                        <div className="flex items-center gap-2 mb-4 text-sm">
                          {tradeoff.financialImpact > 0 ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-green-600" />
                              <span className="text-green-700">
                                Save {formatCurrency(tradeoff.financialImpact)}
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="h-4 w-4 text-red-600" />
                              <span className="text-red-700">
                                Cost {formatCurrency(Math.abs(tradeoff.financialImpact))}
                              </span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Pros */}
                      {tradeoff.pros.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-green-700 mb-1">Pros:</p>
                          <ul className="space-y-1">
                            {tradeoff.pros.map((pro, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                                {pro}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Cons */}
                      {tradeoff.cons.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-medium text-red-700 mb-1">Cons:</p>
                          <ul className="space-y-1">
                            {tradeoff.cons.map((con, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                <XCircle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                                {con}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Select Button */}
                      <button
                        onClick={() => resolveConflict(conflict, tradeoff.option.id)}
                        disabled={resolving !== null}
                        className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {resolving === tradeoff.option.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Resolving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Choose This Option
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>

                {/* View Details Links */}
                <div className="pt-3 border-t flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Need more info?{' '}
                    {conflict.recommendations.map((rec, i) => (
                      <span key={rec.id}>
                        <Link
                          href={`/strategy/${rec.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View Option {String.fromCharCode(65 + i)}
                        </Link>
                        {i < conflict.recommendations.length - 1 && ' | '}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center">
        <Link
          href="/strategy"
          className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
        >
          View All Strategy Recommendations
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
