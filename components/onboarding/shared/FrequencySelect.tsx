'use client';

import React, { useCallback } from 'react';
import { Frequency } from '@/lib/types/prisma-enums';

interface FrequencyOption {
  value: Frequency;
  label: string;
}

const DEFAULT_OPTIONS: FrequencyOption[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'ANNUAL', label: 'Annually' },
];

interface FrequencySelectProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options?: FrequencyOption[];
  label?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Frequency selector dropdown with consistent styling.
 * Extracts common pattern used across onboarding steps.
 */
export function FrequencySelect({
  id,
  name,
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  label,
  className = '',
  disabled = false,
  required = false,
}: FrequencySelectProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const selectClasses = `
    block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5
    text-gray-900
    focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white
    disabled:bg-gray-100 disabled:cursor-not-allowed
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        className={selectClasses}
        disabled={disabled}
        required={required}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// Re-export the default options for convenience
export { DEFAULT_OPTIONS as FREQUENCY_OPTIONS };
