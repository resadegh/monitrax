'use client';

/**
 * Phase 44 Part 1c — joint-ownership manager (Q1, deliverable 5).
 *
 * Records joint / shared ownership of an owned object (a property, loan,
 * account, investment account or asset) via `OwnershipGroup` +
 * `OwnershipStake` (PHASE_44_ENTITY_GRAPH.md §7, Q1).
 *
 * The §3A correctness point this UI exists to get right:
 *  - JOINT TENANCY carries the right of survivorship — it is NOT
 *    fractional ownership. The shares are reporting-only; on death the
 *    interest passes by survivorship, not through the estate.
 *  - TENANTS IN COMMON is fixed fractional ownership — every co-owner's
 *    share is a defined percentage and they should sum to 100%.
 *
 * Writes go through `/api/entities/ownership-groups*` →
 * `ownershipService` (the only writer, §8.4). No tax arithmetic (§8.3).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Users,
  CircleSlash,
} from 'lucide-react';
import type { TenancyType } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { extractApiError } from './canvas/entityGraphClient';

// =============================================================================
// TYPES
// =============================================================================

interface EntityOption {
  id: string;
  name: string;
}

type OwnedObjectType = 'property' | 'loan' | 'account' | 'investmentAccount' | 'asset';

const OWNED_OBJECT_TYPES: ReadonlyArray<{ value: OwnedObjectType; label: string; endpoint: string }> = [
  { value: 'property', label: 'Property', endpoint: '/api/properties' },
  { value: 'loan', label: 'Loan', endpoint: '/api/loans' },
  { value: 'account', label: 'Account', endpoint: '/api/accounts' },
  { value: 'investmentAccount', label: 'Investment account', endpoint: '/api/investments/accounts' },
  { value: 'asset', label: 'Asset', endpoint: '/api/assets' },
];

// The joint-ownership cases — SOLE needs no group (that is just
// `ownerEntityId`), so the picker offers the multi-owner tenancy types.
const TENANCY_OPTIONS: ReadonlyArray<{ value: TenancyType; label: string; blurb: string }> = [
  {
    value: 'JOINT_TENANTS',
    label: 'Joint tenants',
    blurb: 'Right of survivorship — the interest passes to the survivor, not through the estate.',
  },
  {
    value: 'TENANTS_IN_COMMON',
    label: 'Tenants in common',
    blurb: 'Fixed fractional ownership — each co-owner holds a defined share that sums to 100%.',
  },
  { value: 'OTHER', label: 'Other', blurb: 'An ownership arrangement outside the two standard forms.' },
];

interface OwnedObject {
  id: string;
  label: string;
}

interface OwnershipGroupRow {
  id: string;
  ownedObjectType: string;
  ownedObjectId: string;
  tenancyType: TenancyType;
  effectiveFrom: string;
  effectiveTo: string | null;
  stakes: { id: string; entityId: string; entityName: string; sharePct: number | null }[];
}

interface StakeDraft {
  entityId: string;
  sharePct: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Best-effort display label for an owned object across the five list shapes. */
function ownedObjectLabel(raw: Record<string, unknown>): string {
  const keys = ['name', 'address', 'nickname', 'label', 'lender', 'institution', 'description'];
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  const id = typeof raw.id === 'string' ? raw.id : '';
  return id ? `Item ${id.slice(0, 8)}` : 'Unnamed item';
}

// =============================================================================
// COMPONENT
// =============================================================================

interface OwnershipGroupsDialogProps {
  open: boolean;
  onClose: () => void;
  token: string;
  entities: EntityOption[];
}

