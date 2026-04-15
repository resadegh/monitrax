'use client';

/**
 * HousingStep — Phase 12 Track B (B.5)
 *
 * Step 3. "Where do you live?" 3-option segmented control.
 */

import { useCallback, useState } from 'react';
import { Home, Key, Users } from 'lucide-react';
import { LinearStepShell } from '@/components/onboarding/linear/primitives/LinearStepShell';
import { LinearSegmented } from '@/components/onboarding/linear/primitives/LinearSegmented';
import { LinearFeedback } from '@/components/onboarding/linear/primitives/LinearFeedback';

type Situation = 'OWN' | 'RENT' | 'FAMILY';

export interface HousingStepProps {
  onAdvance: () => void;
  onBack: () => void;
}

export function HousingStep({ onAdvance, onBack }: HousingStepProps) {
  const [situation, setSituation] = useState<Situation | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdvance = useCallback(async () => {
    if (!situation) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/onboarding/estimates/housing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ situation }),
      });
      if (!response.ok) throw new Error('failed');
      setSaved(true);
      onAdvance();
    } catch {
      setError('Could not save. Please try again.');
      setIsSubmitting(false);
    }
  }, [situation, onAdvance]);

  const feedbackCopy: Record<Situation, string> = {
    OWN: 'Nice — you can add your property details later.',
    RENT: 'Got it — we can track rent as an expense.',
    FAMILY: "No worries — we'll skip housing for now.",
  };

  return (
    <LinearStepShell
      question="Where do you live?"
      supporting="Just the basics — you'll add details on the dashboard later."
      canAdvance={situation !== null}
      isSubmitting={isSubmitting}
      onAdvance={handleAdvance}
      onBack={onBack}
      feedback={
        saved && situation ? (
          <LinearFeedback>{feedbackCopy[situation]}</LinearFeedback>
        ) : error ? (
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        ) : undefined
      }
    >
      <LinearSegmented<Situation>
        name="housing"
        value={situation}
        onChange={setSituation}
        options={[
          { value: 'OWN', label: 'Own', description: 'With or without a mortgage', icon: <Home className="h-4 w-4" /> },
          { value: 'RENT', label: 'Rent', description: 'Paying rent monthly', icon: <Key className="h-4 w-4" /> },
          { value: 'FAMILY', label: 'With family', description: 'No rent, no mortgage', icon: <Users className="h-4 w-4" /> },
        ]}
      />
    </LinearStepShell>
  );
}

export default HousingStep;
