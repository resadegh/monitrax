'use client';

/**
 * DescribeItAccelerator — Phase 12 Track G.4
 *
 * The optional "describe it in your own words" accelerator. On a wizard
 * step the user can type one plain-English sentence; the extraction
 * engine (`/api/onboarding/chat/extract` — kept dormant since the chat
 * was retired in G.2) turns it into a `WizardStateDelta`, and
 * `applyWizardDelta` appends the extracted rows to the step's form,
 * pre-filled.
 *
 * Design rules (docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §10):
 *   - The FORM stays the system of record. The accelerator only ever
 *     APPENDS pre-filled rows — it never replaces or deletes. A bad
 *     extraction is non-destructive: at worst the user deletes a row.
 *   - Collapsed by default — an unobtrusive one-line affordance. The
 *     wizard works identically with it ignored.
 *   - Every failure path is gentle + the form below is untouched.
 *
 * Shown only on the 8 steps that map 1:1 to an extraction topic
 * (`isAcceleratorStep`).
 */

import React, { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, Check } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { WizardData, WizardStepId } from './types';
import {
  applyWizardDelta,
  countDeltaItems,
} from '@/lib/onboarding/applyWizardDelta';
import type { WizardStateDelta } from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';

// The 8 wizard steps whose id maps 1:1 to an extraction topic.
const ACCELERATOR_STEPS: ReadonlySet<string> = new Set([
  'household',
  'properties',
  'debts',
  'accounts',
  'investments',
  'super',
  'assets',
  'income-expenses',
]);

/** True when the accelerator should be offered on the given step. */
export function isAcceleratorStep(step: WizardStepId): boolean {
  return ACCELERATOR_STEPS.has(step);
}

const PLACEHOLDER: Record<string, string> = {
  household: 'e.g. "Me and my partner, two kids, and a dog"',
  properties: 'e.g. "An investment unit worth $480k with a mortgage"',
  debts: 'e.g. "A $22k car loan, and my HECS debt"',
  accounts: 'e.g. "An everyday account, and savings with about $15k"',
  investments: 'e.g. "A brokerage account worth roughly $30k"',
  super: 'e.g. "AustralianSuper, balance around $85k"',
  assets: 'e.g. "A 2020 Mazda CX-5 worth about $28k"',
  'income-expenses': 'e.g. "I earn $120k salary; rent is $600 a week"',
};

interface DescribeItAcceleratorProps {
  step: WizardStepId;
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export function DescribeItAccelerator({
  step,
  data,
  onUpdate,
}: DescribeItAcceleratorProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAcceleratorStep(step)) return null;

  const handleFill = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/onboarding/chat/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: step,
          userMessage: message,
          currentStateSubset: {},
          recentTranscript: [],
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { delta?: unknown };
        error?: { message?: string };
      } | null;

      if (!res.ok || !json?.success || !json.data?.delta) {
        setError(
          json?.error?.message ||
            'Could not read that — try rephrasing, or just fill the form below.',
        );
        return;
      }

      const delta = json.data.delta as WizardStateDelta;
      const count = countDeltaItems(delta);
      if (count === 0) {
        setError(
          'I did not catch anything to add — try being more specific, or fill the form below.',
        );
        return;
      }

      onUpdate(applyWizardDelta(delta, data));
      setText('');
      setResult(
        `Added ${count} ${count === 1 ? 'item' : 'items'} below — please review and complete the details.`,
      );
    } catch {
      setError('Something went wrong — the form below still works as normal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/60 dark:border-slate-700/50 dark:bg-slate-900/40">
      {/* Collapsed trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
        aria-expanded={open}
      >
        <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
        <span className="flex-1">
          In a hurry? Describe this in a sentence and I will fill the form.
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded composer */}
      {open && (
        <div className="border-t border-slate-200/70 px-3.5 py-3 dark:border-slate-700/50">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER[step] ?? 'Describe it in a sentence…'}
            rows={2}
            maxLength={1000}
            disabled={busy}
            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              I will pre-fill the form — you stay in control and can edit
              anything.
            </p>
            <button
              type="button"
              onClick={handleFill}
              disabled={busy || !text.trim()}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Reading…
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Fill the form
                </>
              )}
            </button>
          </div>

          {result && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300">
              <Check className="mt-0.5 h-3 w-3 flex-shrink-0" strokeWidth={3} />
              <span>{result}</span>
            </div>
          )}
          {error && (
            <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DescribeItAccelerator;
