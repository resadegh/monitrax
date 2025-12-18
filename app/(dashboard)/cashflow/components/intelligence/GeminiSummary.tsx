'use client';

/**
 * GEMINI SUMMARY COMPONENT
 * Phase 29 - Cashflow Intelligence Center
 *
 * Displays AI-generated natural language summary of cashflow status.
 * Includes regenerate button for on-demand updates.
 * Summary persists until explicitly regenerated or significant data change.
 */

import { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface Props {
  content: string;
  keyInsights: string[];
  generatedAt: Date;
  isStale: boolean;
  isLoading?: boolean;
  onRegenerate?: () => void;
}

// =============================================================================
// INSIGHT CHIP
// =============================================================================

function InsightChip({ insight }: { insight: string }) {
  // Determine if this is a positive, negative, or neutral insight
  const isPositive = /excellent|healthy|saving|strong|solid|good/i.test(insight);
  const isNegative = /needs|critical|attention|deficit|below|shortfall/i.test(insight);

  const colorClass = isPositive
    ? 'bg-green-50 text-green-700 border-green-200'
    : isNegative
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <div className={`px-3 py-1.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {insight}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function GeminiSummary({
  content,
  keyInsights,
  generatedAt,
  isStale,
  isLoading = false,
  onRegenerate,
}: Props) {
  const [showFullContent, setShowFullContent] = useState(false);

  // Truncate content if too long
  const shouldTruncate = content.length > 400;
  const displayContent = showFullContent || !shouldTruncate
    ? content
    : content.slice(0, 400) + '...';

  // Format the generated time
  const timeAgo = getTimeAgo(new Date(generatedAt));

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 rounded-xl border border-indigo-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-indigo-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Summary</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                <span>Generated {timeAgo}</span>
              </div>
            </div>
          </div>

          {/* Regenerate button */}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                isStale
                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Generating...' : 'Regenerate'}</span>
            </button>
          )}
        </div>

        {/* Stale warning */}
        {isStale && !isLoading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Data has changed since last analysis. Click regenerate for updated insights.</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6" />
          </div>
        ) : (
          <>
            {/* Main summary text */}
            <div className="prose prose-sm max-w-none text-gray-700">
              <p className="leading-relaxed">{displayContent}</p>
            </div>

            {/* Show more/less button */}
            {shouldTruncate && (
              <button
                onClick={() => setShowFullContent(!showFullContent)}
                className="mt-2 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {showFullContent ? (
                  <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>Read more <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Key Insights */}
      {!isLoading && keyInsights.length > 0 && (
        <div className="px-6 pb-5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Key Insights
          </h4>
          <div className="flex flex-wrap gap-2">
            {keyInsights.map((insight, index) => (
              <InsightChip key={index} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 bg-indigo-50/50 border-t border-indigo-100">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
          <Sparkles className="h-3 w-3 text-indigo-400" />
          <span>Powered by Gemini AI • Uses your real financial data</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}
