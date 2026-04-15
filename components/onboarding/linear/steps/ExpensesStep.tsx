'use client';

/**
 * ExpensesStep — Phase 12 Track B (B.6)
 *
 * Step 4 (optional). "Roughly how much do you spend each month?"
 * Single currency input. Skippable per directive §3.3.
 */

import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { LinearStepShell } from '@/components/onboarding/linear/primitives/LinearStepShell';
import { LinearInput } from '@/components/onboarding/linear/primitives/LinearInput';
import { LinearFeedback } from '@/components/onboarding/linear/primitives/LinearFeedback';
import { useCountUp } from '@/components/onboarding/linear/hooks/useCountUp';

export interface ExpensesStepProps {
  onAdvance: () => void;
  onBack: () => void;
}

function formatAUD(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function ExpensesStep({ onAdvance, onBack }: ExpensesStepProps) {
  const { token } = useAuth();
  const [rawValue, setRawValue] = useState<string>('');
  const [committed, setCommitted] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthly = parseFloat(rawValue);
  const annual = committed !== null ? committed * 12 : 0;
  const animated = useCountUp(annual, { durationMs: 700, startOnMount: committed !== null });

  const handleAdvance = useCallback(async () => {
    if (!Number.isFinite(monthly) || monthly < 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/onboarding/estimates/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ monthlyAmount: monthly }),
      });
      if (!response.ok) throw new Error('failed');
      setCommitted(monthly);
      setTimeout(() => onAdvance(), 1100);
    } catch {
      setError('Could not save. Please try again.');
      setIsSubmitting(false);
    }
  }, [monthly, token, onAdvance]);

  const handleSkip = useCallback(() => onAdvance(), [onAdvance]);

  return (
    <LinearStepShell
      question="Roughly how much do you spend each month?"
      supporting="Skip if you're not sure — we can track this from your bank later."
      canAdvance={Number.isFinite(monthly) && monthly >= 0}
      isSubmitting={isSubmitting}
      onAdvance={handleAdvance}
      onBack={onBack}
      onSkip={handleSkip}
      skipLabel="Skip this step"
      feedback={
        committed !== null ? (
          <LinearFeedback>That's about {formatAUD(animated)} per year</LinearFeedback>
        ) : error ? (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        ) : undefined
      }
    >
      <LinearInput
        variant="currency"
        placeholder="0"
        value={rawValue}
        onChange={(e) => setRawValue(e.target.value)}
        autoFocus
      />
    </LinearStepShell>
  );
}

export default ExpensesStep;
