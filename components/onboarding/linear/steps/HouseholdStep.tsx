'use client';

/**
 * HouseholdStep — Phase 12 Track B (B.3)
 *
 * Step 1 of the /onboarding wizard. "Who shares finances with you?"
 * Single-question radiogroup with 3 options. Writes on advance.
 */

import { useCallback, useState } from 'react';
import { User, Users, Home } from 'lucide-react';
import { LinearStepShell } from '@/components/onboarding/linear/primitives/LinearStepShell';
import { LinearSegmented } from '@/components/onboarding/linear/primitives/LinearSegmented';
import { LinearFeedback } from '@/components/onboarding/linear/primitives/LinearFeedback';

type Option = 'SELF' | 'PARTNER' | 'FAMILY';

export interface HouseholdStepProps {
  onAdvance: () => void;
  onBack: () => void;
}

export function HouseholdStep({ onAdvance, onBack }: HouseholdStepProps) {
  const [option, setOption] = useState<Option | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdvance = useCallback(async () => {
    if (!option) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/onboarding/estimates/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option }),
      });
      if (!response.ok) throw new Error('failed');
      setSaved(true);
      onAdvance();
    } catch {
      setError('Could not save. Please try again.');
      setIsSubmitting(false);
    }
  }, [option, onAdvance]);

  return (
    <LinearStepShell
      question="Who shares finances with you?"
      supporting="We'll tailor the rest of the setup to your situation."
      canAdvance={option !== null}
      isSubmitting={isSubmitting}
      onAdvance={handleAdvance}
      onBack={onBack}
      feedback={
        saved && option ? (
          <LinearFeedback>
            {option === 'SELF'
              ? 'Got it — just you.'
              : option === 'PARTNER'
              ? 'Got it — you and a partner.'
              : 'Got it — a full household.'}
          </LinearFeedback>
        ) : error ? (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        ) : undefined
      }
    >
      <LinearSegmented<Option>
        name="household"
        value={option}
        onChange={setOption}
        options={[
          { value: 'SELF', label: 'Just me', description: 'Solo finances', icon: <User className="h-4 w-4" /> },
          { value: 'PARTNER', label: 'Partner', description: 'You + one', icon: <Users className="h-4 w-4" /> },
          { value: 'FAMILY', label: 'Family', description: 'Kids, pets, the works', icon: <Home className="h-4 w-4" /> },
        ]}
      />
    </LinearStepShell>
  );
}

export default HouseholdStep;
