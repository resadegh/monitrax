/**
 * STRATEGY PREFERENCES PAGE
 * Phase 11 - Stage 7: UI Components
 *
 * User preferences form for strategy engine customization
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// =============================================================================
// TYPES
// =============================================================================

interface UserPreferences {
  riskAppetite: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  debtComfort: 'LOW' | 'MODERATE' | 'HIGH';
  timeHorizon: number;
  retirementAge: number;
  investmentStyle: 'PASSIVE' | 'ACTIVE' | 'BALANCED';
  scenarioType: 'CONSERVATIVE' | 'DEFAULT' | 'AGGRESSIVE';
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function PreferencesPage() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<UserPreferences>({
    riskAppetite: 'MODERATE',
    debtComfort: 'MODERATE',
    timeHorizon: 30,
    retirementAge: 65,
    investmentStyle: 'BALANCED',
    scenarioType: 'DEFAULT',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    fetchPreferences();
  }, []);

  async function fetchPreferences() {
    try {
      setLoading(true);
      const response = await fetch('/api/strategy/preferences');

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          setPreferences(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    try {
      setSaving(true);

      const response = await fetch('/api/strategy/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' });

        // Redirect back to strategy dashboard after a short delay
        setTimeout(() => {
          router.push('/strategy');
        }, 1500);
      } else {
        const error = await response.json();
        setMessage({
          type: 'error',
          text: error.error || 'Failed to save preferences',
        });
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setSaving(false);
    }
  }

  function updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/strategy"
          className="text-blue-600 hover:text-blue-800 inline-flex items-center mb-4"
        >
          ← Back to Strategy Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Strategy Preferences</h1>
        <p className="text-gray-600 mt-2">
          Customize how the strategy engine analyzes your finances and generates
          recommendations.
        </p>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Form */}
      <form onSubmit={savePreferences} className="bg-white p-6 rounded-lg shadow space-y-6">
        {/* Risk Appetite */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Risk Appetite
          </label>
          <p className="text-sm text-gray-500 mb-3">
            How comfortable are you with financial risk?
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => updatePreference('riskAppetite', level)}
                className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                  preferences.riskAppetite === level
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Debt Comfort */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Debt Comfort Level
          </label>
          <p className="text-sm text-gray-500 mb-3">
            How comfortable are you carrying debt for investments or growth?
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(['LOW', 'MODERATE', 'HIGH'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => updatePreference('debtComfort', level)}
                className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                  preferences.debtComfort === level
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Investment Style */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Investment Style
          </label>
          <p className="text-sm text-gray-500 mb-3">
            How do you prefer to manage your investments?
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(['PASSIVE', 'BALANCED', 'ACTIVE'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => updatePreference('investmentStyle', style)}
                className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                  preferences.investmentStyle === style
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {style}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <p>
              <strong>Passive:</strong> Index funds, buy-and-hold strategy
            </p>
            <p>
              <strong>Balanced:</strong> Mix of passive and active approaches
            </p>
            <p>
              <strong>Active:</strong> Frequent trading, market timing
            </p>
          </div>
        </div>

        {/* Time Horizon */}
        <div>
          <label htmlFor="timeHorizon" className="block text-sm font-medium text-gray-700 mb-2">
            Time Horizon (years)
          </label>
          <p className="text-sm text-gray-500 mb-3">
            How many years until you need to access these funds?
          </p>
          <input
            id="timeHorizon"
            type="number"
            min="1"
            max="50"
            value={preferences.timeHorizon}
            onChange={(e) => updatePreference('timeHorizon', parseInt(e.target.value, 10))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="50"
              value={preferences.timeHorizon}
              onChange={(e) => updatePreference('timeHorizon', parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <span className="text-sm text-gray-600 w-16 text-right">
              {preferences.timeHorizon} years
            </span>
          </div>
        </div>

        {/* Retirement Age */}
        <div>
          <label htmlFor="retirementAge" className="block text-sm font-medium text-gray-700 mb-2">
            Target Retirement Age
          </label>
          <p className="text-sm text-gray-500 mb-3">
            At what age do you plan to retire?
          </p>
          <input
            id="retirementAge"
            type="number"
            min="50"
            max="80"
            value={preferences.retirementAge}
            onChange={(e) => updatePreference('retirementAge', parseInt(e.target.value, 10))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min="50"
              max="80"
              value={preferences.retirementAge}
              onChange={(e) => updatePreference('retirementAge', parseInt(e.target.value, 10))}
              className="flex-1"
            />
            <span className="text-sm text-gray-600 w-16 text-right">
              Age {preferences.retirementAge}
            </span>
          </div>
        </div>

        {/* Scenario Type */}
        <div className="border-t pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Forecast Scenario
          </label>
          <p className="text-sm text-gray-500 mb-3">
            Which scenario should be used by default for forecasting?
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(['CONSERVATIVE', 'DEFAULT', 'AGGRESSIVE'] as const).map((scenario) => (
              <button
                key={scenario}
                type="button"
                onClick={() => updatePreference('scenarioType', scenario)}
                className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                  preferences.scenarioType === scenario
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {scenario}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500">
            <p>
              <strong>Conservative:</strong> Lower returns, higher safety margins
            </p>
            <p>
              <strong>Default:</strong> Balanced assumptions based on historical data
            </p>
            <p>
              <strong>Aggressive:</strong> Higher growth expectations, optimistic projections
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t">
          <Link
            href="/strategy"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>

      {/* Information Panel */}
      <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">How Preferences Work</h3>
        <ul className="text-sm text-blue-800 space-y-2">
          <li>
            <strong>Risk Appetite:</strong> Affects the types of recommendations you receive.
            Conservative users get safer, lower-return strategies.
          </li>
          <li>
            <strong>Debt Comfort:</strong> Influences debt-related recommendations like leveraged
            investments or borrowing strategies.
          </li>
          <li>
            <strong>Time Horizon:</strong> Longer horizons allow for more aggressive growth
            strategies and compound interest benefits.
          </li>
          <li>
            <strong>Retirement Age:</strong> Used to calculate retirement readiness and forecast
            projections.
          </li>
          <li>
            <strong>Investment Style:</strong> Determines the complexity and frequency of
            investment recommendations.
          </li>
        </ul>
      </div>
    </div>
  );
}
