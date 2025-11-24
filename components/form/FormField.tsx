/**
 * FormField - Unified form field wrapper
 * Phase 06 UI Core Component
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}

export function FormField({
  label,
  error,
  helpText,
  required,
  children,
  className,
  htmlFor,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {helpText && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{helpText}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
