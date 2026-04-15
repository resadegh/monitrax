'use client';

/**
 * IncomeGuidedFlow — Phase 12 twin-track (A.9)
 *
 * 2-step guided flow for adding an income source from
 * /dashboard/setup. Writes to /api/income with source: 'MANUAL'.
 */

import { useCallback, useState } from 'react';
import {
  GuidedEntryModal,
  type GuidedEntryStep,
} from '@/components/setup/GuidedEntryModal';

type IncomeType = 'SALARY' | 'RENTAL' | 'INVESTMENT' | 'OTHER';
type Frequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ANNUAL';

export interface IncomeGuidedFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function IncomeGuidedFlow({ open, onClose, onComplete }: IncomeGuidedFlowProps) {
  const [type, setType] = useState<IncomeType>('SALARY');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) {
      setError('Please enter a positive amount.');
      throw new Error('validation');
    }
    const response = await fetch('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim() || `${type} income`,
        type,
        amount: value,
        frequency,
        source: 'MANUAL',
      }),
    });
    if (!response.ok) {
      setError('Could not save the income. Please try again.');
      throw new Error('network');
    }
    onComplete?.();
  }, [type, amount, frequency, name, onComplete]);

  const steps: GuidedEntryStep[] = [
    {
      id: 'type',
      question: 'What type of income?',
      body: (
        <div className="grid grid-cols-2 gap-2">
          {(['SALARY', 'RENTAL', 'INVESTMENT', 'OTHER'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-all motion-reduce:transition-none ${
                type === t
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950/30 dark:text-indigo-300'
                  : 'border-slate-200 bg-white/60 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300'
              }`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'amount',
      question: 'How much and how often?',
      supporting: 'Rough is fine — you can refine later.',
      body: (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Amount (AUD)</label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="WEEKLY">Weekly</option>
              <option value="FORTNIGHTLY">Fortnightly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Name (optional)</label>
            <input
              type="text"
              placeholder="e.g. Main salary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ),
      canAdvance: () => !isNaN(parseFloat(amount)) && parseFloat(amount) > 0,
    },
  ];

  return (
    <GuidedEntryModal
      open={open}
      onClose={onClose}
      title="Add income"
      subtitle="Powers cashflow forecasts and savings rate"
      steps={steps}
      onComplete={handleSubmit}
      submitLabel="Save income"
    />
  );
}

export default IncomeGuidedFlow;
