'use client';

/**
 * /dashboard/entities — Phase 41b "My Structure"
 *
 * Standalone entity-management surface for existing users. Sits under
 * My Accounts in the TRACK stage (CLAUDE.md §14.2) — entities are the
 * foundation of "what you own."
 *
 * Behaviour-psychology lens (CLAUDE.md §0): page leads with the user's
 * current structure (cards), normalises that "most wealth-builders have
 * just their personal name at first," and presents adding a Trust /
 * SMSF / Pty Ltd as a one-tap affordance — never an obligation.
 *
 * SSOT: this page is purely presentational. All read/write logic flows
 * through `/api/entities` → `lib/services/legalEntityService.ts`. No
 * direct Prisma calls, no inline tax math.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Crown,
  Landmark,
  Users,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  ShieldCheck,
  Lock,
  Loader2,
  Sparkles,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  isValidAbn,
  isValidAcn,
  isValidTfnFormat,
  formatAbn,
  formatAcn,
} from '@/lib/utils/auValidators';

// =============================================================================
// LOCAL TYPES — mirror the LegalEntitySummary shape from the service
// =============================================================================

type LegalEntityType =
  | 'PERSONAL_NAME'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST'
  | 'SMSF'
  | 'PARTNERSHIP'
  | 'SOLE_TRADER';

type LegalEntityRole =
  | 'PERSONAL'
  | 'HOLDING'
  | 'OPERATING'
  | 'INVESTMENT'
  | 'SUPERANNUATION';

const TYPE_LABELS: Record<LegalEntityType, string> = {
  PERSONAL_NAME: 'My personal name',
  COMPANY: 'Company (Pty Ltd)',
  DISCRETIONARY_TRUST: 'Discretionary / family trust',
  UNIT_TRUST: 'Unit trust',
  SMSF: 'Self-Managed Super Fund',
  PARTNERSHIP: 'Partnership',
  SOLE_TRADER: 'Sole trader',
};

const ROLE_LABELS: Record<LegalEntityRole, string> = {
  PERSONAL: 'Personal',
  HOLDING: 'Holding',
  OPERATING: 'Operating',
  INVESTMENT: 'Investment',
  SUPERANNUATION: 'Superannuation',
};

interface OwnedObjectsCount {
  properties: number;
  loans: number;
  accounts: number;
  investmentAccounts: number;
  assets: number;
  incomes: number;
  expenses: number;
  total: number;
}

interface Entity {
  id: string;
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  abn: string | null;
  acn: string | null;
  hasTfn: boolean;
  tradingName: string | null;
  establishedDate: string | null;
  parentEntityId: string | null;
  parentEntityName: string | null;
  ownedObjectsCount: OwnedObjectsCount;
}

interface FormState {
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  abn: string;
  acn: string;
  tradingName: string;
  establishedDate: string;
  parentEntityId: string;
  collectsTfn: boolean;
  tfn: string;
  tfnTouched: boolean;   // true once user has typed in the TFN field on edit (otherwise PUT keeps the existing value)
}

const TYPES: LegalEntityType[] = [
  'PERSONAL_NAME',
  'COMPANY',
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
  'SMSF',
  'PARTNERSHIP',
  'SOLE_TRADER',
];

const ROLES: LegalEntityRole[] = [
  'PERSONAL',
  'HOLDING',
  'OPERATING',
  'INVESTMENT',
  'SUPERANNUATION',
];

function defaultRoleForType(type: LegalEntityType): LegalEntityRole {
  switch (type) {
    case 'PERSONAL_NAME':
      return 'PERSONAL';
    case 'SMSF':
      return 'SUPERANNUATION';
    case 'COMPANY':
    case 'SOLE_TRADER':
    case 'PARTNERSHIP':
      return 'OPERATING';
    case 'DISCRETIONARY_TRUST':
    case 'UNIT_TRUST':
      return 'HOLDING';
    default:
      return 'PERSONAL';
  }
}

function fieldApplicability(type: LegalEntityType) {
  switch (type) {
    case 'PERSONAL_NAME':
      return { abn: false, acn: false, tfn: true };
    case 'COMPANY':
      return { abn: true, acn: true, tfn: true };
    case 'DISCRETIONARY_TRUST':
    case 'UNIT_TRUST':
    case 'SMSF':
    case 'PARTNERSHIP':
    case 'SOLE_TRADER':
      return { abn: true, acn: false, tfn: true };
    default:
      return { abn: true, acn: true, tfn: true };
  }
}

function entityIcon(type: LegalEntityType) {
  switch (type) {
    case 'PERSONAL_NAME':
      return <Users className="h-5 w-5" />;
    case 'COMPANY':
    case 'SOLE_TRADER':
    case 'PARTNERSHIP':
      return <Building2 className="h-5 w-5" />;
    case 'DISCRETIONARY_TRUST':
    case 'UNIT_TRUST':
      return <Crown className="h-5 w-5" />;
    case 'SMSF':
      return <Landmark className="h-5 w-5" />;
    default:
      return <Building2 className="h-5 w-5" />;
  }
}

function emptyForm(): FormState {
  return {
    name: '',
    type: 'DISCRETIONARY_TRUST',
    role: 'HOLDING',
    abn: '',
    acn: '',
    tradingName: '',
    establishedDate: '',
    parentEntityId: '',
    collectsTfn: false,
    tfn: '',
    tfnTouched: false,
  };
}

function formFromEntity(e: Entity): FormState {
  return {
    name: e.name,
    type: e.type,
    role: e.role,
    abn: e.abn ?? '',
    acn: e.acn ?? '',
    tradingName: e.tradingName ?? '',
    establishedDate: e.establishedDate ? e.establishedDate.split('T')[0] : '',
    parentEntityId: e.parentEntityId ?? '',
    collectsTfn: e.hasTfn,
    tfn: '',
    tfnTouched: false,
  };
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function EntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<Entity | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/entities');
      if (!res.ok) throw new Error('Failed to load entities');
      const json = await res.json();
      setEntities(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setSaveError(null);
    setFormOpen(true);
  };

  const openEdit = (entity: Entity) => {
    setEditing(entity);
    setForm(formFromEntity(entity));
    setSaveError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setSaveError(null);
  };

  const handleTypeChange = (type: LegalEntityType) => {
    setForm({ ...form, type, role: defaultRoleForType(type) });
  };

  const applicable = fieldApplicability(form.type);
  const abnValid =
    !applicable.abn || !form.abn || isValidAbn(form.abn);
  const acnValid =
    !applicable.acn || !form.acn || isValidAcn(form.acn);
  const tfnValid =
    !form.collectsTfn || !form.tfn || isValidTfnFormat(form.tfn);
  const nameValid = form.name.trim().length > 0;
  const canSave = nameValid && abnValid && acnValid && tfnValid;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const isEdit = !!editing;
      const url = isEdit ? `/api/entities/${editing!.id}` : '/api/entities';
      const method = isEdit ? 'PUT' : 'POST';

      // Build the payload. On edit, only include `tfn` if the user
      // touched the TFN field (so we don't accidentally clear an
      // existing value); on create, include if collectsTfn is on.
      type Payload = {
        name: string;
        type: LegalEntityType;
        role: LegalEntityRole;
        abn: string | null;
        acn: string | null;
        tradingName: string | null;
        establishedDate: string | null;
        parentEntityId: string | null;
        tfn?: string | null;
      };
      const payload: Payload = {
        name: form.name.trim(),
        type: form.type,
        role: form.role,
        abn: form.abn.trim() || null,
        acn: form.acn.trim() || null,
        tradingName: form.tradingName.trim() || null,
        establishedDate: form.establishedDate || null,
        parentEntityId: form.parentEntityId || null,
      };
      if (isEdit) {
        if (form.tfnTouched) {
          payload.tfn = form.collectsTfn && form.tfn ? form.tfn : null;
        }
      } else {
        payload.tfn = form.collectsTfn && form.tfn ? form.tfn : null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save entity');
      }
      await fetchEntities();
      setFormOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/entities/${removeTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to remove entity');
      }
      await fetchEntities();
      setRemoveTarget(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRemoving(false);
    }
  };

  // Eligible parents = COMPANY entities (corporate trustee pattern), excluding self.
  const availableParents: Entity[] = entities.filter(
    (e) => e.type === 'COMPANY' && (!editing || e.id !== editing.id),
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            Track stage · My Structure
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">
            How is your wealth held?
          </h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Most Australian wealth-builders hold their assets across more than
            one legal entity — your name, a family trust, an SMSF, a company.
            Tell us about yours so every property, loan, and investment can be
            mapped to the right structure.
          </p>
        </header>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200/70 bg-white/60 p-12 dark:border-slate-700/50 dark:bg-slate-900/60">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
            <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">Couldn&rsquo;t load your entities.</p>
                <p className="mt-1 text-xs opacity-80">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchEntities}
            >
              Try again
            </Button>
          </div>
        )}

        {/* Entities list */}
        {!loading && !error && (
          <>
            {entities.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  No entities yet.
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Add a trust, SMSF, or company to map your structure.
                </p>
              </div>
            )}

            {entities.length > 0 && (
              <div className="space-y-3">
                {entities.map((entity) => {
                  const counts = entity.ownedObjectsCount;
                  const ownedSummary = counts.total === 0
                    ? 'No items attached yet'
                    : [
                        counts.properties && `${counts.properties} property${counts.properties === 1 ? '' : ' · ies'.replace('· ies', 'ies')}`,
                        counts.loans && `${counts.loans} loan${counts.loans === 1 ? '' : 's'}`,
                        counts.accounts && `${counts.accounts} account${counts.accounts === 1 ? '' : 's'}`,
                        counts.investmentAccounts && `${counts.investmentAccounts} investment${counts.investmentAccounts === 1 ? '' : 's'}`,
                        counts.assets && `${counts.assets} asset${counts.assets === 1 ? '' : 's'}`,
                      ]
                        .filter(Boolean)
                        .slice(0, 4)
                        .join(' · ');
                  return (
                    <div
                      key={entity.id}
                      className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm transition hover:shadow-md dark:border-slate-700/50 dark:bg-slate-900/80"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                            {entityIcon(entity.type)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                              {entity.name}
                            </h3>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              {TYPE_LABELS[entity.type]} · {ROLE_LABELS[entity.role]}
                              {entity.abn && ` · ABN ${formatAbn(entity.abn)}`}
                              {entity.acn && ` · ACN ${formatAcn(entity.acn)}`}
                              {entity.parentEntityName &&
                                ` · trustee: ${entity.parentEntityName}`}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-slate-600 dark:text-slate-300">
                                {ownedSummary}
                              </span>
                              {entity.hasTfn && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  <Lock className="h-3 w-3" />
                                  TFN on file
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(entity)}
                            aria-label={`Edit ${entity.name}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRemoveTarget(entity);
                              setRemoveError(null);
                            }}
                            aria-label={`Remove ${entity.name}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add affordance */}
            <Button onClick={openAdd} className="w-full sm:w-auto">
              <Plus className="mr-1.5 h-4 w-4" />
              Add a trust, SMSF, or company
            </Button>
          </>
        )}
      </div>

      {/* Form dialog (add/edit) */}
      <Dialog open={formOpen} onOpenChange={(o) => (o ? null : closeForm())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit entity' : 'Add an entity'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update this entity’s details.'
                : 'Tell us about a trust, SMSF, company, or partnership you hold wealth through.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="page-entity-name">Display name</Label>
              <Input
                id="page-entity-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder='e.g. "The Smith Family Trust"'
                autoFocus
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="page-entity-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => handleTypeChange(v as LegalEntityType)}
                >
                  <SelectTrigger id="page-entity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="page-entity-role">Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) =>
                    setForm({ ...form, role: v as LegalEntityRole })
                  }
                >
                  <SelectTrigger id="page-entity-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {applicable.abn && (
              <div>
                <Label htmlFor="page-entity-abn">ABN (optional)</Label>
                <Input
                  id="page-entity-abn"
                  value={form.abn}
                  onChange={(e) => setForm({ ...form, abn: e.target.value })}
                  placeholder="11 digits"
                  inputMode="numeric"
                  aria-invalid={!abnValid}
                />
                {!abnValid && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                    <AlertCircle className="h-3 w-3" />
                    ABN must be 11 digits with a valid checksum.
                  </p>
                )}
              </div>
            )}

            {applicable.acn && (
              <div>
                <Label htmlFor="page-entity-acn">ACN (optional)</Label>
                <Input
                  id="page-entity-acn"
                  value={form.acn}
                  onChange={(e) => setForm({ ...form, acn: e.target.value })}
                  placeholder="9 digits"
                  inputMode="numeric"
                  aria-invalid={!acnValid}
                />
                {!acnValid && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                    <AlertCircle className="h-3 w-3" />
                    ACN must be 9 digits with a valid checksum.
                  </p>
                )}
              </div>
            )}

            {applicable.tfn && (
              <div className="rounded-xl border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-700/50 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="page-tfn-toggle" className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Save TFN for this entity
                    </Label>
                    <p className="mt-1 text-xs text-slate-500">
                      Optional. Stored encrypted at rest. Never sent to our AI,
                      never in audit logs.
                      {editing && form.collectsTfn && !form.tfnTouched && (
                        <span className="mt-1 block font-medium text-emerald-700 dark:text-emerald-400">
                          A TFN is already saved. Type a new value to replace
                          it, or turn the switch off to clear it.
                        </span>
                      )}
                    </p>
                  </div>
                  <Switch
                    id="page-tfn-toggle"
                    checked={form.collectsTfn}
                    onCheckedChange={(v) =>
                      setForm({ ...form, collectsTfn: v, tfn: '', tfnTouched: true })
                    }
                  />
                </div>
                {form.collectsTfn && (
                  <div className="mt-3">
                    <Input
                      id="page-tfn"
                      type="password"
                      autoComplete="off"
                      value={form.tfn}
                      onChange={(e) =>
                        setForm({ ...form, tfn: e.target.value, tfnTouched: true })
                      }
                      placeholder={
                        editing && !form.tfnTouched && form.collectsTfn
                          ? '••• ••• ••• (existing)'
                          : '8 or 9 digits'
                      }
                      inputMode="numeric"
                      aria-invalid={!tfnValid}
                    />
                    {!tfnValid && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                        <AlertCircle className="h-3 w-3" />
                        TFN must be 8 or 9 digits.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {availableParents.length > 0 && (
              <div>
                <Label htmlFor="page-entity-parent">Trustee company (optional)</Label>
                <Select
                  value={form.parentEntityId || '__none__'}
                  onValueChange={(v) =>
                    setForm({ ...form, parentEntityId: v === '__none__' ? '' : v })
                  }
                >
                  <SelectTrigger id="page-entity-parent">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {availableParents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({TYPE_LABELS[p.type]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-500">
                  Use this if a Pty Ltd you&rsquo;ve added is the trustee of this trust.
                </p>
              </div>
            )}

            {saveError && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1.5 h-4 w-4" />
              )}
              {editing ? 'Save changes' : 'Add entity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRemoveTarget(null);
            setRemoveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget && removeTarget.ownedObjectsCount.total > 0 ? (
                <>
                  This entity owns {removeTarget.ownedObjectsCount.total} item
                  {removeTarget.ownedObjectsCount.total === 1 ? '' : 's'}.
                  You&rsquo;ll need to reassign or delete those before this
                  entity can be removed.
                </>
              ) : (
                <>
                  This will permanently remove this entity from your structure.
                  You can re-create it later if needed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeError && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{removeError}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRemove();
              }}
              disabled={removing || (removeTarget?.ownedObjectsCount.total ?? 0) > 0}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {removing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 h-4 w-4" />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
