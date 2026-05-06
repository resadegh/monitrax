/**
 * Phase 41h.3 — Ask-the-advisor question form.
 *
 * Simple controlled-input form. Submits the question to a caller-
 * supplied `onSubmit` callback and returns the gateway response
 * for the parent to render. Disabled while loading.
 *
 * **Tone**: warm, direct (CLAUDE.md §0.4 + §14 — "your" not "the
 * user's"; no manufactured urgency; simple call-to-action).
 */

import React, { useState } from 'react';

interface TaxAdvisorAskFormProps {
  /** Called when the user submits a question. */
  onSubmit: (question: string) => Promise<void>;
  /** While true, the form is disabled. */
  loading: boolean;
  /** Pre-canned example questions (helpful for first-use). */
  examples?: string[];
  /** Optional placeholder. */
  placeholder?: string;
}

export function TaxAdvisorAskForm({
  onSubmit,
  loading,
  examples = [],
  placeholder = 'Ask about your tax position…',
}: TaxAdvisorAskFormProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;
    await onSubmit(trimmed);
  };

  const handleExampleClick = async (ex: string) => {
    if (loading) return;
    setQuestion(ex);
    await onSubmit(ex);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          rows={3}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Numbers come from your data. Citations come from Australian law. The
            AI never invents either.
          </p>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </form>

      {examples.length > 0 && (
        <div className="pt-2">
          <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-2">
            Try one of these
          </p>
          <div className="flex flex-wrap gap-2">
            {examples.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => void handleExampleClick(ex)}
                disabled={loading}
                className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
