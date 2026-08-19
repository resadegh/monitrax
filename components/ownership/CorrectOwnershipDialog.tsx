'use client';

/**
 * CorrectOwnershipDialog — Phase 47 Stage A2.
 *
 * The "Correct ownership record" flow: re-attribute an existing item's
 * legal title (and co-ownership records) when the original entry was
 * WRONG. Q-EOF-1 semantics are enforced in copy and service alike —
 * this is a record correction, NEVER a transfer affordance (a real
 * transfer is a disposal + acquisition with CGT/duty consequences; the
 * amber notice carries that warning verbatim, the only amber on the
 * surface — genuine caution per §18.7.2 money-signal rules).
 *
 * Reuses the canonical OwnershipPicker for the choice grid; adds the
 * reason field + notice + submit to `PATCH /api/ownership/{type}/{id}`
 * (canonical writer: ownershipSelectionService.correctOwnershipRecord —
 * §12.11 checklist documented there).
 *
 * Design SoT (§18.4): Stitch screen `ce11109f00f54b989dff74e9af18f1fa`,
 * `.stitch/designs/phase47/correct-ownership-record-v1.{html,png}`
 * (project `1859462351962811110`).
 */

import { useState } from 'react';
import { AlertTriangle, PenLine } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useModuleEnabled } from '@/lib/featureFlags/ModuleGateContext';
import OwnershipPicker, {
  type OwnershipSelectionValue,
} from '@/components/ownership/OwnershipPicker';

interface CorrectOwnershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  /** API object type segment: property / loan / account / investmentAccount / asset */
  objectType: string;
  objectId: string;
  /** Display name, e.g. "903 Boree Rd". */
  objectName: string;
  /** Called after a successful correction (refresh your list). */
  onCorrected?: () => void;
}

export default function CorrectOwnershipDialog({
  open,
  onOpenChange,
  token,
  objectType,
  objectId,
  objectName,
  onCorrected,
}: CorrectOwnershipDialogProps) {
  // PROD Simplification P2.4 (D-6): with MODULE_ENTITIES off the picker
  // renders nothing, so this dialog could only ever submit `sole` — which
  // would OVERWRITE existing joint/shared/entity attribution. That write
  // path is blocked entirely: the form is replaced by a notice and the
  // submit button is not rendered. Existing attribution stays untouched.
  const entitiesModuleEnabled = useModuleEnabled('MODULE_ENTITIES');
  const [ownership, setOwnership] = useState<OwnershipSelectionValue>({ mode: 'sole' });
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/ownership/${objectType}/${objectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ownership, reason }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `Correction failed (${response.status})`);
      }
      onOpenChange(false);
      setReason('');
      setOwnership({ mode: 'sole' });
      onCorrected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correction failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
              <PenLine size={18} strokeWidth={1.8} />
            </span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-600">
                Ownership record
              </div>
              <DialogTitle>Correct ownership record</DialogTitle>
            </div>
          </div>
          <DialogDescription>{objectName} — who should this be recorded under?</DialogDescription>
        </DialogHeader>

        {!entitiesModuleEnabled ? (
          <div className="rounded-[14px] border border-foreground/10 bg-background/50 p-4 text-sm text-muted-foreground">
            Ownership editing isn&apos;t available right now. This record is unchanged —
            everything stays exactly as it was captured.
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <OwnershipPicker token={token} value={ownership} onChange={setOwnership} />

          <div className="space-y-2">
            <Label htmlFor="correction-reason">Why are you correcting this?</Label>
            <Input
              id="correction-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. The trust has always been on the title — I entered it wrong"
            />
          </div>

          {/* Q-EOF-1 — the correction-≠-transfer warning. Amber = genuine
              caution; the only amber on this surface. */}
          <div className="flex items-start gap-2 rounded-[14px] border border-amber-300/60 bg-amber-50/50 p-3 text-xs leading-relaxed text-amber-900">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" strokeWidth={1.8} />
            <span>
              This corrects the record — it does not transfer the asset. Actually moving an
              asset between owners is a sale and purchase with tax and duty consequences. If
              ownership really changed, talk to your accountant before updating Monitrax.
            </span>
          </div>

          {error && <div className="text-xs text-red-600">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-600 hover:to-indigo-600"
            >
              {submitting ? 'Saving…' : 'Correct the record'}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
