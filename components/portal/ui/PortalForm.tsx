/**
 * Phase 32: Portal Form Components
 *
 * MODULAR: Form input components for the portal with consistent styling.
 */

'use client';

import { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';

// ============================================================================
// TEXT INPUT
// ============================================================================

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconPosition = 'left', className = '', ...props }, ref) => {
    const hasIcon = !!icon;
    const iconPaddingClass = hasIcon
      ? iconPosition === 'left'
        ? 'pl-10'
        : 'pr-10'
      : '';

    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {hasIcon && iconPosition === 'left' && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full px-3 py-2 text-sm rounded-lg border transition-colors
              ${error
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-slate-200 focus:border-slate-400 focus:ring-slate-400'
              }
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
              placeholder:text-slate-400
              ${iconPaddingClass}
              ${className}
            `}
            {...props}
          />
          {hasIcon && iconPosition === 'right' && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ============================================================================
// TEXTAREA
// ============================================================================

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={`
            w-full px-3 py-2 text-sm rounded-lg border transition-colors resize-y min-h-[80px]
            ${error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-slate-200 focus:border-slate-400 focus:ring-slate-400'
            }
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            placeholder:text-slate-400
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// ============================================================================
// SELECT
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          className={`
            w-full px-3 py-2 text-sm rounded-lg border transition-colors appearance-none bg-white
            ${error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-slate-200 focus:border-slate-400 focus:ring-slate-400'
            }
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            ${className}
          `}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.5em 1.5em',
            paddingRight: '2.5rem',
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

// ============================================================================
// CHECKBOX
// ============================================================================

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className = '', ...props }, ref) => {
    return (
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          ref={ref}
          type="checkbox"
          className={`
            mt-0.5 w-4 h-4 rounded border-slate-300 text-slate-900
            focus:ring-slate-500 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
        <div>
          <span className="text-sm font-medium text-slate-900">{label}</span>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

// ============================================================================
// FORM GROUP & LAYOUT
// ============================================================================

interface FormGroupProps {
  children: ReactNode;
  className?: string;
}

export function FormGroup({ children, className = '' }: FormGroupProps) {
  return <div className={`space-y-4 ${className}`}>{children}</div>;
}

interface FormRowProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export function FormRow({ children, columns = 2, className = '' }: FormRowProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid gap-4 ${gridClasses[columns]} ${className}`}>
      {children}
    </div>
  );
}

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="border-b border-slate-200 pb-6 mb-6 last:border-0 last:pb-0 last:mb-0">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// SEARCH INPUT
// ============================================================================

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, value, className = '', ...props }, ref) => {
    const hasValue = value && String(value).length > 0;

    return (
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={ref}
          type="search"
          value={value}
          className={`
            w-full pl-10 pr-10 py-2 text-sm rounded-lg border border-slate-200
            focus:border-slate-400 focus:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-0
            placeholder:text-slate-400
            ${className}
          `}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
