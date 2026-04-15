'use client';

/**
 * PropertiesGuidedFlow — Phase 12 twin-track (A.8)
 *
 * 3-step guided flow for adding a property from /dashboard/setup.
 * Writes to /api/properties with source: 'MANUAL'.
 */

import { useCallback, useState } from 'react';
import {
  GuidedEntryModal,
  type GuidedEntryStep,
} from '@/components/setup/GuidedEntryModal';

type PropertyType = 'HOME' | 'INVESTMENT';

export interface PropertiesGuidedFlowProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function PropertiesGuidedFlow({ open, onClose, onComplete }: PropertiesGuidedFlowProps) {
  const [propertyType, setPropertyType] = useState<PropertyType>('HOME');
  const [name, setName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setError(null);
    const value = parseFloat(currentValue);
    if (!name.trim() || isNaN(value)) {
      setError('Please fill in a name and numeric value.');
      throw new Error('validation');
    }
    const response = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        type: propertyType,
        currentValue: value,
        purchasePrice: value, // Default to current value if user doesn't know
        purchaseDate: new Date().toISOString(),
        valuationDate: new Date().toISOString(),
        source: 'MANUAL',
      }),
    });
    if (!response.ok) {
      setError('Could not save the property. Please try again.');
      throw new Error('network');
    }
    onComplete?.();
  }, [propertyType, name, currentValue, onComplete]);

  const steps: GuidedEntryStep[] = [
    {
      id: 'type',
      question: 'What kind of property?',
      supporting: 'You can add investment properties later from the Properties page.',
      body: (
        <div className="grid grid-cols-2 gap-3">
          {(['HOME', 'INVESTMENT'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPropertyType(t)}
              className={`rounded-xl border p-4 text-left transition-all motion-reduce:transition-none ${
                propertyType === t
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                  : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/40'
              }`}
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t === 'HOME' ? 'Primary home' : 'Investment'}
              </div>
              <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {t === 'HOME' ? 'Where you live' : 'Rented out or held'}
              </div>
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'details',
      question: 'Basic details',
      supporting: 'A rough value is fine — you can refine later.',
      body: (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Name</label>
            <input
              type="text"
              placeholder="e.g. 12 Smith Street"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Current value (AUD)</label>
            <input
              type="number"
              placeholder="0"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ),
      canAdvance: () => name.trim().length > 0 && !isNaN(parseFloat(currentValue)),
    },
  ];

  return (
    <GuidedEntryModal
      open={open}
      onClose={onClose}
      title="Add a property"
      subtitle="Unlock equity and net worth tracking"
      steps={steps}
      onComplete={handleSubmit}
      submitLabel="Save property"
    />
  );
}

export default PropertiesGuidedFlow;
