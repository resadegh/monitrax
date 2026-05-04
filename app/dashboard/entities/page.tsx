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
  Plus,
  Trash2,
  AlertCircle,
  ShieldCheck,
  Lock,
  Loader2,
  TreePine,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { EntityTree } from '@/components/entities/EntityTree';
import type { HouseholdMember } from '@/components/entities/types';
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
import { useAuth } from '@/lib/context/AuthContext';

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

/**
 * Phase 41c hotfix-2: API responses come in two error shapes across the
 * Monitrax codebase:
 *   - canonical (CLAUDE.md §6.6): `{ error: { code, message, details } }`
 *     — emitted by `formatErrorResponse(errors.unauthorized(...))` etc.
 *   - simple: `{ error: 'message string' }` — emitted by ad-hoc routes
 *     like `/api/entities`'s catch handler.
 *
 * Earlier code did `${body.error}` which renders `[object Object]` when
 * the server returns the canonical shape. This helper handles both.
 */
function extractErrorMessage(
  body: unknown,
  status: number,
  fallback: string,
): string {
  if (body && typeof body === 'object') {
    const err = (body as { error?: unknown }).error;
    if (typeof err === 'string' && err.length > 0) {
      return `${status} ${err}`;
    }
    if (err && typeof err === 'object') {
      const message = (err as { message?: unknown }).message;
      const code = (err as { code?: unknown }).code;
      if (typeof message === 'string' && message.length > 0) {
        return code ? `${status} ${message} (${code})` : `${status} ${message}`;
      }
      if (typeof code === 'string') {
        return `${status} ${code}`;
      }
    }
  }
  return `${status} ${fallback}`;
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function EntitiesPage() {
  // Phase 41c hotfix-2: every Monitrax API route uses `withPermission`
  // which resolves the caller from the `Authorization: Bearer <token>`
  // header. The bare `fetch()` calls in earlier 41b/41c code 401'd
  // because they didn't attach the Firebase ID token. Same pattern as
  // /dashboard/balances and every other working dashboard page.
  const { token } = useAuth();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
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
    if (!token) {
      // Auth hasn't hydrated yet. We re-run when token arrives via
      // the useEffect dependency below — until then, stay in loading
      // state rather than 401'ing a bare fetch.
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      // Phase 41c: fetch entities + household members in parallel so the
      // tree can render People → Entities edges in one round-trip.
      const [entitiesRes, membersRes] = await Promise.all([
        fetch('/api/entities', { headers }),
        fetch('/api/household-members', { headers }).catch(() => null),
      ]);
      if (!entitiesRes.ok) {
        // Phase 41c resilience: surface the actual server response so the
        // error block can tell the user (and Reza) WHY the API failed —
        // a generic "Failed to load entities" makes the issue invisible.
        // `extractErrorMessage` handles both the canonical
        // `{ error: { code, message } }` shape and the simple
        // `{ error: 'string' }` shape (CLAUDE.md §6.6 + ad-hoc routes).
        let body: unknown = null;
        try {
          body = await entitiesRes.json();
        } catch {
          // Body wasn't JSON; fall through to the fallback.
        }
        throw new Error(
          extractErrorMessage(body, entitiesRes.status, entitiesRes.statusText || 'Failed to load entities'),
        );
      }
      const entitiesJson = await entitiesRes.json();
      setEntities(entitiesJson.data ?? []);

      // Household members are best-effort — if the endpoint 401s for
      // some reason we still render the tree with a generic "You" anchor
      // (handled inside EntityTree).
      if (membersRes && membersRes.ok) {
        const membersJson = await membersRes.json();
        const raw =
          (membersJson?.data?.members as HouseholdMember[] | undefined) ??
          (membersJson?.members as HouseholdMember[] | undefined) ??
          (Array.isArray(membersJson?.data) ? (membersJson.data as HouseholdMember[]) : []) ??
          [];
        setMembers(raw);
      } else {
        setMembers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

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

      if (!token) {
        throw new Error('Not signed in. Please refresh and try again.');
      }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err, res.status, 'Failed to save entity'));
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
    if (!token) {
      setRemoveError('Not signed in. Please refresh and try again.');
      return;
    }
    setRemoving(true);
    setRemoveError(null);
    try {
      const res = await fetch(`/api/entities/${removeTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err, res.status, 'Failed to remove entity'));
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
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            <TreePine className="h-3.5 w-3.5" />
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

        {/* Error state — Phase 41c resilience: surface the actual API
            error AND keep an "Add an entity" CTA reachable so the user
            is never stuck on a dead end. Until 41a's backfill ran, brand-
            new users could land here with zero entities; if anything
            errors at the API layer they previously had no escape hatch. */}
        {!loading && error && (
          <div className="rounded-2xl border border-rose-200/70 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
            <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">Couldn&rsquo;t load your entities.</p>
                <p className="mt-1 text-xs opacity-80">{error}</p>
                <p className="mt-2 text-xs opacity-70">
                  You can still add a new entity below — it will save once we&rsquo;re
                  back in sync.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchEntities}>
                Try again
              </Button>
              <Button size="sm" onClick={openAdd}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add an entity anyway
              </Button>
            </div>
          </div>
        )}

        {/* Phase 41c: Entity Tree — interactive, live, navigable
            visualisation of the user's LegalEntity graph. Replaces the
            previous list view per Reza directive 2026-05-04. The tree
            renders People (top) → Entities (middle, role-coloured) with
            owned-objects chips inline; SVG connectors show ownership +
            dashed corporate-trustee links. Clicking any tile opens the
            EntityFormDialog (edit); the embedded "Add" affordance opens
            the same dialog in create mode.

            Phase 41c hotfix: not everyone has a structure. A user whose
            only entity is the auto-created PERSONAL_NAME (Phase 41a
            backfill) doesn't see "their structure" as an entity tree —
            they see a simpler "your wealth is held in your personal
            name" hero. The tree only fires when there's REAL structure
            to render: any non-PERSONAL_NAME entity, OR multiple
            PERSONAL_NAME entities (joint households). Reza directive
            2026-05-05: *"not everyone has one of these entities, so
            there should be an option for user to have none."* */}
        {!loading && !error && (() => {
          const personalEntities = entities.filter((e) => e.type === 'PERSONAL_NAME');
          const realEntities = entities.filter((e) => e.type !== 'PERSONAL_NAME');
          const hasRealStructure =
            realEntities.length > 0 || personalEntities.length > 1;

          if (hasRealStructure) {
            return (
              <EntityTree
                entities={entities}
                members={members}
                onEntityClick={openEdit}
                onAdd={openAdd}
              />
            );
          }

          // Simplified hero — user holds everything in their natural name.
          // The PERSONAL_NAME entity (if any) is never surfaced as an
          // "entity" here; it's an internal FK target. The user can edit
          // their personal-name details only if they want to associate a
          // TFN or trading name; otherwise they tap "Add" to introduce a
          // real structure.
          const personal = personalEntities[0];
          return (
            <div className="rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white/80 via-white/60 to-amber-50/40 p-8 shadow-sm ring-1 ring-slate-900/[0.04] backdrop-blur-sm dark:border-slate-700/50 dark:from-slate-900/70 dark:via-slate-900/60 dark:to-slate-950/70">
              <div className="mx-auto max-w-xl space-y-3 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Your structure
                </p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
                  Your wealth is held in your personal name.
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Most Australian wealth-builders start here — a single legal
                  identity that owns everything. If you also hold assets through
                  a family trust, an SMSF, or a Pty Ltd, add it below and
                  we&rsquo;ll map your full picture.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
                  <Button onClick={openAdd}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add a trust, SMSF, or company
                  </Button>
                  {personal && (
                    <Button variant="outline" onClick={() => openEdit(personal)}>
                      Edit my personal details
                    </Button>
                  )}
                </div>
                <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">
                  Not everyone has a separate structure — and that&rsquo;s fine.
                  You can come back here anytime if your situation changes.
                </p>
              </div>
            </div>
          );
        })()}
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

          <DialogFooter className="sm:justify-between">
            <div>
              {/* Phase 41c: Remove affordance moved into the edit dialog —
                  the tree-view tiles don't carry per-tile remove buttons,
                  so this is the discoverable path to delete an entity. */}
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                  onClick={() => {
                    if (!editing) return;
                    setRemoveTarget(editing);
                    setRemoveError(null);
                    setFormOpen(false);
                  }}
                  disabled={saving}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
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
            </div>
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
