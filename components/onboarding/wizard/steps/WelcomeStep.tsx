'use client';

/**
 * WelcomeStep — Phase 12 PR 3b
 *
 * PR 3a introduced 2-question profile auto-inference (removed the 4-card
 * explicit picker). PR 3b extends Welcome with TWO MORE pieces of
 * context, both of which drive runtime step filtering:
 *
 *   1. **Housing situation** (3-option segmented control):
 *      - OWN  → show Properties step (existing PR 3a behaviour)
 *      - RENT → hide Properties step, rent auto-seeds an Expense later
 *      - BOTH → show Properties step AND seed a rent expense
 *
 *   2. **Debts checkbox** (multi-select chips):
 *      - HECS / STUDENT loan
 *      - Car loan
 *      - Personal loan
 *      - Business loan
 *      → if any ticked, the new Debts step becomes visible after Properties.
 *
 * The profile label is now inferred from `housing` (as a proxy for
 * ownsProperty) AND `hasInvestments` from the existing question, so the
 * existing 4-profile structure still works transparently.
 *
 * Docs: docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md §3 rows 3, 6, C, F
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Clock,
  Home,
  TrendingUp,
  Globe,
  CreditCard,
  GraduationCap,
  Car,
  Banknote,
  Briefcase,
} from 'lucide-react';
import { OnboardingProfileType } from '@/hooks/useOnboardingState';
import {
  WizardStepShell,
  WizardSection,
  WizardSegmentedControl,
  WizardSelectField,
  WizardChip,
} from '../primitives';
import { WizardData, HousingSituation, DebtCategory } from '../types';
import '@/styles/wizard-animations.css';

// =============================================================================
// INFERENCE HELPERS
// =============================================================================

type YesNo = 'YES' | 'NO';

/**
 * Profile inference from the PR 3a+3b questions.
 *
 *   housing        | hasInvestments | inferred profile
 *   ---------------+----------------+------------------
 *    RENT          |     false      | STARTER
 *    RENT          |     true       | INVESTOR  (shares/super only)
 *    OWN / BOTH    |     false      | HOMEOWNER
 *    OWN / BOTH    |     true       | MIXED
 *
 * The distinction between OWN and BOTH only affects whether a rent
 * expense is seeded — not the profile label, since the step filter
 * uses `housing` directly for that.
 */
function inferProfile(
  housing: HousingSituation | null,
  hasInvestments: YesNo | null
): OnboardingProfileType | null {
  if (!housing || !hasInvestments) return null;
  const owns = housing === 'OWN' || housing === 'BOTH';
  if (owns && hasInvestments === 'YES') return 'MIXED';
  if (owns) return 'HOMEOWNER';
  if (hasInvestments === 'YES') return 'INVESTOR';
  return 'STARTER';
}

function reverseInfer(
  profile: OnboardingProfileType | null,
  housing: HousingSituation | null
): { housing: HousingSituation | null; hasInvestments: YesNo | null } {
  // Housing is stored directly now — no need to derive it. Only the
  // hasInvestments Yes/No needs to be reverse-derived.
  switch (profile) {
    case 'STARTER':
      return { housing: housing ?? 'RENT', hasInvestments: 'NO' };
    case 'HOMEOWNER':
      return { housing: housing ?? 'OWN', hasInvestments: 'NO' };
    case 'INVESTOR':
      return { housing: housing ?? 'RENT', hasInvestments: 'YES' };
    case 'MIXED':
      return { housing: housing ?? 'OWN', hasInvestments: 'YES' };
    default:
      return { housing, hasInvestments: null };
  }
}

