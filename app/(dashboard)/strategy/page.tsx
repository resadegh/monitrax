/**
 * STRATEGY DASHBOARD
 * Phase 11 - Stage 7: UI Components
 *
 * Main strategy recommendations dashboard
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ForecastChart from '@/components/strategy/ForecastChart';
import ConflictResolver from '@/components/strategy/ConflictResolver';
import { Settings, LineChart, AlertTriangle } from 'lucide-react';

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
}

interface Stats {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  topRecommendations: StrategyRecommendation[];
  averageSBSScore: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function StrategyDashboard() {
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'conflicts' | 'forecast'>('recommendations');
  const [filter, setFilter] = useState({
    status: '',
    category: '',
  });

  // Fetch recommendations and stats
  useEffect(() => {
    fetchData();
  }, [filter]);

  async function fetchData() {
    try {
      setLoading(true);

      // Build query params
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.category) params.append('category', filter.category);

      // Fetch recommendations and stats in parallel
      const [recsResponse, statsResponse] = await Promise.all([
        fetch(`/api/strategy?${params}`),
        fetch('/api/strategy/stats'),
      ]);

      if (recsResponse.ok) {
        const data = await recsResponse.json();
        setRecommendations(data.data?.recommendations || []);
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
  }

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
  async function acceptRecommendation(id: string) {
    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACCEPTED' }),
      });

      if (response.ok) {
        await fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to accept recommendation:', error);
    }
  }

  // Dismiss recommendation
  async function dismissRecommendation(id: string) {
    const reason = prompt('Why are you dismissing this recommendation?');
    if (!reason) return;

    try {
      const response = await fetch(`/api/strategy/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISMISSED', notes: reason }),
      });

      if (response.ok) {
        await fetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error);
    }
  }

  // Get badge color based on severity
  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  // Get SBS badge color
  function getSBSColor(score: number) {
    if (score >= 80) return 'bg-purple-100 text-purple-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    if (score >= 40) return 'bg-gray-100 text-gray-800';
    return 'bg-gray-50 text-gray-600';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Strategy Recommendations</h1>
          <p className="text-gray-600 mt-1">AI-powered financial strategies tailored for you</p>
        </div>
        <button
          onClick={generateStrategies}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Generating...' : 'Generate New Strategies'}
        </button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-gray-900">{stats.byStatus.PENDING || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Accepted</p>
            <p className="text-2xl font-bold text-green-600">{stats.byStatus.ACCEPTED || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Average SBS</p>
            <p className="text-2xl font-bold text-blue-600">{Math.round(stats.averageSBSScore || 0)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">
              {Object.values(stats.byStatus).reduce((a, b) => a + b, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'recommendations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="inline-block h-4 w-4 mr-2" />
              Recommendations
            </button>
            <button
              onClick={() => setActiveTab('conflicts')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'conflicts'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AlertTriangle className="inline-block h-4 w-4 mr-2" />
              Conflicts
            </button>
            <button
              onClick={() => setActiveTab('forecast')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'forecast'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <LineChart className="inline-block h-4 w-4 mr-2" />
              30-Year Forecast
            </button>
          </nav>
        </div>
      </div>

      {/* Tab Content: Conflicts */}
      {activeTab === 'conflicts' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <ConflictResolver onResolved={fetchData} />
        </div>
      )}

      {/* Tab Content: Forecast */}
      {activeTab === 'forecast' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <ForecastChart />
        </div>
      )}

      {/* Tab Content: Recommendations */}
      {activeTab === 'recommendations' && (
        <>
          {/* Filters */}
      <div className="flex gap-4 bg-white p-4 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={filter.category}
            onChange={(e) => setFilter({ ...filter, category: e.target.value })}
            className="border border-gray-300 rounded px-3 py-2"
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
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading recommendations...</p>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">No recommendations found.</p>
            <p className="text-sm text-gray-400 mt-2">Click "Generate New Strategies" to create recommendations.</p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <div key={rec.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(rec.severity)}`}>
                      {rec.severity.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getSBSColor(rec.sbsScore)}`}>
                      SBS: {rec.sbsScore}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                      {rec.category}
                    </span>
                    {rec.status !== 'PENDING' && (
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        rec.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {rec.status}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{rec.title}</h3>
                  <p className="text-gray-600 mb-4">{rec.summary}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <Link
                      href={`/strategy/${rec.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Details →
                    </Link>
                    {rec.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => acceptRecommendation(rec.id)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => dismissRecommendation(rec.id)}
                          className="text-gray-600 hover:text-gray-800 font-medium"
                        >
                          ✕ Dismiss
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}
    </div>
  );
}
