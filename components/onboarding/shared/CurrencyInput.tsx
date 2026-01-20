'use client';

import React, { useCallback } from 'react';
import { DollarSign } from 'lucide-react';

interface CurrencyInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  prefix?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  step?: string;
}

/**
 * Currency input field with $ prefix and consistent styling.
 * Extracts common pattern used across onboarding steps.
 */
export function CurrencyInput({
  id,
  name,
  value,
  onChange,
  placeholder = '0',
  label,
  prefix = '$',
  className = '',
  disabled = false,
  required = false,
  min = 0,
  step = '0.01',
}: CurrencyInputProps) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const inputClasses = `
    block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 pl-8
    text-gray-900 placeholder:text-gray-400
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
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {prefix === '$' ? <DollarSign className="w-4 h-4" /> : prefix}
        </div>
        <input
          id={id}
          name={name}
          type="number"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={inputClasses}
          disabled={disabled}
          required={required}
          min={min}
          step={step}
        />
      </div>
    </div>
  );
}