// Estimated time labels — keep these loose.
function estimateMinutes(profile: OnboardingProfileType | null, debtCount: number): string {
  const base =
    profile === 'STARTER'
      ? 3
      : profile === 'HOMEOWNER'
      ? 5
      : profile === 'INVESTOR'
      ? 6
      : profile === 'MIXED'
      ? 8
      : 5;
  const debtBonus = debtCount > 0 ? 1 : 0;
  return `~${base + debtBonus} min`;
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

const HOUSING_OPTIONS: Array<{ value: HousingSituation; label: string }> = [
  { value: 'OWN', label: 'Own' },
  { value: 'RENT', label: 'Rent' },
  { value: 'BOTH', label: 'Both' },
];

const YES_NO_OPTIONS: Array<{ value: YesNo; label: string }> = [
  { value: 'YES', label: 'Yes' },
  { value: 'NO', label: 'No' },
];

interface DebtOption {
  value: DebtCategory;
  label: string;
  icon: React.ReactNode;
  accent: string;
}

const DEBT_OPTIONS: DebtOption[] = [
  {
    value: 'STUDENT',
    label: 'HECS / student loan',
    icon: <GraduationCap className="h-4 w-4" />,
    accent: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400',
  },
  {
    value: 'CAR',
    label: 'Car loan',
    icon: <Car className="h-4 w-4" />,
    accent: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  },
  {
    value: 'PERSONAL',
    label: 'Personal loan',
    icon: <Banknote className="h-4 w-4" />,
    accent: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400',
  },
  {
    value: 'BUSINESS',
    label: 'Business loan',
    icon: <Briefcase className="h-4 w-4" />,
    accent: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
  },
];

// =============================================================================
// COMPONENT
// =============================================================================

interface WelcomeStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function WelcomeStep({ data, onUpdate }: WelcomeStepProps) {
  // Reverse-infer hasInvestments from any hydrated profileType so a
  // resumed draft shows the user's previous answers still highlighted.
  // Housing is now stored directly on WizardData so we read it as-is.
  const initial = useMemo(
    () => reverseInfer(data.profileType, data.housing),
    [data.profileType, data.housing]
  );
  const [hasInvestments, setHasInvestments] = useState<YesNo | null>(
    initial.hasInvestments
  );

  // Whenever the answers change, re-derive the profile and write it back.
  //
  // Fix (Phase 12 v3 — bug A.3): the previous guard was
  //   `if (inferred && inferred !== data.profileType)`
  // which silently skipped the update whenever `inferred` was null. That
  // meant any reversion of an answer (e.g. user clears the housing
  // segmented control, or toggles hasInvestments back to null) left the
  // stale prior profileType in place, and the wizard kept rendering
  // steps for a profile the user's current answers no longer imply.
  // We now propagate null too, so reverting either answer clears the
  // profile and forces the user to re-complete Welcome before advancing.
  // See docs/blueprint/PHASE_12_REDESIGN_V3.md §7.1 bug A.3.
  useEffect(() => {
    const inferred = inferProfile(data.housing, hasInvestments);
    if (inferred !== data.profileType) {
      onUpdate({ profileType: inferred });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.housing, hasInvestments]);

  const inferred = inferProfile(data.housing, hasInvestments);
  const timeLabel = estimateMinutes(inferred, data.debtCategories.length);
  const hasAllCoreAnswers = data.housing !== null && hasInvestments !== null;

  // Toggle a debt category on the multi-select
  const toggleDebt = (cat: DebtCategory) => {
    const current = data.debtCategories;
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    onUpdate({ debtCategories: next });
  };

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
      {/* Q1: Housing situation (3-option, drives renter path) */}
      <WizardSection
        icon={<Home className="h-4 w-4" />}
        iconClassName="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
        title="Do you own or rent?"
        description="Pick the one that best describes your situation — we'll tailor the next steps."
      >
        <WizardSegmentedControl<HousingSituation>
          value={data.housing}
          onChange={(v) => onUpdate({ housing: v })}
          options={HOUSING_OPTIONS}
          name="housing"
          helper={
            data.housing === 'BOTH'
              ? 'Got it — you own property AND rent somewhere else. We\u2019ll ask about both.'
              : data.housing === 'RENT'
              ? 'We\u2019ll skip property setup and add your rent as a regular expense.'
              : undefined
          }
        />
      </WizardSection>

      {/* Q2: Investments / super (drives Investments + Super steps) */}
      <WizardSection
        icon={<TrendingUp className="h-4 w-4" />}
        iconClassName="bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
        title="Do you have investments or super?"
        description="Shares, ETFs, managed funds, superannuation, or crypto."
      >
        <WizardSegmentedControl
          value={hasInvestments}
          onChange={setHasInvestments}
          options={YES_NO_OPTIONS}
          name="has-investments"
        />
      </WizardSection>

      {/* Q3: Debts multi-select (drives Debts step visibility) */}
      <WizardSection
        icon={<CreditCard className="h-4 w-4" />}
        iconClassName="bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400"
        title="Any of these debts?"
        description="Tick all that apply — we'll add a quick step for them. Credit cards are handled in the Accounts step."
      >
        <div className="flex flex-wrap gap-2">
          {DEBT_OPTIONS.map((opt) => {
            const selected = data.debtCategories.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                role="checkbox"
                aria-checked={selected}
                onClick={() => toggleDebt(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  selected
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <span className={selected ? '' : opt.accent.replace(/bg-\S+/g, '').trim()}>
                  {opt.icon}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
          None of these? Leave them unticked and the debts step will be skipped.
        </p>
      </WizardSection>

      {/* Location & tax year — only revealed once the core questions are answered */}
      {hasAllCoreAnswers && (
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

      {hasAllCoreAnswers && (
        <p className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          You&apos;re all set. Click <span className="font-semibold">Continue</span> to start adding
          your financial data.
        </p>
      )}
    </WizardStepShell>
  );
}

export default WelcomeStep;
