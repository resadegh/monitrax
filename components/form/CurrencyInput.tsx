/**
 * CurrencyInput - Formatted currency input
 * Phase 06 UI Core Component
 */

'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  currency?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function CurrencyInput({
  value,
  onChange,
  currency = 'AUD',
  placeholder = '0.00',
  disabled = false,
  className,
  id,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState(
    value ? formatCurrency(value, currency) : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    // Show raw number when focused
    setDisplayValue(value ? value.toString() : '');
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Format when blurred
    setDisplayValue(value ? formatCurrency(value, currency) : '');
  }, [value, currency]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/[^0-9.]/g, '');
      const numValue = parseFloat(rawValue) || 0;
      setDisplayValue(rawValue);
      onChange(numValue);
    },
    [onChange]
  );

  return (
    <div className="relative">
      {!isFocused && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          $
        </span>
      )}
      <Input
        id={id}
        type={isFocused ? 'number' : 'text'}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(!isFocused && 'pl-7', className)}
        step="0.01"
      />
    </div>
  );
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * NumberInput - Formatted number input
 */
interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  placeholder = '0',
  disabled = false,
  className,
  id,
}: NumberInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let numValue = parseFloat(e.target.value) || 0;
      if (min !== undefined) numValue = Math.max(min, numValue);
      if (max !== undefined) numValue = Math.min(max, numValue);
      onChange(numValue);
    },
    [onChange, min, max]
  );

  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        className={cn(suffix && 'pr-12', className)}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
          {suffix}
        </span>
      )}
    </div>
  );
}
