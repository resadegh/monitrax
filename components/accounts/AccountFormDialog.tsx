'use client';

/**
 * AccountFormDialog — shared create/edit form for Accounts.
 *
 * Phase 1b of the "make /dashboard/accounts redundant" plan.
 *
 * The form, validation, and submit handler are extracted EXACTLY
 * from /dashboard/accounts/page.tsx (the only previous home of this
 * UI). Per user direction (CHANGELOG_2026_04_29): existing logic on
 * the legacy and current pages is correct — Phase 1b is purely
 * visual / flow, no behavioural change to the form, validation, or
 * the API contract.
 *
 * Side-effects the parent must handle through callbacks:
 *   - `onSaved`  — called with the server-returned account after a
 *                  successful create or update so the parent can
 *                  refresh its list.
 *
 * Auth token is consumed via `useAuth()` (same pattern the legacy
 * page used) so callers don't have to thread it through props.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// =============================================================================
// TYPES
// =============================================================================

export type AccountFormType =
  | 'OFFSET'
  | 'SAVINGS'
  | 'TRANSACTIONAL'
  | 'CREDIT_CARD';

/**
 * Subset of Account fields the form edits. Mirrors what
 * `/dashboard/accounts/page.tsx` previously held in `formData`.
 *
 * `interestRate` is the **percentage** (e.g. `2.5` for 2.5% p.a.) —
 * the submit handler divides by 100 before sending to the API,
 * preserving the exact pre-existing contract.
 */
export interface AccountFormValues {
  id?: string; // Present when editing
  name: string;
  type: AccountFormType;
  institution?: string | null;
  currentBalance: number;
  interestRate?: number | null; // PERCENTAGE (e.g. 2.5), not decimal
}

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When provided, the dialog opens in edit mode and pre-populates
   * with these values. When omitted/null, the dialog is in create
   * mode and resets to defaults whenever it opens.
   */
  editing?: AccountFormValues | null;
  /**
   * Called with the server's response after a successful save.
   * Caller is responsible for refreshing its accounts list.
   */
  onSaved?: (account: { id: string; name: string; type: string }) => void;
}

const DEFAULT_VALUES: AccountFormValues = {
  name: '',
  type: 'TRANSACTIONAL',
  institution: '',
  currentBalance: 0,
  interestRate: 0,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function AccountFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: AccountFormDialogProps) {
  const { token } = useAuth();
  const [formData, setFormData] = useState<AccountFormValues>(DEFAULT_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the dialog opens, seeded from `editing` if
  // present. Avoids leaking values between create and edit sessions.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setFormData(
      editing
        ? {
            ...DEFAULT_VALUES,
            ...editing,
            // Server stores interestRate as decimal (e.g. 0.025); the
            // form expects percentage (2.5). Multiply on edit-mode
            // hydration so the user sees the same number they typed.
            // Mirrors what the legacy page did before extraction.
            interestRate:
              typeof editing.interestRate === 'number' && editing.interestRate < 1
                ? editing.interestRate * 100
                : editing.interestRate ?? 0,
          }
        : DEFAULT_VALUES
    );
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const editingId = editing?.id;
      const url = editingId ? `/api/accounts/${editingId}` : '/api/accounts';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        // Body shape matches the legacy /dashboard/accounts page
        // 1:1 — `interestRate / 100` because the form is in % and
        // the server stores decimal. DO NOT change this conversion
        // without coordinating with the API contract.
        body: JSON.stringify({
          ...formData,
          currentBalance: Number(formData.currentBalance),
          interestRate: formData.interestRate
            ? Number(formData.interestRate) / 100
            : null,
          institution: formData.institution || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          typeof errorData.error === 'string'
            ? errorData.error
            : `Failed to save account (${response.status})`
        );
      }

      const saved = await response.json().catch(() => null);
      onSaved?.(
        saved && typeof saved === 'object'
          ? {
              id: saved.id ?? editingId ?? '',
              name: saved.name ?? formData.name,
              type: saved.type ?? formData.type,
            }
          : {
              id: editingId ?? '',
              name: formData.name,
              type: formData.type,
            }
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = !!editing?.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Account' : 'Add New Account'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the account details below.'
              : 'Enter the details for your new account.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="afd-name">Account Name</Label>
            <Input
              id="afd-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Everyday Account"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="afd-type">Account Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) =>
                  setFormData({ ...formData, type: value as AccountFormType })
                }
              >
                <SelectTrigger id="afd-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSACTIONAL">Transactional</SelectItem>
                  <SelectItem value="SAVINGS">Savings</SelectItem>
                  <SelectItem value="OFFSET">Offset</SelectItem>
                  <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="afd-institution">Institution</Label>
              <Input
                id="afd-institution"
                value={formData.institution || ''}
                onChange={(e) =>
                  setFormData({ ...formData, institution: e.target.value })
                }
                placeholder="e.g., CBA, Westpac"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="afd-currentBalance">Current Balance</Label>
              <Input
                id="afd-currentBalance"
                type="number"
                value={formData.currentBalance}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currentBalance: Number(e.target.value),
                  })
                }
                placeholder="10000"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="afd-interestRate">Interest Rate (% p.a.)</Label>
              <Input
                id="afd-interestRate"
                type="number"
                step="0.01"
                value={formData.interestRate || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    interestRate: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="2.5"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
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
                ? 'Update Account'
                : 'Add Account'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AccountFormDialog;
