'use client';

/**
 * LoanFormDialog — shared create/edit form for Loans.
 *
 * Phase 1b of the "make /dashboard/accounts and /dashboard/loans
 * redundant" plan. Lifted from /dashboard/loans/page.tsx so the
 * same form can open inline on /dashboard/balances when the user
 * clicks "+ Loan".
 *
 * Per user direction (CHANGELOG_2026_04_29): existing logic on the
 * legacy and current pages is correct — Phase 1b is purely visual /
 * flow. Form fields, validation, submit body shape, and the
 * post-save document-linking call are preserved EXACTLY. No
 * calculation changes, no API contract changes.
 *
 * The shared component owns its own form state (`formData`,
 * `attachedDocumentId`, `autoFilledFields`). Callers supply the
 * lookup lists (properties, accounts, all-accounts, assets) so the
 * conditional linking selects can populate, plus an `onSaved`
 * callback so the parent can refresh.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import OwnershipPicker, {
  type OwnershipSelectionValue,
} from '@/components/ownership/OwnershipPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormDocumentUpload, FieldMapping } from '@/components/documents';
import { formatCurrency } from '@/lib/utils/formatters';

// =============================================================================
// TYPES
// =============================================================================

export type LoanFormType =
  | 'HOME'
  | 'INVESTMENT'
  | 'CAR'
  | 'PERSONAL'
  | 'LINE_OF_CREDIT'
  | 'STUDENT'
  | 'BUSINESS';

export type LoanFormRateType = 'FIXED' | 'VARIABLE';
export type LoanFormFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';

/**
 * Subset of Loan fields the form edits. Mirrors what
 * `/dashboard/loans/page.tsx` previously held in `formData`.
 *
 * `interestRateAnnual` is the **decimal** (e.g. `0.0625` for 6.25%)
 * — the form's input is in % and divides by 100 on display, mirroring
 * the legacy contract.
 */
export interface LoanFormValues {
  id?: string; // Present when editing
  name?: string;
  type?: LoanFormType;
  principal?: number;
  interestRateAnnual?: number; // DECIMAL (e.g. 0.0625 for 6.25%)
  rateType?: LoanFormRateType;
  isInterestOnly?: boolean;
  termMonthsRemaining?: number;
  minRepayment?: number;
  repaymentFrequency?: LoanFormFrequency;
  fixedExpiry?: string | null;
  extraRepaymentCap?: number | null;
  propertyId?: string | null;
  offsetAccountId?: string | null;
  linkedAssetId?: string | null;
  linkedAccountId?: string | null;
}

export interface LoanFormPropertyOption {
  id: string;
  name: string;
}

export interface LoanFormAccountOption {
  id: string;
  name: string;
  type?: string;
  currentBalance: number;
}

export interface LoanFormAssetOption {
  id: string;
  name: string;
  currentValue: number;
  vehicleMake?: string;
  vehicleModel?: string;
}

interface LoanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-populated values for edit mode. Null/undefined = create mode. */
  editing?: LoanFormValues | null;
  /** Properties available for HOME / INVESTMENT / BUSINESS linking. */
  properties?: LoanFormPropertyOption[];
  /** Accounts available for offset linking on HOME / INVESTMENT loans. */
  offsetAccounts?: LoanFormAccountOption[];
  /** All accounts (incl. credit cards) for LINE_OF_CREDIT linking. */
  allAccounts?: LoanFormAccountOption[];
  /** Vehicle assets for CAR loan linking. */
  assets?: LoanFormAssetOption[];
  /** Called after a successful save (create or update). */
  onSaved?: (loan: { id: string; name?: string; type?: string }) => void;
}

