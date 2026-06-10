'use client';

/**
 * BulkAssignDialog — Phase 47 Stage A3 + A4.
 *
 * "Do any of your existing items belong to {entity}?" — the bulk
 * re-attribution tool for users who set up a structure AFTER years of
 * personal-default data. Lists every owned object (properties, loans,
 * accounts, investment accounts, assets) NOT already owned by the target
 * entity, with checkboxes; submit corrects each selected record via the
 * canonical `PATCH /api/ownership/{type}/{id}` (Q-EOF-1 correction
 * semantics + audit trail per item).
 *
 * A4: the entities page opens this dialog right after a new
 * trust/company/SMSF is created — the moment attribution intent is
 * highest (growth lens). Also reachable any time from the entity row.
 *
 * One surface instead of five list-page multi-selects (Reza cadence
 * decision 2026-06-10 — Stage A in one PR; restraint over sprawl).
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Landmark } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface OwnedItem {
  id: string;
  objectType: 'property' | 'loan' | 'account' | 'investmentAccount' | 'asset';
  name: string;
  ownerEntityId?: string | null;
}

interface BulkAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  entityId: string;
  entityName: string;
  onAssigned?: () => void;
}

const TYPE_LABEL: Record<OwnedItem['objectType'], string> = {
  property: 'Property',
  loan: 'Loan',
  account: 'Account',
  investmentAccount: 'Investment',
  asset: 'Asset',
};

export default function BulkAssignDialog({
  open,
  onOpenChange,
  token,
  entityId,
  entityName,
  onAssigned,
}: BulkAssignDialogProps) {
  const [items, setItems] = useState<OwnedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    setSelected(new Set());
    setError(null);
    const headers = { Authorization: `Bearer ${token}` };
    const unwrap = (r: { data?: unknown } | unknown[]): unknown[] =>
      Array.isArray(r) ? r : ((r as { data?: unknown[] }).data ?? []);
    Promise.all([
      fetch('/api/properties', { headers }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/loans', { headers }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/accounts', { headers }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/investments/accounts', { headers }).then(r => (r.ok ? r.json() : [])),
      fetch('/api/assets', { headers }).then(r => (r.ok ? r.json() : [])),
    ])
      .then(([props, loans, accounts, invests, assets]) => {
        const all: OwnedItem[] = [
          ...unwrap(props).map((p: any) => ({ id: p.id, objectType: 'property' as const, name: p.name, ownerEntityId: p.ownerEntityId })),
          ...unwrap(loans).map((l: any) => ({ id: l.id, objectType: 'loan' as const, name: l.name, ownerEntityId: l.ownerEntityId })),
          ...unwrap(accounts).map((a: any) => ({ id: a.id, objectType: 'account' as const, name: a.name, ownerEntityId: a.ownerEntityId })),
          ...unwrap(invests).map((i: any) => ({ id: i.id, objectType: 'investmentAccount' as const, name: i.name, ownerEntityId: i.ownerEntityId })),
          ...unwrap(assets).map((a: any) => ({ id: a.id, objectType: 'asset' as const, name: a.name, ownerEntityId: a.ownerEntityId })),
        ].filter(i => i.ownerEntityId !== entityId);
        setItems(all);
      })
      .catch(() => setError('Could not load your items.'))
      .finally(() => setLoading(false));
  }, [open, token, entityId]);

  const grouped = useMemo(() => {
    const m = new Map<string, OwnedItem[]>();
    for (const i of items) {
      const arr = m.get(i.objectType) ?? [];
      arr.push(i);
      m.set(i.objectType, arr);
    }
    return m;
  }, [items]);

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const chosen = items.filter(i => selected.has(`${i.objectType}:${i.id}`));
      for (const item of chosen) {
        const response = await fetch(`/api/ownership/${item.objectType}/${item.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ownership: { mode: 'entity', entityId },
            reason: `Bulk assignment to ${entityName}`,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `Failed on ${item.name}`);
        }
      }
      onOpenChange(false);
      onAssigned?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
              <Landmark size={18} strokeWidth={1.8} />
            </span>
            <DialogTitle>Does {entityName} own any of these?</DialogTitle>
          </div>
          <DialogDescription>
            Pick the items that belong to {entityName} — this corrects their ownership records
            in one pass. It does not transfer anything.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading your items…</div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Everything is already attributed — nothing to assign.
          </div>
        ) : (
          <div className="space-y-4">
            {[...grouped.entries()].map(([type, group]) => (
              <div key={type}>
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {TYPE_LABEL[type as OwnedItem['objectType']]}
                  {group.length === 1 ? '' : 's'}
                </div>
                <div className="space-y-1">
                  {group.map(item => {
                    const key = `${item.objectType}:${item.id}`;
                    const isSel = selected.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggle(key)}
                        className={`flex w-full items-center justify-between rounded-[12px] border px-3 py-2 text-left text-sm transition ${
                          isSel
                            ? 'border-sky-400 bg-sky-50/50 ring-1 ring-sky-400/50'
                            : 'border-foreground/10 hover:border-sky-300/60'
                        }`}
                      >
                        <span>{item.name}</span>
                        {isSel && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <div className="text-xs text-red-600">{error}</div>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Not now
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selected.size === 0}
            className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:from-sky-600 hover:to-indigo-600"
          >
            {submitting
              ? 'Assigning…'
              : `Assign ${selected.size > 0 ? selected.size : ''} item${selected.size === 1 ? '' : 's'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
