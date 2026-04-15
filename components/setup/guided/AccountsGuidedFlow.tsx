'use client';

/**
 * AccountsGuidedFlow — Phase 12 twin-track (A.7)
 *
 * Lightweight 3-step flow for adding a bank account from
 * `/dashboard/setup`. Replaces the legacy "deep-link to
 * /dashboard/accounts?action=add" pattern per directive §2.6.
 *
 * Steps:
 *   1. Connect via bank OR manual entry (choice)
 *   2. If manual: type + institution + balance
 *   3. Confirm and save
 *
 * Writes: creates an Account row via `POST /api/accounts` with
 * `source: 'MANUAL'`. The Basiq path hands off to the existing
 * `/api/basiq/connect` flow and opens the consent URL.
 *
 * Composes the shared `<GuidedEntryModal />` shell (A.6).
 */

import { useCallback, useState } from 'react';
import { Banknote, Link as LinkIcon, Edit3 } from 'lucide-react';
import {
  GuidedEntryModal,
  type GuidedEntryStep,
} from '@/components/setup/GuidedEntryModal';

type AccountType = 'TRANSACTIONAL' | 'SAVINGS' | 'OFFSET' | 'CREDIT_CARD';

export interface AccountsGuidedFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function AccountsGuidedFlow({ open, onClose, onComplete }: AccountsGuidedFlowProps) {
  const [mode, setMode] = useState<'choose' | 'manual'>('choose');
  const [accountType, setAccountType] = useState<AccountType>('TRANSACTIONAL');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleBasiqConnect = useCallback(async () => {
    // Hand off to the existing Basiq flow.
    window.location.href = '/dashboard/accounts?action=connect-basiq';
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const amount = parseFloat(balance);
    if (!institution.trim() || isNaN(amount)) {
      setError('Please fill in the institution and a numeric balance.');
      throw new Error('validation');
    }
    const response = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${institution} ${accountType.toLowerCase()}`,
        type: accountType,
        institution,
        currentBalance: amount,
        source: 'MANUAL',
      }),
    });
    if (!response.ok) {
      setError('Could not save the account. Please try again.');
      throw new Error('network');
    }
    onComplete?.();
  }, [accountType, balance, institution, onComplete]);

  const steps: GuidedEntryStep[] =
    mode === 'choose'
      ? [
          {
            id: 'choose',
            question: 'How would you like to add your bank?',
            supporting:
              'Connecting lets Monitrax pull balances and transactions automatically.',
            body: (
              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={handleBasiqConnect}
                  className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 text-left transition-all hover:-translate-y-[1px] hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-indigo-800 dark:from-blue-950/30 dark:to-indigo-950/30"
                >
                  <LinkIcon className="mt-0.5 h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Connect my bank (recommended)
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      60-second Open Banking consent. No login stored.
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/60 p-4 text-left transition-colors hover:bg-slate-50 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
                >
                  <Edit3 className="mt-0.5 h-5 w-5 text-slate-500 dark:text-slate-400" />
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Add manually
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      Just the essentials: type, institution, balance.
                    </div>
                  </div>
                </button>
              </div>
            ),
            canAdvance: () => false, // advanced via button click
          },
        ]
      : [
          {
            id: 'details',
            question: 'Tell us about the account',
            supporting: 'You can refine the details later from the Accounts page.',
            body: (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Type</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as AccountType)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="TRANSACTIONAL">Transaction account</option>
                    <option value="SAVINGS">Savings account</option>
                    <option value="OFFSET">Offset account</option>
                    <option value="CREDIT_CARD">Credit card</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Institution</label>
                  <input
                    type="text"
                    placeholder="e.g. Commonwealth Bank"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Current balance (AUD)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                {error && (
                  <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                )}
              </div>
            ),
            canAdvance: () => institution.trim().length > 0 && !isNaN(parseFloat(balance)),
          },
        ];

  return (
    <GuidedEntryModal
      open={open}
      onClose={() => {
        setMode('choose');
        onClose();
      }}
      title="Add an account"
      subtitle="Connect your bank or add one manually"
      steps={steps}
      onComplete={handleSubmit}
      submitLabel="Save account"
    />
  );
}

export default AccountsGuidedFlow;
