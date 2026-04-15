'use client';

/**
 * GoalStep — Phase 12 Track B (B.7)
 *
 * Step 5 (optional). "What matters most right now?" 3-option
 * segmented control. Skippable per directive §3.3.
 */

import { useCallback, useState } from 'react';
import { PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';
import { LinearStepShell } from '@/components/onboarding/linear/primitives/LinearStepShell';
import { LinearSegmented } from '@/components/onboarding/linear/primitives/LinearSegmented';
import { LinearFeedback } from '@/components/onboarding/linear/primitives/LinearFeedback';

type Goal = 'SAVE' | 'REDUCE_DEBT' | 'GROW_WEALTH';

export interface GoalStepProps {
  onAdvance: () => void;
  onBack: () => void;
}

export function GoalStep({ onAdvance, onBack }: GoalStepProps) {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdvance = useCallback(async () => {
    if (!goal) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/onboarding/estimates/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      });
      if (!response.ok) throw new Error('failed');
      setSaved(true);
      onAdvance();
    } catch {
      setError('Could not save. Please try again.');
      setIsSubmitting(false);
    }
  }, [goal, onAdvance]);

  const feedbackCopy: Record<Goal, string> = {
    SAVE: "Love it — we'll tailor your insights to help you save.",
    REDUCE_DEBT: "Got it — we'll surface debt-quality scoring and refinance tips.",
    GROW_WEALTH: "Nice — we'll keep an eye on your portfolio and tax position.",
  };

  return (
    <LinearStepShell
      question="What matters most right now?"
      supporting="We'll tailor your dashboard insights to match."
      canAdvance={goal !== null}
      isSubmitting={isSubmitting}
      onAdvance={handleAdvance}
      onBack={onBack}
      onSkip={onAdvance}
      skipLabel="Skip this step"
      feedback={
        saved && goal ? (
          <LinearFeedback>{feedbackCopy[goal]}</LinearFeedback>
        ) : error ? (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        ) : undefined
      }
    >
      <LinearSegmented<Goal>
        name="goal"
        value={goal}
        onChange={setGoal}
        options={[
          { value: 'SAVE', label: 'Save more', description: 'Build a buffer', icon: <PiggyBank className="h-4 w-4" /> },
          { value: 'REDUCE_DEBT', label: 'Reduce debt', description: 'Pay off faster', icon: <TrendingDown className="h-4 w-4" /> },
          { value: 'GROW_WEALTH', label: 'Grow wealth', description: 'Invest, compound', icon: <TrendingUp className="h-4 w-4" /> },
        ]}
      />
    </LinearStepShell>
  );
}

export default GoalStep;
