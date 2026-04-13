'use client';

/**
 * WelcomeStep — Phase 12 PR 3a
 *
 * Replaces the old 4-card explicit profile picker with a 2-question
 * auto-inference flow. Users never see the internal profile labels
 * (STARTER / HOMEOWNER / INVESTOR / MIXED); the flow just asks what's
 * true about their situation and figures out which steps to show.
 *
 * Inference table:
 *
 *   ownsProperty | hasInvestments | inferred profile
 *   -------------+----------------+------------------
 *     false      |     false      | STARTER
 *     true       |     false      | HOMEOWNER
 *     false      |     true       | INVESTOR  (e.g. shares/super only)
 *     true       |     true       | MIXED
 *
 * On mount from a hydrated draft, we reverse-infer the two answers
 * from the stored profileType so the user sees their previous answers
 * still selected. When the user changes either answer, we re-derive
 * and write `profileType` back to the wizard data.
 *
 * PR 3b will extend this with a 3rd "Do you rent?" answer and
 * introduce a `housing` field on WizardData for the renter path.
 *
 * Docs: docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md §3 decision 6
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Clock, Home, TrendingUp, Globe } from 'lucide-react';
import { OnboardingProfileType } from '@/hooks/useOnboardingState';
import {
  WizardStepShell,
  WizardSection,
  WizardSegmentedControl,
  WizardSelectField,
  WizardChip,
} from '../primitives';
import { WizardData } from '../types';
import '@/styles/wizard-animations.css';

// =============================================================================
// INFERENCE HELPERS
// =============================================================================

type YesNo = 'YES' | 'NO';

function inferProfile(ownsProperty: YesNo | null, hasInvestments: YesNo | null): OnboardingProfileType | null {
  if (!ownsProperty || !hasInvestments) return null;
  if (ownsProperty === 'YES' && hasInvestments === 'YES') return 'MIXED';
  if (ownsProperty === 'YES') return 'HOMEOWNER';
  if (hasInvestments === 'YES') return 'INVESTOR';
  return 'STARTER';
}

function reverseInfer(profile: OnboardingProfileType | null): {
  ownsProperty: YesNo | null;
  hasInvestments: YesNo | null;
} {
  switch (profile) {
    case 'STARTER':
      return { ownsProperty: 'NO', hasInvestments: 'NO' };
    case 'HOMEOWNER':
      return { ownsProperty: 'YES', hasInvestments: 'NO' };
    case 'INVESTOR':
      return { ownsProperty: 'NO', hasInvestments: 'YES' };
    case 'MIXED':
      return { ownsProperty: 'YES', hasInvestments: 'YES' };
    default:
      return { ownsProperty: null, hasInvestments: null };
  }
}

// Estimated time labels — keep these loose, they're not contracts.
function estimateMinutes(profile: OnboardingProfileType | null): string {
  switch (profile) {
    case 'STARTER':
      return '~3 min';
    case 'HOMEOWNER':
      return '~5 min';
    case 'INVESTOR':
      return '~6 min';
    case 'MIXED':
      return '~8 min';
    default:
      return '~5 min';
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const COUNTRIES = [
  { value: 'AU', label: '🇦🇺  Australia' },
  { value: 'NZ', label: '🇳🇿  New Zealand' },
  { value: 'US', label: '🇺🇸  United States' },
  { value: 'UK', label: '🇬🇧  United Kingdom' },
] as const;

const currentYear = new Date().getFullYear();
const TAX_YEARS = [
  { value: `${currentYear - 1}-${currentYear}`, label: `FY ${currentYear - 1}–${currentYear}` },
  { value: `${currentYear}-${currentYear + 1}`, label: `FY ${currentYear}–${currentYear + 1}` },
];

const YES_NO_OPTIONS: Array<{ value: YesNo; label: string }> = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
];

// =============================================================================
// COMPONENT
// =============================================================================

interface WelcomeStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function WelcomeStep({ data, onUpdate }: WelcomeStepProps) {
  // Reverse-infer from any hydrated profileType so a resumed draft shows
  // the user's previous answers still highlighted.
  const initial = useMemo(() => reverseInfer(data.profileType), [data.profileType]);
  const [ownsProperty, setOwnsProperty] = useState<YesNo | null>(initial.ownsProperty);
  const [hasInvestments, setHasInvestments] = useState<YesNo | null>(initial.hasInvestments);

  // Whenever the user's answers fully infer a profile, write it back.
  useEffect(() => {
    const inferred = inferProfile(ownsProperty, hasInvestments);
    if (inferred && inferred !== data.profileType) {
      onUpdate({ profileType: inferred });
    }
    // Intentionally not depending on onUpdate/data.profileType to avoid
    // loops — we only want this to fire when the local answers change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownsProperty, hasInvestments]);

  const inferred = inferProfile(ownsProperty, hasInvestments);
  const timeLabel = estimateMinutes(inferred);
  const hasAllAnswers = ownsProperty !== null && hasInvestments !== null;

  return (
    <WizardStepShell
      icon={<Sparkles className="h-8 w-8" strokeWidth={1.5} />}
      title={
        <>
          Welcome to{' '}
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">
            Monitrax
          </span>
        </>
      }
      subtitle="Tell us a little about your situation so we can tailor the setup to just what you need."
      headerTrailing={
        <WizardChip color="green" icon={<Clock className="h-3 w-3" />}>
          Setup time: {timeLabel}
        </WizardChip>
      }
    >
      {/* Two-question profile inference */}
      <WizardSection
        icon={<Home className="h-4 w-4" />}
        iconClassName="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
        title="Do you own any property?"
        description="Your own home, an investment property, or both."
      >
        <WizardSegmentedControl
          value={ownsProperty}
          onChange={setOwnsProperty}
          options={YES_NO_OPTIONS}
          name="owns-property"
        />
      </WizardSection>

      <WizardSection
        icon={<TrendingUp className="h-4 w-4" />}
        iconClassName="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
        title="Do you have investments?"
        description="Shares, ETFs, managed funds, superannuation, or crypto."
      >
        <WizardSegmentedControl
          value={hasInvestments}
          onChange={setHasInvestments}
          options={YES_NO_OPTIONS}
          name="has-investments"
        />
      </WizardSection>

      {/* Location & tax year — only revealed once the user has answered
          the profile questions so the form feels calm, not overwhelming. */}
      {hasAllAnswers && (
        <WizardSection
          icon={<Globe className="h-4 w-4" />}
          iconClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
          title="Where are you located?"
          description="We use this to set up tax defaults and local terminology."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <WizardSelectField
              name="country"
              label="Country"
              value={data.country}
              onChange={(v) => onUpdate({ country: v })}
              options={COUNTRIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <WizardSelectField
              name="tax-year"
              label="Tax year"
              value={data.taxYear}
              onChange={(v) => onUpdate({ taxYear: v })}
              options={TAX_YEARS}
            />
          </div>
        </WizardSection>
      )}

      {/* Gentle nudge when everything is filled in */}
      {hasAllAnswers && (
        <p className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          You&apos;re all set. Click <span className="font-semibold">Continue</span> to start adding
          your financial data.
        </p>
      )}
    </WizardStepShell>
  );
}

export default WelcomeStep;
