'use client';

/**
 * EntitiesStep — Phase 41b
 *
 * "How is your wealth held?" — the entity-layer onboarding step.
 *
 * Behaviour-psychology lens (CLAUDE.md §0): most first-time users own
 * everything in their personal name. Lead with that as the smart default
 * so they can keep moving — adding a Trust / SMSF / Pty Ltd is a one-tap
 * affordance for the minority who need it. Copy normalises ("most
 * Australian wealth-builders hold their assets across more than one
 * legal entity") rather than shaming ("you should have set up a
 * structure by now").
 *
 * On Continue:
 *   - If `data.entities` is empty, the user is opting for the smart
 *     default — the bulk-create writer relies on `getDefaultLegalEntityId`
 *     to attach everything to the user's PERSONAL_NAME entity (which the
 *     Phase 41a backfill already created, or the helper creates on demand
 *     for new registrations).
 *   - If `data.entities` has rows, each is persisted as a real
 *     `LegalEntity` row before any Property / Loan / Account etc. is
 *     written. The bulk-create writer also resolves trustee→trust
 *     temp-id pointers to real DB ids.
 *
 * TFN handling (CLAUDE.md §13): TFN is OPTIONAL, opt-in only via a
 * dedicated checkbox. The encrypted-at-rest helper lives at
 * `lib/security/tfnEncryption.ts` and is invoked server-side. The
 * wizard never logs the value, never sends it to AI, and never
 * displays it after the user types it (the field is masked on resume).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Crown,
  Landmark,
  Plus,
  Pencil,
  Trash2,
  Users,
  ShieldCheck,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
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
  WizardData,
  EntityInput,
  LegalEntityType,
  LegalEntityRole,
  LEGAL_ENTITY_TYPE_LABELS,
  LEGAL_ENTITY_ROLE_LABELS,
  generateId,
  type StepCommitFn,
} from '../types';
import { WizardStepShell, WizardAddButton } from '../primitives';
// Phase 12 Track G.3a — onboarding ⇄ real-table two-way sync for entities.
import {
  readEntities,
  syncEntities,
  snapshotToWizardEntities,
  wizardEntitiesToSnapshot,
  isPersistedId,
  EMPTY_ENTITIES_SNAPSHOT,
  type EntitiesSnapshot,
} from '@/lib/onboarding/entitiesSync';
import {
  isValidAbn,
  isValidAcn,
  isValidTfnFormat,
  formatAbn,
  formatAcn,
} from '@/lib/utils/auValidators';
import '@/styles/wizard-animations.css';

// =============================================================================
// HELPERS
// =============================================================================

/** Default role for a given entity type — drives the role select default. */
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

/** Whether ABN/ACN/TFN are typically applicable for a given type. */
function fieldApplicability(type: LegalEntityType): {
  abn: boolean;
  acn: boolean;
  tfn: boolean;
} {
  switch (type) {
    case 'PERSONAL_NAME':
      return { abn: false, acn: false, tfn: true };
    case 'COMPANY':
      return { abn: true, acn: true, tfn: true };
    case 'DISCRETIONARY_TRUST':
    case 'UNIT_TRUST':
    case 'SMSF':
    case 'PARTNERSHIP':
      return { abn: true, acn: false, tfn: true };
    case 'SOLE_TRADER':
      return { abn: true, acn: false, tfn: true };
    default:
      return { abn: true, acn: true, tfn: true };
  }
}

