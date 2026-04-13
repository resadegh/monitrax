'use client';

/**
 * WizardField — Phase 12 PR 3a
 *
 * Standard label + input wrapper used across every wizard step. Three
 * specialised variants are provided for the most common cases:
 *
 *   - <WizardField>            — generic (text/number/email/date)
 *   - <WizardCurrencyField>    — adds a $ prefix
 *   - <WizardPercentField>     — adds a % suffix
 *   - <WizardSelectField>      — styled select
 *
 * All variants accept `label`, `required`, `helper`, `error`, and a
 * `className` override. Labels use the shared `.wz-field-label` class;
 * inputs use `.wz-input`; helper text uses `.wz-field-helper`.
 */

import React from 'react';

interface BaseFieldProps {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  className?: string;
  id?: string;
}

interface WizardFieldProps
  extends BaseFieldProps,
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {}

export function WizardField({
  label,
  required,
  helper,
  error,
  className = '',
  id,
  ...inputProps
}: WizardFieldProps) {
  const fieldId = id || inputProps.name || undefined;
  return (
    <div className={`wz-field ${className}`}>
      <label
        htmlFor={fieldId}
        className={`wz-field-label ${required ? 'wz-field-label-required' : ''}`}
      >
        {label}
      </label>
      <input id={fieldId} className="wz-input" {...inputProps} />
      {helper && !error && <p className="wz-field-helper">{helper}</p>}
      {error && <p className="wz-field-error">{error}</p>}
    </div>
  );
}

interface WizardCurrencyFieldProps extends BaseFieldProps {
  value: number | string;
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | string;
  name?: string;
  disabled?: boolean;
}

export function WizardCurrencyField({
  label,
  required,
  helper,
  error,
  className = '',
  id,
  value,
  onChange,
  placeholder = '0',
  min = 0,
  max,
  step = 'any',
  name,
  disabled,
}: WizardCurrencyFieldProps) {
  const fieldId = id || name;
  return (
    <div className={`wz-field ${className}`}>
      <label
        htmlFor={fieldId}
        className={`wz-field-label ${required ? 'wz-field-label-required' : ''}`}
      >
        {label}
      </label>
      <div className="wz-input-currency-wrap">
        <span aria-hidden className="wz-input-currency-prefix">
          $
        </span>
        <input
          id={fieldId}
          name={name}
          type="number"
          inputMode="decimal"
          value={value === 0 ? '' : value}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="wz-input"
        />
      </div>
      {helper && !error && <p className="wz-field-helper">{helper}</p>}
      {error && <p className="wz-field-error">{error}</p>}
    </div>
  );
}

interface WizardPercentFieldProps extends BaseFieldProps {
  value: number | string;
  onChange: (value: number) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number | string;
  name?: string;
}

export function WizardPercentField({
  label,
  required,
  helper,
  error,
  className = '',
  id,
  value,
  onChange,
  placeholder = '0.00',
  min = 0,
  max = 100,
  step = 0.01,
  name,
}: WizardPercentFieldProps) {
  const fieldId = id || name;
  return (
    <div className={`wz-field ${className}`}>
      <label
        htmlFor={fieldId}
        className={`wz-field-label ${required ? 'wz-field-label-required' : ''}`}
      >
        {label}
      </label>
      <div className="wz-input-percent-wrap">
        <input
          id={fieldId}
          name={name}
          type="number"
          inputMode="decimal"
          value={value === 0 ? '' : value}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="wz-input"
        />
        <span aria-hidden className="wz-input-percent-suffix">
          %
        </span>
      </div>
      {helper && !error && <p className="wz-field-helper">{helper}</p>}
      {error && <p className="wz-field-error">{error}</p>}
    </div>
  );
}

interface WizardSelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  name?: string;
}

export function WizardSelectField({
  label,
  required,
  helper,
  error,
  className = '',
  id,
  value,
  onChange,
  options,
  name,
}: WizardSelectFieldProps) {
  const fieldId = id || name;
  return (
    <div className={`wz-field ${className}`}>
      <label
        htmlFor={fieldId}
        className={`wz-field-label ${required ? 'wz-field-label-required' : ''}`}
      >
        {label}
      </label>
      <select
        id={fieldId}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="wz-input"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      {helper && !error && <p className="wz-field-helper">{helper}</p>}
      {error && <p className="wz-field-error">{error}</p>}
    </div>
  );
}

export default WizardField;
