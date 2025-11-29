/**
 * STRATEGY DASHBOARD
 * Phase 11 - Stage 7: UI Components (Enhanced V2)
 *
 * Main strategy recommendations dashboard with AI integration
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import ForecastChart from '@/components/strategy/ForecastChart';
import ConflictResolver from '@/components/strategy/ConflictResolver';
import {
  Settings,
  LineChart,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Bot,
  Target,
  Wallet,
} from 'lucide-react';

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
  financialImpact: any;
  createdAt: string;
  updatedAt?: string;
}

interface Stats {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  topRecommendations: StrategyRecommendation[];
  averageSBSScore: number;
}

interface DataQuality {
  overallScore: number;
  limitedMode: boolean;
  missingCritical: string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDataQualityBadge(score: number) {
  if (score >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' };
  if (score >= 60) return { label: 'Good', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
  if (score >= 40) return { label: 'Fair', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' };
  return { label: 'Limited', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' };
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getSBSColor(score: number) {
  if (score >= 80) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
  if (score >= 60) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  if (score >= 40) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  return 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400';
}

function getConfidenceColor(confidence: string) {
  switch (confidence) {
    case 'HIGH': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'LOW': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'DEBT': return Wallet;
    case 'INVESTMENT': return TrendingUp;
    case 'CASHFLOW': return RefreshCw;
    case 'PROPERTY': return Target;
    case 'RISK_RESILIENCE': return ShieldCheck;
    default: return Sparkles;
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function StrategyDashboard() {
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'conflicts' | 'forecast'>('recommendations');
  const [filter, setFilter] = useState({
    status: '',
    category: '',
    confidence: '',
  });
  const [sortBy, setSortBy] = useState<'sbs' | 'date'>('sbs');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  // Fetch recommendations and stats
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.category) params.append('category', filter.category);
      if (filter.confidence) params.append('confidence', filter.confidence);
      params.append('limit', String(pageSize));
      params.append('offset', String((page - 1) * pageSize));

      // Fetch recommendations and stats in parallel
      const [recsResponse, statsResponse] = await Promise.all([
        fetch(`/api/strategy?${params}`),
        fetch('/api/strategy/stats'),
      ]);

      if (recsResponse.ok) {
        const data = await recsResponse.json();
        let recs = data.data?.recommendations || [];

        // Sort client-side
        if (sortBy === 'sbs') {
          recs = recs.sort((a: StrategyRecommendation, b: StrategyRecommendation) => b.sbsScore - a.sbsScore);
        } else {
          recs = recs.sort((a: StrategyRecommendation, b: StrategyRecommendation) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }

        setRecommendations(recs);
        setTotalCount(data.data?.total || recs.length);

        // Set last updated from most recent recommendation
        if (recs.length > 0) {
          setLastUpdated(recs[0].createdAt);
        }
      }

      if (statsResponse.ok) {
        const data = await statsResponse.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch strategy data:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, page, sortBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate new strategies
  async function generateStrategies() {
    try {
      setGenerating(true);
      const response = await fetch('/api/strategy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data?.dataQuality) {
          setDataQuality(data.data.dataQuality);
        }
        await fetchData(); // Refresh data
      } else {
        const error = await response.json();
        alert(`Failed to generate strategies: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to generate strategies:', error);
      alert('Failed to generate strategies. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  // Accept recommendation
  async function acceptRecommendation(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to accept recommendation:', error);
    }
  }

  // Dismiss recommendation
  async function dismissRecommendation(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const reason = prompt('Why are you dismissing this recommendation?');
    if (!reason) return;

    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISMISSED', notes: reason }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error);
    }
  }

  const topOpportunities = stats?.topRecommendations?.slice(0, 5) || recommendations.slice(0, 5);
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header with Data Quality Badge */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Strategy Recommendations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">AI-powered financial strategies tailored for you</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {/* Data Quality Badge */}
          {dataQuality && (
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getDataQualityBadge(dataQuality.overallScore).color}`}>
                Data Quality: {getDataQualityBadge(dataQuality.overallScore).label} ({dataQuality.overallScore}%)
              </span>
            </div>
          )}

          {/* Last Updated */}
          {lastUpdated && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Clock className="h-4 w-4" />
              <span>Updated {formatDate(lastUpdated)}</span>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={generateStrategies}
            disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Strategy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Limited Mode Warning */}
      {dataQuality?.limitedMode && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Limited Data Mode</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Some recommendations may be less accurate due to incomplete data.
                {dataQuality.missingCritical.length > 0 && (
                  <span> Missing: {dataQuality.missingCritical.join(', ')}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Pending Actions"
            value={stats.byStatus.PENDING || 0}
            icon={Clock}
            variant="orange"
            description="Awaiting your decision"
          />
          <StatCard
            title="Accepted"
            value={stats.byStatus.ACCEPTED || 0}
            icon={CheckCircle2}
            variant="green"
            description="Implemented"
          />
          <StatCard
            title="Average SBS"
            value={Math.round(stats.averageSBSScore || 0)}
            icon={TrendingUp}
            variant="purple"
            description="Strategy Benefit Score"
          />
          <StatCard
            title="Total"
            value={Object.values(stats.byStatus).reduce((a, b) => a + b, 0)}
            icon={Target}
            variant="blue"
            description="All recommendations"
          />
        </div>
      )}

      {/* Main Content Grid: Top Opportunities + Risk/Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Opportunities */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Top Opportunities
            </CardTitle>
            <CardDescription>Highest impact recommendations by SBS score</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topOpportunities.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No recommendations yet. Click &quot;Refresh Strategy&quot; to generate.</p>
            ) : (
              topOpportunities.map((rec, index) => (
                <Link
                  key={rec.id}
                  href={`/strategy/${rec.id}`}
                  className="block p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSBSColor(rec.sbsScore)}`}>
                            SBS: {rec.sbsScore}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getConfidenceColor(rec.confidence)}`}>
                            {rec.confidence}
                          </span>
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">{rec.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{rec.summary}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rec.status === 'PENDING' && (
                        <>
                          <button
                            onClick={(e) => acceptRecommendation(rec.id, e)}
                            className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                            title="Accept"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => dismissRecommendation(rec.id, e)}
                            className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                            title="Dismiss"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <Link
                        href={`/strategy/${rec.id}?ai=true`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                        title="Ask AI"
                      >
                        <Bot className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Risk & Forecast Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Risk & Forecast
            </CardTitle>
            <CardDescription>Portfolio health overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Risk Score */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Risk Score</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats ? Math.round(100 - (stats.averageSBSScore || 50)) : '--'}/100
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                  style={{ width: `${stats ? 100 - (stats.averageSBSScore || 50) : 50}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {stats && stats.averageSBSScore >= 70 ? 'Low risk - Portfolio is well optimized' :
                 stats && stats.averageSBSScore >= 50 ? 'Moderate risk - Some improvements available' :
                 'Higher risk - Consider acting on recommendations'}
              </p>
            </div>

            {/* Category Breakdown */}
            {stats && stats.byCategory && Object.keys(stats.byCategory).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">By Category</h4>
                <div className="space-y-2">
                  {Object.entries(stats.byCategory).slice(0, 4).map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{cat.replace('_', ' ')}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View Forecast Link */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setActiveTab('forecast')}
            >
              <LineChart className="h-4 w-4 mr-2" />
              View Full Forecast
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <Card>
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'recommendations'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <Settings className="inline-block h-4 w-4 mr-2" />
              All Recommendations
            </button>
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'conflicts'
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <AlertTriangle className="inline-block h-4 w-4 mr-2" />
              Conflicts
            </button>
            <button
              onClick={() => setActiveTab('forecast')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'forecast'
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              <LineChart className="inline-block h-4 w-4 mr-2" />
              30-Year Forecast
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <CardContent className="pt-6">
          {/* Conflicts Tab */}
          {activeTab === 'conflicts' && (
            <ConflictResolver onResolved={fetchData} />
          )}

          {/* Forecast Tab */}
          {activeTab === 'forecast' && (
            <ForecastChart />
          )}

          {/* Recommendations Tab */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select
                    value={filter.status}
                    onChange={(e) => { setFilter({ ...filter, status: e.target.value }); setPage(1); }}
                    className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">All</option>
                    <option value="PENDING">Pending</option>
                    <option value="ACCEPTED">Accepted</option>
                    <option value="DISMISSED">Dismissed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <select
                    value={filter.category}
                    onChange={(e) => { setFilter({ ...filter, category: e.target.value }); setPage(1); }}
                    className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">All</option>
                    <option value="DEBT">Debt</option>
                    <option value="GROWTH">Growth</option>
                    <option value="CASHFLOW">Cashflow</option>
                    <option value="INVESTMENT">Investment</option>
                    <option value="PROPERTY">Property</option>
                    <option value="RISK_RESILIENCE">Risk & Resilience</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confidence</label>
                  <select
                    value={filter.confidence}
                    onChange={(e) => { setFilter({ ...filter, confidence: e.target.value }); setPage(1); }}
                    className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">All</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'sbs' | 'date')}
                    className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="sbs">SBS Score</option>
                    <option value="date">Date Created</option>
                  </select>
                </div>
              </div>

              {/* Recommendations List */}
              {loading ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">Loading recommendations...</p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No recommendations found.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                    Click &quot;Refresh Strategy&quot; to generate recommendations.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec) => {
                    const CategoryIcon = getCategoryIcon(rec.category);
                    return (
                      <div
                        key={rec.id}
                        className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                              <CategoryIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSeverityColor(rec.severity)}`}>
                                  {rec.severity.toUpperCase()}
                                </span>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getSBSColor(rec.sbsScore)}`}>
                                  SBS: {rec.sbsScore}
                                </span>
                                <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                  {rec.category.replace('_', ' ')}
                                </span>
                                {rec.status !== 'PENDING' && (
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                    rec.status === 'ACCEPTED'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {rec.status}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{rec.title}</h3>
                              <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">{rec.summary}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Link
                              href={`/strategy/${rec.id}`}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                            >
                              View
                            </Link>
                            {rec.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={(e) => acceptRecommendation(rec.id, e)}
                                  className="px-3 py-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={(e) => dismissRecommendation(rec.id, e)}
                                  className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                                >
                                  Dismiss
                                </button>
                              </>
                            )}
                            <Link
                              href={`/strategy/${rec.id}?ai=true`}
                              className="p-2 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                              title="Ask AI about this recommendation"
                            >
                              <Bot className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
