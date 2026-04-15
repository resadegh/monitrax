'use client';

/**
 * LoansGuidedFlow — Phase 12 twin-track (A.12)
 *
 * 2-step guided flow for adding a loan from /dashboard/setup.
 * Writes to /api/loans with source: 'MANUAL'.
 */

import { useCallback, useState } from 'react';
import {
  GuidedEntryModal,
  type GuidedEntryStep,
} from '@/components/setup/GuidedEntryModal';

type LoanType = 'HOME' | 'INVESTMENT' | 'CAR' | 'STUDENT' | 'PERSONAL' | 'BUSINESS';
type RepaymentFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';

export interface LoansGuidedFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function LoansGuidedFlow({ open, onClose, onComplete }: LoansGuidedFlowProps) {
  const [type, setType] = useState<LoanType>('HOME');
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [minRepayment, setMinRepayment] = useState('');
  const [repaymentFrequency, setRepaymentFrequency] =
    useState<RepaymentFrequency>('MONTHLY');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const principalNum = parseFloat(principal);
    const rateNum = parseFloat(interestRate);
    const repaymentNum = parseFloat(minRepayment);
    if (!name.trim() || isNaN(principalNum) || isNaN(rateNum) || isNaN(repaymentNum)) {
      setError('Please fill in all fields with numbers.');
      throw new Error('validation');
    }
    const response = await fetch('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        type,
        principal: principalNum,
        interestRateAnnual: rateNum / 100, // convert % to decimal
        rateType: 'VARIABLE',
        isInterestOnly: false,
        termMonthsRemaining: 360, // default 30 years
        minRepayment: repaymentNum,
        repaymentFrequency,
        source: 'MANUAL',
      }),
    });
    if (!response.ok) {
      setError('Could not save the loan. Please try again.');
      throw new Error('network');
    }
    onComplete?.();
  }, [type, name, principal, interestRate, minRepayment, repaymentFrequency, onComplete]);

  const typeLabels: Record<LoanType, string> = {
    HOME: 'Home loan',
    INVESTMENT: 'Investment',
    CAR: 'Car',
    STUDENT: 'Student (HECS)',
    PERSONAL: 'Personal',
    BUSINESS: 'Business',
  };

  const steps: GuidedEntryStep[] = [
    {
      id: 'type',
      question: 'What kind of loan?',
      body: (
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(typeLabels) as LoanType[]).map((t) => (
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
      supporting: 'You can refine rate, term, and link to a property later.',
      body: (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Loan name</label>
            <input
              type="text"
              placeholder="e.g. Home loan CBA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Balance (AUD)</label>
              <input
                type="number"
                placeholder="0"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Rate (% p.a.)</label>
              <input
                type="number"
                step="0.01"
                placeholder="6.25"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Repayment (AUD)</label>
              <input
                type="number"
                placeholder="0"
                value={minRepayment}
                onChange={(e) => setMinRepayment(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Frequency</label>
              <select
                value={repaymentFrequency}
                onChange={(e) => setRepaymentFrequency(e.target.value as RepaymentFrequency)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="FORTNIGHTLY">Fortnightly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ),
      canAdvance: () =>
        name.trim().length > 0 &&
        !isNaN(parseFloat(principal)) &&
        !isNaN(parseFloat(interestRate)) &&
        !isNaN(parseFloat(minRepayment)),
    },
  ];

  return (
    <GuidedEntryModal
      open={open}
      onClose={onClose}
      title="Add a loan"
      subtitle="Track debt-quality and find refinance opportunities"
      steps={steps}
      onComplete={handleSubmit}
      submitLabel="Save loan"
    />
  );
}

export default LoansGuidedFlow;
