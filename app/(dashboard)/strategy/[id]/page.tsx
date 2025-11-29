/**
 * STRATEGY DETAIL VIEW
 * Phase 11 - Stage 7: UI Components (Enhanced V2)
 *
 * Detailed view of a single strategy recommendation with AI integration
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AiAdvisorPanel from '@/components/strategy/AiAdvisorPanel';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  AlertTriangle,
  Building2,
  Wallet,
  BarChart3,
  Bot,
  ExternalLink,
  RefreshCw,
  Shield,
  Lightbulb,
} from 'lucide-react';

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
  affectedEntities: AffectedEntity[];
  createdAt: string;
  expiresAt: string;
}

interface AffectedEntity {
  id: string;
  type: 'property' | 'loan' | 'investment' | 'account';
  name: string;
  value?: number;
  impact?: string;
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
// HELPER FUNCTIONS
// =============================================================================

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getConfidenceColor(confidence: string) {
  switch (confidence) {
    case 'HIGH': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'LOW': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getEntityIcon(type: string) {
  switch (type) {
    case 'property': return Building2;
    case 'loan': return Wallet;
    case 'investment': return BarChart3;
    default: return DollarSign;
  }
}

function getEntityLink(entity: AffectedEntity): string {
  switch (entity.type) {
    case 'property': return `/properties/${entity.id}`;
    case 'loan': return `/loans/${entity.id}`;
    case 'investment': return `/investments/${entity.id}`;
    default: return '#';
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

// =============================================================================
// COMPONENT
// =============================================================================

export default function StrategyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [recommendation, setRecommendation] = useState<StrategyRecommendation | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAiPanel, setShowAiPanel] = useState(searchParams.get('ai') === 'true');

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
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading recommendation...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!recommendation) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Recommendation not found.</p>
          <Link href="/strategy" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            ← Back to Strategies
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/strategy"
        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Strategy Dashboard
      </Link>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getSeverityColor(recommendation.severity)}`}>
                  {recommendation.severity.toUpperCase()}
                </span>
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                  SBS: {recommendation.sbsScore}
                </span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${getConfidenceColor(recommendation.confidence)}`}>
                  {recommendation.confidence} Confidence
                </span>
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {recommendation.category.replace('_', ' ')}
                </span>
                {recommendation.status !== 'PENDING' && (
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                    recommendation.status === 'ACCEPTED'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {recommendation.status}
                  </span>
                )}
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {recommendation.title}
              </h1>
              <p className="text-gray-700 dark:text-gray-300 text-lg">{recommendation.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {recommendation.status === 'PENDING' && (
                <>
                  <Button onClick={acceptRecommendation} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Accept
                  </Button>
                  <Button variant="outline" onClick={dismissRecommendation}>
                    <XCircle className="h-4 w-4 mr-2" />
                    Dismiss
                  </Button>
                </>
              )}
              <Button
                variant={showAiPanel ? 'default' : 'outline'}
                onClick={() => setShowAiPanel(!showAiPanel)}
                className={showAiPanel ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
              >
                <Bot className="h-4 w-4 mr-2" />
                AI Advisor
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Impact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Financial Impact
              </CardTitle>
              <CardDescription>Estimated financial outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {recommendation.financialImpact.monthlySavings !== undefined && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Savings</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {formatCurrency(recommendation.financialImpact.monthlySavings)}
                    </p>
                  </div>
                )}
                {recommendation.financialImpact.totalSavings !== undefined && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Savings</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(recommendation.financialImpact.totalSavings)}
                    </p>
                  </div>
                )}
                {recommendation.financialImpact.breakEven !== undefined && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Break-even</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {recommendation.financialImpact.breakEven} months
                    </p>
                  </div>
                )}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Impact Range</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatCurrency(recommendation.financialImpact.min)} - {formatCurrency(recommendation.financialImpact.max)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{recommendation.financialImpact.timeframe}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                Detailed Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{recommendation.detail}</p>
              </div>
            </CardContent>
          </Card>

          {/* Evidence & Reasoning */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                How We Calculated This
              </CardTitle>
              <CardDescription>Step-by-step reasoning trace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {recommendation.reasoning}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Risk Impact */}
          {recommendation.riskImpact && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-orange-600" />
                  Risk Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Current Risk Score</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {recommendation.riskImpact.current}/10
                      </p>
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    </div>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Projected Risk Score</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {recommendation.riskImpact.projected}/10
                      </p>
                      <TrendingDown className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                </div>
                {recommendation.riskImpact.factors && recommendation.riskImpact.factors.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risk Factors:</p>
                    <ul className="space-y-1">
                      {recommendation.riskImpact.factors.map((factor, i) => (
                        <li key={i} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Alternative Approaches</CardTitle>
                <CardDescription>Compare different strategies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {alternatives.map((alt) => (
                    <div
                      key={alt.id}
                      className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                          {alt.approach}
                        </span>
                        <Badge variant="secondary">SBS: {alt.sbsScore}</Badge>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{alt.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{alt.summary}</p>
                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="font-medium text-green-700 dark:text-green-400">Pros:</p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {alt.tradeoffs.pros.slice(0, 2).map((pro, i) => (
                              <li key={i} className="text-gray-600 dark:text-gray-400 text-xs">{pro}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-medium text-red-700 dark:text-red-400">Cons:</p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            {alt.tradeoffs.cons.slice(0, 2).map((con, i) => (
                              <li key={i} className="text-gray-600 dark:text-gray-400 text-xs">{con}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Linked Entities */}
          {recommendation.affectedEntities && recommendation.affectedEntities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Linked Entities
                </CardTitle>
                <CardDescription>Affected properties, loans, and investments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recommendation.affectedEntities.map((entity) => {
                  const EntityIcon = getEntityIcon(entity.type);
                  const link = getEntityLink(entity);
                  return (
                    <Link
                      key={entity.id}
                      href={link}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white dark:bg-gray-900">
                          <EntityIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{entity.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{entity.type}</p>
                          {entity.value && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{formatCurrency(entity.value)}</p>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* AI Advisor Panel */}
          {showAiPanel && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  AI Advisor
                </CardTitle>
                <CardDescription>Ask questions about this recommendation</CardDescription>
              </CardHeader>
              <CardContent>
                <AiAdvisorPanel
                  mode="recommendation"
                  recommendationId={id}
                />
              </CardContent>
            </Card>
          )}

          {/* Meta Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Created</span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(recommendation.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Expires</span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(recommendation.expiresAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Type</span>
                <span className="text-gray-900 dark:text-white">{recommendation.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">ID</span>
                <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{recommendation.id.slice(0, 8)}...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
