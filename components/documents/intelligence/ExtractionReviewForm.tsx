/**
 * Phase 26: Extraction Review Form
 *
 * Form for reviewing and editing extracted data before confirming.
 * Shows extracted fields with the option to edit values that have
 * low confidence or that the user wants to correct.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle, Loader2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SuggestedAction {
  action: string;
  label: string;
  description?: string;
  prefilled: Record<string, unknown>;
  confidence: number;
}

interface ExtractionReviewFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: SuggestedAction;
  lowConfidenceFields: string[];
  onConfirm: (data: Record<string, unknown>, corrections: Record<string, boolean>) => Promise<void>;
  isConfirming?: boolean;
}

// ============================================================================
// Field Configuration
// ============================================================================

interface FieldConfig {
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

const ACTION_FIELD_CONFIGS: Record<string, Record<string, FieldConfig>> = {
  CREATE_EXPENSE: {
    vendor: { label: 'Vendor', type: 'text', required: true, placeholder: 'Business name' },
    amount: { label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
    date: { label: 'Date', type: 'date', required: true },
    category: {
      label: 'Category',
      type: 'select',
      required: true,
      options: [
        { value: 'HOUSING', label: 'Housing' },
        { value: 'RATES', label: 'Rates' },
        { value: 'INSURANCE', label: 'Insurance' },
        { value: 'MAINTENANCE', label: 'Maintenance' },
        { value: 'UTILITIES', label: 'Utilities' },
        { value: 'FOOD', label: 'Food' },
        { value: 'TRANSPORT', label: 'Transport' },
        { value: 'ENTERTAINMENT', label: 'Entertainment' },
        { value: 'STRATA', label: 'Strata' },
        { value: 'LAND_TAX', label: 'Land Tax' },
        { value: 'LOAN_INTEREST', label: 'Loan Interest' },
        { value: 'PERSONAL', label: 'Personal' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
    taxDeductible: { label: 'Tax Deductible', type: 'checkbox' },
    gstAmount: { label: 'GST Amount', type: 'number', placeholder: '0.00' },
    invoiceNumber: { label: 'Invoice Number', type: 'text', placeholder: 'INV-001' },
  },
  CREATE_INCOME: {
    name: { label: 'Name', type: 'text', required: true, placeholder: 'Income description' },
    amount: { label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
    type: {
      label: 'Type',
      type: 'select',
      required: true,
      options: [
        { value: 'SALARY', label: 'Salary' },
        { value: 'RENTAL', label: 'Rental' },
        { value: 'INVESTMENT', label: 'Investment' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
    frequency: {
      label: 'Frequency',
      type: 'select',
      required: true,
      options: [
        { value: 'WEEKLY', label: 'Weekly' },
        { value: 'FORTNIGHTLY', label: 'Fortnightly' },
        { value: 'MONTHLY', label: 'Monthly' },
        { value: 'ANNUAL', label: 'Annual' },
      ],
    },
    isTaxable: { label: 'Taxable', type: 'checkbox' },
  },
  CREATE_LOAN: {
    name: { label: 'Loan Name', type: 'text', required: true, placeholder: 'e.g., Home Loan' },
    principal: { label: 'Principal Amount', type: 'number', required: true, placeholder: '0.00' },
    interestRate: { label: 'Interest Rate (%)', type: 'number', placeholder: '6.25' },
    loanType: {
      label: 'Loan Type',
      type: 'select',
      options: [
        { value: 'HOME_LOAN', label: 'Home Loan' },
        { value: 'INVESTMENT_LOAN', label: 'Investment Loan' },
        { value: 'PERSONAL', label: 'Personal Loan' },
        { value: 'CAR', label: 'Car Loan' },
        { value: 'OTHER', label: 'Other' },
      ],
    },
    rateType: {
      label: 'Rate Type',
      type: 'select',
      options: [
        { value: 'VARIABLE', label: 'Variable' },
        { value: 'FIXED', label: 'Fixed' },
      ],
    },
  },
};

// Default config for unknown actions
const DEFAULT_FIELD_CONFIG: FieldConfig = {
  label: 'Value',
  type: 'text',
};

// ============================================================================
// Helper Functions
// ============================================================================

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600 bg-green-50 border-green-200';
  if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// ============================================================================
// Component
// ============================================================================

export function ExtractionReviewForm({
  open,
  onOpenChange,
  action,
  lowConfidenceFields,
  onConfirm,
  isConfirming,
}: ExtractionReviewFormProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>(action.prefilled);
  const [corrections, setCorrections] = useState<Record<string, boolean>>({});
  const [editingFields, setEditingFields] = useState<Set<string>>(
    new Set(lowConfidenceFields)
  );

  // Get field configurations for this action
  const fieldConfigs = useMemo(() => {
    return ACTION_FIELD_CONFIGS[action.action] || {};
  }, [action.action]);

  // Get all fields to display
  const displayFields = useMemo(() => {
    const fields: Array<{ key: string; config: FieldConfig; value: unknown }> = [];

    // Add configured fields first
    for (const [key, config] of Object.entries(fieldConfigs)) {
      fields.push({
        key,
        config,
        value: formData[key],
      });
    }

    // Add any extra fields from prefilled data
    for (const [key, value] of Object.entries(formData)) {
      if (!fieldConfigs[key]) {
        fields.push({
          key,
          config: { ...DEFAULT_FIELD_CONFIG, label: formatFieldName(key) },
          value,
        });
      }
    }

    return fields;
  }, [fieldConfigs, formData]);

  const handleFieldChange = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setCorrections(prev => ({ ...prev, [key]: true }));
  };

  const toggleFieldEdit = (key: string) => {
    setEditingFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    await onConfirm(formData, corrections);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{action.label}</DialogTitle>
          <DialogDescription>
            {action.description || 'Review and confirm the extracted data below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Confidence Badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('gap-1', getConfidenceColor(action.confidence))}
            >
              {action.confidence >= 0.9 ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              {Math.round(action.confidence * 100)}% Confidence
            </Badge>
            {lowConfidenceFields.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {lowConfidenceFields.length} field(s) need review
              </span>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {displayFields.map(({ key, config, value }) => {
              const isLowConfidence = lowConfidenceFields.includes(key);
              const isEditing = editingFields.has(key);

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={key} className="flex items-center gap-1">
                      {config.label}
                      {config.required && <span className="text-destructive">*</span>}
                      {isLowConfidence && (
                        <AlertCircle className="h-3 w-3 text-yellow-500 ml-1" />
                      )}
                    </Label>
                    {!isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleFieldEdit(key)}
                        className="h-6 px-2"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {config.type === 'select' && config.options ? (
                    <Select
                      value={String(value || '')}
                      onValueChange={v => handleFieldChange(key, v)}
                      disabled={!isEditing && !isLowConfidence}
                    >
                      <SelectTrigger
                        className={cn(
                          isLowConfidence && !corrections[key] && 'border-yellow-500'
                        )}
                      >
                        <SelectValue placeholder={`Select ${config.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {config.options.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : config.type === 'checkbox' ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={key}
                        checked={Boolean(value)}
                        onCheckedChange={checked => handleFieldChange(key, checked)}
                        disabled={!isEditing && !isLowConfidence}
                      />
                      <label
                        htmlFor={key}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {Boolean(value) ? 'Yes' : 'No'}
                      </label>
                    </div>
                  ) : (
                    <Input
                      id={key}
                      type={config.type === 'number' ? 'number' : config.type}
                      value={value === null || value === undefined ? '' : String(value)}
                      onChange={e => {
                        const newValue =
                          config.type === 'number'
                            ? parseFloat(e.target.value) || 0
                            : e.target.value;
                        handleFieldChange(key, newValue);
                      }}
                      placeholder={config.placeholder}
                      disabled={!isEditing && !isLowConfidence}
                      className={cn(
                        isLowConfidence && !corrections[key] && 'border-yellow-500'
                      )}
                      step={config.type === 'number' ? '0.01' : undefined}
                    />
                  )}

                  {corrections[key] && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Edit2 className="h-3 w-3" />
                      Modified
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isConfirming}>
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              `Create ${action.action.replace('CREATE_', '')}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