function entityTypeIcon(type: LegalEntityType) {
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

function emptyEntityForm(): EntityInput {
  return {
    id: generateId(),
    name: '',
    type: 'DISCRETIONARY_TRUST',
    role: 'HOLDING',
  };
}

// =============================================================================
// ENTITY CARD (read-only, clickable for edit)
// =============================================================================

interface EntityCardProps {
  entity: EntityInput;
  parentName?: string;
  onEdit: () => void;
  onRemove: () => void;
}

function EntityCard({ entity, parentName, onEdit, onRemove }: EntityCardProps) {
  return (
    <div className="wz-section">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            {entityTypeIcon(entity.type)}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {entity.name || 'Untitled entity'}
            </h4>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {LEGAL_ENTITY_TYPE_LABELS[entity.type]}
              {entity.abn ? ` · ABN ${formatAbn(entity.abn)}` : ''}
              {entity.tfn ? ' · TFN saved' : ''}
              {parentName ? ` · trustee: ${parentName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${entity.name || 'entity'}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${entity.name || 'entity'}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// ENTITY DIALOG
// =============================================================================

interface EntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: EntityInput;
  isEdit: boolean;
  availableParents: EntityInput[];   // current entities the user could nominate as trustee
  onSave: (entity: EntityInput) => void;
}

function EntityDialog({
  open,
  onOpenChange,
  initial,
  isEdit,
  availableParents,
  onSave,
}: EntityDialogProps) {
  const [form, setForm] = useState<EntityInput>(initial);
  const [collectsTfn, setCollectsTfn] = useState<boolean>(!!initial.tfn);

  React.useEffect(() => {
    if (open) {
      setForm(initial);
      setCollectsTfn(!!initial.tfn);
    }
  }, [open, initial]);

  const applicable = fieldApplicability(form.type);

  const abnValid =
    !applicable.abn || !form.abn || form.abn.length === 0 || isValidAbn(form.abn);
  const acnValid =
    !applicable.acn || !form.acn || form.acn.length === 0 || isValidAcn(form.acn);
  const tfnValid =
    !collectsTfn || !form.tfn || form.tfn.length === 0 || isValidTfnFormat(form.tfn);
  const nameValid = form.name.trim().length > 0;
  const canSave = nameValid && abnValid && acnValid && tfnValid;

  const handleTypeChange = (type: LegalEntityType) => {
    setForm((prev) => ({
      ...prev,
      type,
      role: defaultRoleForType(type),
    }));
  };

  const handleSave = () => {
    if (!canSave) return;
    const isTrustType = form.type === 'DISCRETIONARY_TRUST' || form.type === 'UNIT_TRUST';
    const cleaned: EntityInput = {
      ...form,
      name: form.name.trim(),
      abn: form.abn?.trim() || undefined,
      acn: form.acn?.trim() || undefined,
      tradingName: form.tradingName?.trim() || undefined,
      tfn: collectsTfn && form.tfn ? form.tfn.trim() : undefined,
      establishedDate: form.establishedDate || undefined,
      parentEntityTempId: form.parentEntityTempId || undefined,
      // Phase 41E.5 — reform fields. trustType only kept when the
      // entity type is a trust type. isForeignResident defaults false.
      trustType: isTrustType ? (form.trustType ?? 'OTHER') : undefined,
      isForeignResident: form.isForeignResident ?? false,
    };
    onSave(cleaned);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit entity' : 'Add an entity'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this entity’s details.'
              : 'Tell us about a trust, SMSF, company, or partnership you hold wealth through.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="entity-name">Display name</Label>
            <Input
              id="entity-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder='e.g. "The Smith Family Trust" or "Sarah Kim Pty Ltd"'
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-500">
              Use the warm name you call this entity in conversation.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="entity-type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => handleTypeChange(v as LegalEntityType)}
              >
                <SelectTrigger id="entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEGAL_ENTITY_TYPE_LABELS) as LegalEntityType[]).map(
                    (t) => (
                      <SelectItem key={t} value={t}>
                        {LEGAL_ENTITY_TYPE_LABELS[t]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entity-role">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v as LegalEntityRole })
                }
              >
                <SelectTrigger id="entity-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LEGAL_ENTITY_ROLE_LABELS) as LegalEntityRole[]).map(
                    (r) => (
                      <SelectItem key={r} value={r}>
                        {LEGAL_ENTITY_ROLE_LABELS[r]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {applicable.abn && (
            <div>
              <Label htmlFor="entity-abn">ABN (optional)</Label>
              <Input
                id="entity-abn"
                value={form.abn ?? ''}
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
              <Label htmlFor="entity-acn">ACN (optional)</Label>
              <Input
                id="entity-acn"
                value={form.acn ?? ''}
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

          {/* Phase 41E.5 — Measure 3 trust-subtype selector (conditional). */}
          {(form.type === 'DISCRETIONARY_TRUST' || form.type === 'UNIT_TRUST') && (
            <div>
              <Label htmlFor="entity-trust-type">Trust subtype</Label>
              <select
                id="entity-trust-type"
                value={form.trustType ?? 'OTHER'}
                onChange={(e) =>
                  setForm({ ...form, trustType: e.target.value as NonNullable<EntityInput['trustType']> })
                }
                className="mt-1.5 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="DISCRETIONARY">Discretionary trust (family trust)</option>
                <option value="FIXED">Fixed trust</option>
                <option value="UNIT">Unit trust</option>
                <option value="TESTAMENTARY_FIXED">Testamentary fixed trust</option>
                <option value="CHARITABLE">Charitable trust</option>
                <option value="DECEASED_ESTATE">Deceased estate</option>
                <option value="SPECIAL_DISABILITY">Special disability trust</option>
                <option value="OTHER">Other / unsure</option>
              </select>
              {(form.trustType === 'DISCRETIONARY' || (form.type === 'DISCRETIONARY_TRUST' && !form.trustType)) && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Phase 41E Measure 3 — discretionary trusts will pay a 30% minimum tax on
                  trust taxable income from FY 2028-29.
                </p>
              )}
            </div>
          )}

          {/* Phase 41E.5 — Measure 4 foreign-resident toggle. */}
          <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label htmlFor="entity-foreign-resident" className="block">
                  Foreign-resident entity
                </Label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Drives Phase 41E Measure 4 (Div 855 expansion) when on.
                </p>
              </div>
              <input
                id="entity-foreign-resident"
                type="checkbox"
                checked={form.isForeignResident ?? false}
                onChange={(e) => setForm({ ...form, isForeignResident: e.target.checked })}
                className="h-5 w-5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500"
              />
            </div>
          </div>

          {applicable.tfn && (
            <div className="rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-900/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor="entity-tfn-toggle" className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Save TFN for this entity
                  </Label>
                  <p className="mt-1 text-xs text-slate-500">
                    Optional. Stored encrypted at rest. Never sent to our AI,
                    never shown in audit logs, never displayed in plaintext
                    again after you type it.
                  </p>
                </div>
                <Switch
                  id="entity-tfn-toggle"
                  checked={collectsTfn}
                  onCheckedChange={(v) => {
                    setCollectsTfn(v);
                    if (!v) setForm({ ...form, tfn: undefined });
                  }}
                />
              </div>
              {collectsTfn && (
                <div className="mt-3">
                  <Input
                    id="entity-tfn"
                    type="password"
                    autoComplete="off"
                    value={form.tfn ?? ''}
                    onChange={(e) => setForm({ ...form, tfn: e.target.value })}
                    placeholder="8 or 9 digits"
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
              <Label htmlFor="entity-parent">Trustee company (optional)</Label>
              <Select
                value={form.parentEntityTempId ?? '__none__'}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    parentEntityTempId: v === '__none__' ? undefined : v,
                  })
                }
              >
                <SelectTrigger id="entity-parent">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {availableParents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || 'Untitled entity'} ({LEGAL_ENTITY_TYPE_LABELS[p.type]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-slate-500">
                Use this if a Pty Ltd you&rsquo;ve added is the trustee of this trust.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            <ShieldCheck className="mr-1.5 h-4 w-4" />
            {isEdit ? 'Save changes' : 'Add entity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface EntitiesStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  /**
   * Phase 12 Track G.3a: register an async commit with the container.
   * The container awaits it before advancing — it writes the entities to
   * the real `LegalEntity` table via `entitiesSync`. Optional so the step
   * still renders in non-wizard contexts.
   */
  registerStepCommit?: (fn: StepCommitFn | null) => void;
}

export function EntitiesStep({
  data,
  onUpdate,
  registerStepCommit,
}: EntitiesStepProps) {
  const { token } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EntityInput | null>(null);

  // ---- Phase 12 Track G.3a: real-table sync state --------------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const snapshotRef = useRef<EntitiesSnapshot>(EMPTY_ENTITIES_SNAPSHOT);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // ---- READ the real `LegalEntity` table on step open ---------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    readEntities(token)
      .then((snapshot) => {
        if (cancelled) return;
        snapshotRef.current = snapshot;
        const realEntities = snapshotToWizardEntities(snapshot);
        const unsynced = dataRef.current.entities.filter(
          (e) => !isPersistedId(e.id),
        );
        onUpdate({ entities: [...realEntities, ...unsynced] });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Could not load your entities. You can still edit — we’ll save when you continue.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- COMMIT: register the real-table write with the container ------
  useEffect(() => {
    if (!registerStepCommit) return;
    const commit: StepCommitFn = async () => {
      if (loading) {
        throw new Error('Still loading your entities — please wait a moment.');
      }
      const current = wizardEntitiesToSnapshot(dataRef.current.entities);
      const result = await syncEntities(token, snapshotRef.current, current);
      snapshotRef.current = result.snapshot;
      onUpdate({ entities: snapshotToWizardEntities(result.snapshot) });
    };
    registerStepCommit(commit);
    return () => registerStepCommit(null);
  }, [registerStepCommit, token, loading, onUpdate]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (entity: EntityInput) => {
    setEditing(entity);
    setDialogOpen(true);
  };

  const removeEntity = (id: string) => {
    onUpdate({
      entities: data.entities
        .filter((e) => e.id !== id)
        // Defensive: clear any parent-pointer that referenced the removed entity.
        .map((e) =>
          e.parentEntityTempId === id ? { ...e, parentEntityTempId: undefined } : e,
        ),
    });
  };

  const saveEntity = (entity: EntityInput) => {
    if (editing) {
      onUpdate({
        entities: data.entities.map((e) => (e.id === editing.id ? entity : e)),
      });
    } else {
      onUpdate({ entities: [...data.entities, entity] });
    }
  };

  // Eligible parents = COMPANY entities the user has already added (the
  // common AU pattern is a Pty Ltd acting as corporate trustee). When
  // editing an existing entity, we exclude itself + entities that already
  // depend on it (preventing cycles).
  const availableParents: EntityInput[] = data.entities.filter((e) => {
    if (editing && e.id === editing.id) return false;
    if (e.type !== 'COMPANY') return false;
    return true;
  });

  // The user's own personal name is NOT a "structure" they set up — the
  // PERSONAL_NAME entity is an auto-created default (Phase 41a backfill /
  // the bulk-create fallback). It stays in `data.entities` for the
  // real-table sync, but it is never rendered as a structure card: the
  // step's whole design is "empty list = just my personal name". Only
  // genuine structures (trust / SMSF / company / partnership) are shown.
  const displayedEntities = data.entities.filter(
    (e) => e.type !== 'PERSONAL_NAME',
  );

  return (
    <WizardStepShell
      icon={<Building2 className="h-8 w-8" strokeWidth={1.5} />}
      title="How is your wealth held?"
      subtitle="Most Australian wealth-builders hold their assets across more than one legal entity — your name, a family trust, an SMSF, a company. Tell us about yours so we can map your full picture."
    >
      {loadError && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{loadError}</span>
        </div>
      )}
      {displayedEntities.length > 0 && (
        <div className="space-y-3">
          {displayedEntities.map((entity) => {
            const parent = entity.parentEntityTempId
              ? data.entities.find((e) => e.id === entity.parentEntityTempId)
              : undefined;
            return (
              <EntityCard
                key={entity.id}
                entity={entity}
                parentName={parent?.name}
                onEdit={() => openEdit(entity)}
                onRemove={() => removeEntity(entity.id)}
              />
            );
          })}
        </div>
      )}

      <WizardAddButton leadingIcon={<Plus className="h-4 w-4" />} onClick={openAdd}>
        {displayedEntities.length === 0
          ? 'Add a trust, SMSF, or company'
          : 'Add another entity'}
      </WizardAddButton>

      {displayedEntities.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Just my personal name — I can add more later
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tap <span className="font-medium">Continue</span> and we&rsquo;ll set
            up everything in your name. You can add a trust, SMSF, or company
            anytime from <span className="font-medium">My Structure</span>.
          </p>
        </div>
      )}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing ?? emptyEntityForm()}
        isEdit={!!editing}
        availableParents={availableParents}
        onSave={saveEntity}
      />
    </WizardStepShell>
  );
}

export default EntitiesStep;
