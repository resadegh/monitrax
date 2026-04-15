'use client';

/**
 * IncomeStep — Phase 12 Track B (B.4)
 *
 * Step 2. "What comes in each month?" Single currency input.
 * On submit, shows a count-up feedback line ("That's about $X per year").
 */

import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { LinearStepShell } from '@/components/onboarding/linear/primitives/LinearStepShell';
import { LinearInput } from '@/components/onboarding/linear/primitives/LinearInput';
import { LinearFeedback } from '@/components/onboarding/linear/primitives/LinearFeedback';
import { useCountUp } from '@/components/onboarding/linear/hooks/useCountUp';

export interface IncomeStepProps {
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

export function IncomeStep({ onAdvance, onBack }: IncomeStepProps) {
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
      const response = await fetch('/api/onboarding/estimates/income', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ monthlyAmount: monthly }),
      });
      if (!response.ok) throw new Error('failed');
      setCommitted(monthly);
      // Small delay so users see the feedback before advancing.
      setTimeout(() => onAdvance(), 1100);
    } catch {
      setError('Could not save. Please try again.');
      setIsSubmitting(false);
    }
  }, [monthly, token, onAdvance]);

  return (
    <LinearStepShell
      question="What comes in each month?"
      supporting="Roughly — salaries, rent, side income. You can refine later."
      canAdvance={Number.isFinite(monthly) && monthly >= 0}
      isSubmitting={isSubmitting}
      onAdvance={handleAdvance}
      onBack={onBack}
      feedback={
        committed !== null ? (
          <LinearFeedback>
            That's about {formatAUD(animated)} per year
          </LinearFeedback>
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

export default IncomeStep;