export function OwnershipGroupsDialog({
  open,
  onClose,
  token,
  entities,
}: OwnershipGroupsDialogProps) {
  const [groups, setGroups] = useState<OwnershipGroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Add form.
  const [adding, setAdding] = useState(false);
  const [objectType, setObjectType] = useState<OwnedObjectType>('property');
  const [objects, setObjects] = useState<OwnedObject[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [objectId, setObjectId] = useState('');
  const [tenancyType, setTenancyType] = useState<TenancyType>('JOINT_TENANTS');
  const [stakes, setStakes] = useState<StakeDraft[]>([
    { entityId: '', sharePct: '' },
    { entityId: '', sharePct: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/entities/ownership-groups', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(extractApiError(body, res.status, 'Failed to load ownership groups.'));
      }
      const json = (await res.json()) as { data?: OwnershipGroupRow[] };
      setGroups(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) loadGroups();
  }, [open, loadGroups]);

  // Fetch the owned objects whenever the selected type changes.
  useEffect(() => {
    if (!adding || !token) return;
    const cfg = OWNED_OBJECT_TYPES.find((t) => t.value === objectType);
    if (!cfg) return;
    setObjectsLoading(true);
    setObjectId('');
    fetch(cfg.endpoint, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error('Could not load that list.');
        const json = (await res.json()) as { data?: Record<string, unknown>[] };
        const list = Array.isArray(json.data) ? json.data : [];
        setObjects(
          list
            .filter((o) => typeof o.id === 'string')
            .map((o) => ({ id: o.id as string, label: ownedObjectLabel(o) })),
        );
      })
      .catch(() => setObjects([]))
      .finally(() => setObjectsLoading(false));
  }, [adding, objectType, token]);

  const resetForm = () => {
    setObjectType('property');
    setObjectId('');
    setTenancyType('JOINT_TENANTS');
    setStakes([
      { entityId: '', sharePct: '' },
      { entityId: '', sharePct: '' },
    ]);
    setError(null);
  };

  const shareSum = stakes.reduce((acc, s) => acc + (parseFloat(s.sharePct) || 0), 0);

  const handleCreate = async () => {
    if (!objectId) {
      setError('Choose the owned object this group applies to.');
      return;
    }
    const filledStakes = stakes.filter((s) => s.entityId);
    if (filledStakes.length < 2) {
      setError('A joint-ownership group needs at least two co-owners.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/entities/ownership-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ownedObjectType: objectType,
          ownedObjectId: objectId,
          tenancyType,
          stakes: filledStakes.map((s) => ({
            entityId: s.entityId,
            sharePct:
              tenancyType === 'TENANTS_IN_COMMON' && s.sharePct
                ? parseFloat(s.sharePct)
                : null,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(extractApiError(body, res.status, 'Failed to create the ownership group.'));
      }
      resetForm();
      setAdding(false);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/entities/ownership-groups/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(extractApiError(body, res.status, 'Failed to delete the ownership group.'));
      }
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  };

  const handleEnd = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/entities/ownership-groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ effectiveTo: new Date().toISOString() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(extractApiError(body, res.status, 'Failed to end the ownership group.'));
      }
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBusyId(null);
    }
  };

  const activeTenancy = TENANCY_OPTIONS.find((t) => t.value === tenancyType);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-500" />
            Joint ownership
          </DialogTitle>
          <DialogDescription>
            Record which properties, loans, accounts and assets are co-owned — and on what
            terms. Joint tenancy carries survivorship; tenants in common hold fixed shares.
          </DialogDescription>
        </DialogHeader>

        {/* Existing groups */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          </div>
        ) : groups.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs italic text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            No joint-ownership groups recorded yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {groups.map((g) => {
              const tenancy = TENANCY_OPTIONS.find((t) => t.value === g.tenancyType);
              const ended = g.effectiveTo !== null;
              return (
                <li
                  key={g.id}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    ended
                      ? 'border-slate-200/60 bg-slate-50/60 opacity-70 dark:border-slate-800 dark:bg-slate-900/40'
                      : 'border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium capitalize text-slate-700 dark:text-slate-200">
                      {g.ownedObjectType} · {tenancy?.label ?? g.tenancyType}
                    </span>
                    <div className="flex items-center gap-1">
                      {!ended && (
                        <button
                          type="button"
                          title="End this ownership group"
                          disabled={busyId === g.id}
                          onClick={() => handleEnd(g.id)}
                          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                        >
                          {busyId === g.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CircleSlash className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        title="Delete this ownership group"
                        disabled={busyId === g.id}
                        onClick={() => handleDelete(g.id)}
                        className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {g.stakes.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {s.entityName}
                        {s.sharePct !== null && ` · ${s.sharePct}%`}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add form */}
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Record joint ownership
          </Button>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/50">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="own-type">What is co-owned?</Label>
                <Select value={objectType} onValueChange={(v) => setObjectType(v as OwnedObjectType)}>
                  <SelectTrigger id="own-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OWNED_OBJECT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="own-object">Which one?</Label>
                <Select value={objectId} onValueChange={setObjectId} disabled={objectsLoading}>
                  <SelectTrigger id="own-object">
                    <SelectValue placeholder={objectsLoading ? 'Loading…' : 'Choose'} />
                  </SelectTrigger>
                  <SelectContent>
                    {objects.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!objectsLoading && objects.length === 0 && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    No items of this type to co-own yet.
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="own-tenancy">Tenancy type</Label>
              <Select value={tenancyType} onValueChange={(v) => setTenancyType(v as TenancyType)}>
                <SelectTrigger id="own-tenancy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TENANCY_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeTenancy && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {activeTenancy.blurb}
                </p>
              )}
            </div>

            {/* Stakes */}
            <div className="space-y-1.5">
              <Label>Co-owners</Label>
              {stakes.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Select
                    value={s.entityId}
                    onValueChange={(v) =>
                      setStakes((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, entityId: v } : x)),
                      )
                    }
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose an owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {entities.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tenancyType === 'TENANTS_IN_COMMON' && (
                    <div className="flex w-20 items-center gap-0.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={s.sharePct}
                        onChange={(e) =>
                          setStakes((prev) =>
                            prev.map((x, j) =>
                              j === i ? { ...x, sharePct: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder="%"
                      />
                      <span className="text-xs text-slate-400">%</span>
                    </div>
                  )}
                  {stakes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setStakes((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                      title="Remove this co-owner"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStakes((prev) => [...prev, { entityId: '', sharePct: '' }])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                >
                  <Plus className="h-3 w-3" />
                  Add co-owner
                </button>
                {tenancyType === 'TENANTS_IN_COMMON' && (
                  <span
                    className={`text-xs ${
                      Math.abs(shareSum - 100) < 0.01
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    Shares total {shareSum}%
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetForm();
                  setAdding(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                )}
                Record ownership
              </Button>
            </div>
          </div>
        )}

        {error && !adding && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
