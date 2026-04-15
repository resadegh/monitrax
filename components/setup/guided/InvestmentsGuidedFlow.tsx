'use client';

/**
 * InvestmentsGuidedFlow — Phase 12 twin-track (A.11)
 *
 * 2-step guided flow for adding an investment account from
 * /dashboard/setup. Writes to /api/investments/accounts with
 * source: 'MANUAL'.
 */

import { useCallback, useState } from 'react';
import {
  GuidedEntryModal,
  type GuidedEntryStep,
} from '@/components/setup/GuidedEntryModal';

type InvestmentType = 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';

export interface InvestmentsGuidedFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function InvestmentsGuidedFlow({ open, onClose, onComplete }: InvestmentsGuidedFlowProps) {
  const [type, setType] = useState<InvestmentType>('BROKERAGE');
  const [name, setName] = useState('');
  const [cashBalance, setCashBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const value = parseFloat(cashBalance);
    if (!name.trim() || isNaN(value) || value < 0) {
      setError('Please enter a name and non-negative balance.');
      throw new Error('validation');
    }
    const response = await fetch('/api/investments/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        type,
        cashBalance: value,
        source: 'MANUAL',
      }),
    });
    if (!response.ok) {
      setError('Could not save the account. Please try again.');
      throw new Error('network');
    }
    onComplete?.();
  }, [type, name, cashBalance, onComplete]);

  const typeLabels: Record<InvestmentType, string> = {
    BROKERAGE: 'Brokerage',
    SUPERS: 'Super',
    FUND: 'Managed fund',
    TRUST: 'Trust',
    ETF_CRYPTO: 'ETF / Crypto',
  };

  const steps: GuidedEntryStep[] = [
    {
      id: 'type',
      question: 'What type of investment account?',
      body: (
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(typeLabels) as InvestmentType[]).map((t) => (
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
              {typeLabels[t]}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'details',
      question: 'Basic details',
      supporting: 'You can add holdings later from the Investments page.',
      body: (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Account name</label>
            <input
              type="text"
              placeholder="e.g. CommSec share account"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Cash balance (AUD)</label>
            <input
              type="number"
              placeholder="0.00"
              value={cashBalance}
              onChange={(e) => setCashBalance(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ),
      canAdvance: () => name.trim().length > 0 && !isNaN(parseFloat(cashBalance)),
    },
  ];

  return (
    <GuidedEntryModal
      open={open}
      onClose={onClose}
      title="Add an investment account"
      subtitle="See portfolio performance and capital gains"
      steps={steps}
      onComplete={handleSubmit}
      submitLabel="Save account"
    />
  );
}

export default InvestmentsGuidedFlow;
