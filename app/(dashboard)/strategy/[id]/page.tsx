/**
 * STRATEGY DETAIL VIEW
 * Phase 11 - Stage 7: UI Components
 *
 * Detailed view of a single strategy recommendation
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// =============================================================================
// TYPES
// =============================================================================

interface StrategyRecommendation {
  id: string;
  category: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  detail: string;
  sbsScore: number;
  confidence: string;
  status: string;
  financialImpact: {
    min: number;
    max: number;
    currency: string;
    timeframe: string;
    monthlySavings?: number;
    totalSavings?: number;
    breakEven?: number;
  };
  riskImpact: {
    current: number;
    projected: number;
    factors: string[];
  };
  reasoning: string;
  evidenceGraph: any;
  alternativeIds: string[];
  affectedEntities: any[];
  createdAt: string;
  expiresAt: string;
}

interface Alternative {
  id: string;
  approach: string;
  title: string;
  summary: string;
  sbsScore: number;
  tradeoffs: {
    pros: string[];
    cons: string[];
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [recommendation, setRecommendation] = useState<StrategyRecommendation | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchRecommendation();
    }
  }, [id]);

  async function fetchRecommendation() {
    try {
      setLoading(true);

      // Fetch recommendation and alternatives in parallel
      const [recResponse, altResponse] = await Promise.all([
        fetch(`/api/strategy/${id}`),
        fetch(`/api/strategy/${id}/alternatives`),
      ]);

      if (recResponse.ok) {
        const data = await recResponse.json();
        setRecommendation(data.data);
      }

      if (altResponse.ok) {
        const data = await altResponse.json();
        setAlternatives(data.data?.alternatives || []);
      }
    } catch (error) {
      console.error('Failed to fetch recommendation:', error);
    } finally {
      setLoading(false);
    }
  }

  async function acceptRecommendation() {
    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });

      if (response.ok) {
        router.push('/strategy');
      }
    } catch (error) {
      console.error('Failed to accept recommendation:', error);
    }
  }

  async function dismissRecommendation() {
    const reason = prompt('Why are you dismissing this recommendation?');
    if (!reason) return;

    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISMISSED', notes: reason }),
      });

      if (response.ok) {
        router.push('/strategy');
      }
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading recommendation...</p>
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Recommendation not found.</p>
        <Link href="/strategy" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          ← Back to Strategies
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Button */}
      <Link href="/strategy" className="text-blue-600 hover:text-blue-800 inline-flex items-center">
        ← Back to Strategies
      </Link>

      {/* Header Card */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-3 py-1 text-sm font-medium rounded ${
                recommendation.severity === 'critical' ? 'bg-red-100 text-red-800' :
                recommendation.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                recommendation.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {recommendation.severity.toUpperCase()}
              </span>
              <span className="px-3 py-1 text-sm font-medium rounded bg-purple-100 text-purple-800">
                SBS: {recommendation.sbsScore}
              </span>
              <span className={`px-3 py-1 text-sm font-medium rounded ${
                recommendation.confidence === 'HIGH' ? 'bg-green-100 text-green-800' :
                recommendation.confidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-600'
              }`}>
                {recommendation.confidence} Confidence
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{recommendation.title}</h1>
          </div>
          {recommendation.status === 'PENDING' && (
            <div className="flex gap-2">
              <button
                onClick={acceptRecommendation}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                ✓ Accept
              </button>
              <button
                onClick={dismissRecommendation}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ✕ Dismiss
              </button>
            </div>
          )}
        </div>
        <p className="text-gray-700 text-lg">{recommendation.summary}</p>
      </div>

      {/* Financial Impact */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Financial Impact</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {recommendation.financialImpact.monthlySavings && (
            <div>
              <p className="text-sm text-gray-600">Monthly Savings</p>
              <p className="text-2xl font-bold text-green-600">
                ${recommendation.financialImpact.monthlySavings.toLocaleString()}
              </p>
            </div>
          )}
          {recommendation.financialImpact.totalSavings && (
            <div>
              <p className="text-sm text-gray-600">Total Savings</p>
              <p className="text-2xl font-bold text-blue-600">
                ${recommendation.financialImpact.totalSavings.toLocaleString()}
              </p>
            </div>
          )}
          {recommendation.financialImpact.breakEven && (
            <div>
              <p className="text-sm text-gray-600">Break-even</p>
              <p className="text-2xl font-bold text-gray-900">
                {recommendation.financialImpact.breakEven} months
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Impact Range</p>
            <p className="text-lg font-bold text-gray-900">
              ${recommendation.financialImpact.min.toLocaleString()} - ${recommendation.financialImpact.max.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Explanation */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Detailed Analysis</h2>
        <div className="prose max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap">{recommendation.detail}</p>
        </div>
      </div>

      {/* Reasoning Trace */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">How We Calculated This</h2>
        <div className="bg-gray-50 p-4 rounded-lg">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
            {recommendation.reasoning}
          </pre>
        </div>
      </div>

      {/* Risk Impact */}
      {recommendation.riskImpact && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Risk Analysis</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Current Risk Score</p>
              <p className="text-2xl font-bold text-red-600">{recommendation.riskImpact.current}/10</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Projected Risk Score</p>
              <p className="text-2xl font-bold text-green-600">{recommendation.riskImpact.projected}/10</p>
            </div>
          </div>
          {recommendation.riskImpact.factors && recommendation.riskImpact.factors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Risk Factors:</p>
              <ul className="list-disc list-inside space-y-1">
                {recommendation.riskImpact.factors.map((factor, i) => (
                  <li key={i} className="text-gray-600">{factor}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Alternative Approaches</h2>
          <div className="space-y-4">
            {alternatives.map((alt) => (
              <div key={alt.id} className="border border-gray-200 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{alt.title}</h3>
                  <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                    SBS: {alt.sbsScore}
                  </span>
                </div>
                <p className="text-gray-600 mb-3">{alt.summary}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-green-700 mb-1">Pros:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {alt.tradeoffs.pros.map((pro, i) => (
                        <li key={i} className="text-gray-600">{pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-red-700 mb-1">Cons:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {alt.tradeoffs.cons.map((con, i) => (
                        <li key={i} className="text-gray-600">{con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Affected Entities */}
      {recommendation.affectedEntities && recommendation.affectedEntities.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Affected Entities</h2>
          <div className="space-y-2">
            {recommendation.affectedEntities.map((entity: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="text-gray-700">{entity.name || entity.id}</span>
                <span className="text-xs text-gray-500 uppercase">{entity.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