const DEFAULT_VALUES: LoanFormValues = {
  name: '',
  type: 'HOME',
  principal: 0,
  interestRateAnnual: 0,
  rateType: 'VARIABLE',
  isInterestOnly: false,
  termMonthsRemaining: 360,
  minRepayment: 0,
  repaymentFrequency: 'MONTHLY',
  fixedExpiry: undefined,
  extraRepaymentCap: undefined,
  propertyId: undefined,
  offsetAccountId: undefined,
  linkedAssetId: undefined,
  linkedAccountId: undefined,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function LoanFormDialog({
  open,
  onOpenChange,
  editing,
  properties = [],
  offsetAccounts = [],
  allAccounts = [],
  assets = [],
  onSaved,
}: LoanFormDialogProps) {
  const { token } = useAuth();
  const [formData, setFormData] = useState<LoanFormValues>(DEFAULT_VALUES);
  // Phase 47 Stage A — ownership selection (create only; edits go through
  // the "correct ownership record" flow, Stage A2).
  const [ownership, setOwnership] = useState<OwnershipSelectionValue>({ mode: 'sole' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedDocumentId, setAttachedDocumentId] = useState<string | null>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<string[]>([]);

  // Reset form state whenever the dialog opens, seeded from `editing`.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setAttachedDocumentId(null);
    setAutoFilledFields([]);
    setFormData(editing ? { ...DEFAULT_VALUES, ...editing } : DEFAULT_VALUES);
    setOwnership({ mode: 'sole' });
  }, [open, editing]);

  // Auto-fill handler for FormDocumentUpload — preserved EXACTLY
  // from the legacy /dashboard/loans/page.tsx implementation.
  const handleFieldsExtracted = (mappings: Record<string, FieldMapping>) => {
    const filledFields: string[] = [];
    const updates: Partial<LoanFormValues> = {};

    if (mappings.lender?.value && !formData.name) {
      updates.name = String(mappings.lender.value);
      filledFields.push('name');
    }

    if (mappings.principalAmount?.value && !formData.principal) {
      updates.principal = Number(mappings.principalAmount.value);
      filledFields.push('principal');
    }

    if (mappings.interestRate?.value && !formData.interestRateAnnual) {
      const rate = Number(mappings.interestRate.value);
      // Convert percentage to decimal if needed
      updates.interestRateAnnual = rate > 1 ? rate / 100 : rate;
      filledFields.push('interestRateAnnual');
    }

    if (mappings.loanTerm?.value && !formData.termMonthsRemaining) {
      updates.termMonthsRemaining = Number(mappings.loanTerm.value);
      filledFields.push('termMonthsRemaining');
    }

    if (mappings.repaymentAmount?.value && !formData.minRepayment) {
      updates.minRepayment = Number(mappings.repaymentAmount.value);
      filledFields.push('minRepayment');
    }

    if (mappings.accountNumber?.value) {
      filledFields.push('accountNumber');
    }

    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({ ...prev, ...updates }));
      setAutoFilledFields(filledFields);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const editingId = editing?.id;
      const url = editingId ? `/api/loans/${editingId}` : '/api/loans';
      const method = editingId ? 'PUT' : 'POST';

      // Body shape preserved EXACTLY from the legacy /dashboard/loans
      // page. Empty/falsy reference fields are coerced to null so
      // Prisma drops the relation rather than rejecting on an empty
      // string FK.
      const submitData = {
        ...formData,
        principal: Number(formData.principal),
        interestRateAnnual: Number(formData.interestRateAnnual),
        termMonthsRemaining: Number(formData.termMonthsRemaining),
        minRepayment: Number(formData.minRepayment),
        fixedExpiry: formData.fixedExpiry || null,
        extraRepaymentCap: formData.extraRepaymentCap
          ? Number(formData.extraRepaymentCap)
          : null,
        propertyId: formData.propertyId || null,
        offsetAccountId: formData.offsetAccountId || null,
        linkedAssetId: formData.linkedAssetId || null,
        linkedAccountId: formData.linkedAccountId || null,
        // Phase 47 Stage A — ownership only applies at creation.
        ...(editingId ? {} : { ownership }),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          typeof errorData.error === 'string'
            ? errorData.error
            : `Failed to save loan (${response.status})`
        );
      }

      const result = await response.json().catch(() => null);
      const savedLoanId =
        result?.data?.id || result?.id || editingId || '';

      // Phase 19: link the auto-fill source document to the
      // resulting loan. Best-effort — failure is logged but the
      // save itself is considered successful (matches legacy
      // behaviour).
      if (attachedDocumentId && savedLoanId) {
        try {
          await fetch(`/api/documents/${attachedDocumentId}/link`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              entityType: 'LOAN',
              entityId: savedLoanId,
            }),
          });
        } catch (linkError) {
          console.error('Error linking document to loan:', linkError);
        }
      }

      onSaved?.({
        id: savedLoanId,
        name: formData.name,
        type: formData.type,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save loan');
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = !!editing?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Loan' : 'Add New Loan'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the loan details below.'
              : 'Enter the details for your new loan.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Document Auto-Fill (Phase 19) */}
          <FormDocumentUpload
            formType="loan"
            propertyId={formData.propertyId || undefined}
            onFieldsExtracted={handleFieldsExtracted}
            onDocumentAttached={setAttachedDocumentId}
            disabled={submitting}
          />
          {autoFilledFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Auto-filled {autoFilledFields.length} field(s). Review and adjust if needed.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lfd-name">Loan Name</Label>
              <Input
                id="lfd-name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Home Loan"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lfd-type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    type: value as LoanFormType,
                    propertyId: undefined,
                    linkedAssetId: undefined,
                    linkedAccountId: undefined,
                  })
                }
              >
                <SelectTrigger id="lfd-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOME">Home Loan</SelectItem>
                  <SelectItem value="INVESTMENT">Investment Loan</SelectItem>
                  <SelectItem value="CAR">Car Loan</SelectItem>
                  <SelectItem value="PERSONAL">Personal Loan</SelectItem>
                  <SelectItem value="LINE_OF_CREDIT">Line of Credit</SelectItem>
                  <SelectItem value="STUDENT">Student / HECS-HELP</SelectItem>
                  <SelectItem value="BUSINESS">Business Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lfd-principal">Principal Balance</Label>
              <Input
                id="lfd-principal"
                type="number"
                value={formData.principal}
                onChange={(e) =>
                  setFormData({ ...formData, principal: Number(e.target.value) })
                }
                placeholder="400000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lfd-interestRateAnnual">Annual Interest Rate (%)</Label>
              <Input
                id="lfd-interestRateAnnual"
                type="number"
                step="0.01"
                value={(formData.interestRateAnnual || 0) * 100}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    interestRateAnnual: Number(e.target.value) / 100,
                  })
                }
                placeholder="6.25"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lfd-rateType">Rate Type</Label>
              <Select
                value={formData.rateType}
                onValueChange={(value) =>
                  setFormData({ ...formData, rateType: value as LoanFormRateType })
                }
              >
                <SelectTrigger id="lfd-rateType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VARIABLE">Variable</SelectItem>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interest-only option only for HOME, INVESTMENT, LINE_OF_CREDIT, BUSINESS loans */}
            {(formData.type === 'HOME' ||
              formData.type === 'INVESTMENT' ||
              formData.type === 'LINE_OF_CREDIT' ||
              formData.type === 'BUSINESS') ? (
              <div className="space-y-2">
                <Label htmlFor="lfd-isInterestOnly">Repayment Type</Label>
                <Select
                  value={formData.isInterestOnly ? 'true' : 'false'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, isInterestOnly: value === 'true' })
                  }
                >
                  <SelectTrigger id="lfd-isInterestOnly">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">Principal & Interest</SelectItem>
                    <SelectItem value="true">Interest Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Repayment Type</Label>
                <div className="h-10 flex items-center text-sm text-muted-foreground">
                  Principal & Interest (standard for {formData.type?.toLowerCase().replace('_', ' ')} loans)
                </div>
              </div>
            )}
          </div>

          {formData.rateType === 'FIXED' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lfd-fixedExpiry">Fixed Rate Expiry</Label>
                <Input
                  id="lfd-fixedExpiry"
                  type="date"
                  value={formData.fixedExpiry ? formData.fixedExpiry.split('T')[0] : ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fixedExpiry: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : undefined,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lfd-extraRepaymentCap">Extra Repayment Cap (Annual)</Label>
                <Input
                  id="lfd-extraRepaymentCap"
                  type="number"
                  value={formData.extraRepaymentCap || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      extraRepaymentCap: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                  placeholder="e.g., 10000"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lfd-termMonthsRemaining">Term Remaining (months)</Label>
              <Input
                id="lfd-termMonthsRemaining"
                type="number"
                value={formData.termMonthsRemaining}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    termMonthsRemaining: Number(e.target.value),
                  })
                }
                placeholder="300"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lfd-minRepayment">Minimum Repayment</Label>
              <Input
                id="lfd-minRepayment"
                type="number"
                value={formData.minRepayment}
                onChange={(e) =>
                  setFormData({ ...formData, minRepayment: Number(e.target.value) })
                }
                placeholder="2500"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lfd-repaymentFrequency">Repayment Frequency</Label>
            <Select
              value={formData.repaymentFrequency}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  repaymentFrequency: value as LoanFormFrequency,
                })
              }
            >
              <SelectTrigger id="lfd-repaymentFrequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional Linking Section based on Loan Type */}
          {(formData.type === 'HOME' || formData.type === 'INVESTMENT') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lfd-propertyId">Linked Property (Optional)</Label>
                <Select
                  value={formData.propertyId || 'none'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      propertyId: value === 'none' ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger id="lfd-propertyId">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lfd-offsetAccountId">Offset Account (Optional)</Label>
                <Select
                  value={formData.offsetAccountId || 'none'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      offsetAccountId: value === 'none' ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger id="lfd-offsetAccountId">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {offsetAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.currentBalance)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* CAR Loan - Link to Vehicle Asset */}
          {formData.type === 'CAR' && (
            <div className="space-y-2">
              <Label htmlFor="lfd-linkedAssetId">Linked Vehicle (Optional)</Label>
              <Select
                value={formData.linkedAssetId || 'none'}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    linkedAssetId: value === 'none' ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="lfd-linkedAssetId">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {assets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name}
                      {asset.vehicleMake && asset.vehicleModel
                        ? ` (${asset.vehicleMake} ${asset.vehicleModel})`
                        : ''}{' '}
                      - {formatCurrency(asset.currentValue)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No vehicles found. Add a vehicle in Assets first to link it.
                </p>
              )}
            </div>
          )}

          {/* LINE_OF_CREDIT - Link to Account (e.g., credit card) */}
          {formData.type === 'LINE_OF_CREDIT' && (
            <div className="space-y-2">
              <Label htmlFor="lfd-linkedAccountId">Linked Account (Optional)</Label>
              <Select
                value={formData.linkedAccountId || 'none'}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    linkedAccountId: value === 'none' ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="lfd-linkedAccountId">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {allAccounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type ?? '—'}) - {formatCurrency(acc.currentBalance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* BUSINESS Loan - May link to property for secured loans */}
          {formData.type === 'BUSINESS' && properties.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="lfd-businessPropertyId">Secured by Property (Optional)</Label>
              <Select
                value={formData.propertyId || 'none'}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    propertyId: value === 'none' ? undefined : value,
                  })
                }
              >
                <SelectTrigger id="lfd-businessPropertyId">
                  <SelectValue placeholder="None (Unsecured)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Unsecured)</SelectItem>
                  {properties.map((prop) => (
                    <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          {/* Phase 47 Stage A — ownership picker (creation only). */}
          {!isEditing && (
            <OwnershipPicker token={token} value={ownership} onChange={setOwnership} />
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? 'Saving…'
                : isEditing
                ? 'Update Loan'
                : 'Add Loan'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LoanFormDialog;
