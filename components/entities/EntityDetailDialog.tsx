'use client';

/**
 * Phase 44 Part 1c — entity-detail dialog (§11A point 4, deliverable 3).
 *
 * Opens when an entity box on the canvas is clicked. Shows the entity's
 * full detail (progressive disclosure — the canvas box stays minimal,
 * the depth is one click away, §11A point 2) and lists EVERY relationship
 * the entity holds — inbound and outbound — with the affordances to add,
 * end and delete them.
 *
 * Every graph write goes through `/api/entities/relationships*` →
 * `entityRelationshipService` (the only writer, §8.4). The dialog
 * performs no tax/financial arithmetic (§8.3). Live validity feedback on
 * the add form is read from the pure `classifyEdge()` rules engine — the
 * §8.4-sanctioned UI consumer of `validityMatrix`.
 */

import React, { useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CircleSlash,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import type {
  EntityRelationshipType,
  BeneficiaryClass,
  StructuralState,
} from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROLE_PALETTE, ROLE_LABELS } from './types';
import {
  entityTypeMeta,
  relationshipTypeMeta,
  RELATIONSHIP_TYPE_GROUPS,
} from './canvas/graphMeta';
import type { CanvasGraph, CanvasNode, CanvasEdge } from './canvas/entityGraphClient';
import {
  createRelationshipRequest,
  endRelationshipRequest,
  deleteRelationshipRequest,
} from './canvas/entityGraphClient';
import { classifyEdge } from '@/lib/entity-graph/validityMatrix';
import type { GraphEdge } from '@/lib/entity-graph/types';
import { formatAbn, formatAcn } from '@/lib/utils/auValidators';

// =============================================================================
// SMALL HELPERS
// =============================================================================

const STATE_ICON: Record<StructuralState, { icon: typeof CheckCircle2; cls: string }> = {
  VALID: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400' },
  NON_COMPLIANT_BUT_RECORDED: { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400' },
  IMPOSSIBLE_SYSTEM_ERROR: { icon: XCircle, cls: 'text-rose-600 dark:text-rose-400' },
};

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const BENEFICIARY_CLASSES: BeneficiaryClass[] = [
  'PRIMARY',
  'GENERAL',
  'DEFAULT',
  'NAMED',
  'RESIDUARY',
  'SPECIFIC_GIFT',
  'LIFE_TENANT',
  'REMAINDERMAN',
];

const FAMILY_RELATIONS = ['SPOUSE', 'DE_FACTO', 'CHILD', 'PARENT', 'SIBLING', 'OTHER_RELATIVE'];
const LPR_REASONS = ['DEATH', 'INCAPACITY', 'MINOR', 'EPOA', 'OTHER'];

// =============================================================================
// PROPS
// =============================================================================

interface EntityDetailDialogProps {
  open: boolean;
  entity: CanvasNode | null;
  graph: CanvasGraph;
  /** This entity's validity-issue messages (from the canvas's classifyGraph run). */
  issues: string[];
  token: string;
  onClose: () => void;
  /** Called after any relationship write so the canvas refetches. */
  onChanged: () => void;
  /** Open the page's entity edit form for this entity. */
  onEditEntity: (entityId: string) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EntityDetailDialog({
  open,
  entity,
  graph,
  issues,
  token,
  onClose,
  onChanged,
  onEditEntity,
}: EntityDetailDialogProps) {
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CanvasEdge | null>(null);

  // Add-relationship form state.
  const [type, setType] = useState<EntityRelationshipType>('DIRECTOR_OF');
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound');
  const [otherId, setOtherId] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('');
  const [beneficiaryClass, setBeneficiaryClass] = useState<BeneficiaryClass | ''>('');
  const [familyRelation, setFamilyRelation] = useState<string>('');
  const [lprReason, setLprReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const relationships = useMemo(() => {
    if (!entity) return [];
    return graph.edges
      .filter((e) => e.fromEntityId === entity.id || e.toEntityId === entity.id)
      .sort((a, b) => {
        // Current first, then most-recent.
        const ac = a.effectiveTo ? 1 : 0;
        const bc = b.effectiveTo ? 1 : 0;
        if (ac !== bc) return ac - bc;
        return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
      });
  }, [graph.edges, entity]);

  const otherEntities = useMemo(
    () => (entity ? graph.nodes.filter((n) => n.id !== entity.id) : []),
    [graph.nodes, entity],
  );

  // Live §6.2 validity preview of the edge the form would create.
  const previewValidity = useMemo(() => {
    if (!entity || !otherId) return null;
    const fromEntityId = direction === 'outbound' ? entity.id : otherId;
    const toEntityId = direction === 'outbound' ? otherId : entity.id;
    const proposed: GraphEdge = {
      id: '__preview__',
      fromEntityId,
      toEntityId,
      type,
      effectiveFrom: new Date(),
      effectiveTo: null,
      beneficiaryClass: null,
      familyRelation: null,
      lprReason: null,
      appointorPower: [],
      powerType: null,
      powerSubject: null,
      structuralState: 'VALID',
      accountantVerified: false,
    };
    return classifyEdge(graph, proposed, new Date());
  }, [entity, otherId, direction, type, graph]);

  if (!entity) return null;

  const palette = ROLE_PALETTE[entity.role] ?? ROLE_PALETTE.PERSONAL;
  const meta = entityTypeMeta(entity.type);
  const stateIcon = STATE_ICON[entity.structuralState] ?? STATE_ICON.VALID;
  const StateIcon = stateIcon.icon;

  const resetForm = () => {
    setType('DIRECTOR_OF');
    setDirection('outbound');
    setOtherId('');
    setEffectiveFrom('');
    setBeneficiaryClass('');
    setFamilyRelation('');
    setLprReason('');
    setNotes('');
    setError(null);
  };

  const handleAdd = async () => {
    if (!otherId) {
      setError('Choose the other entity in this relationship.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createRelationshipRequest(token, {
        fromEntityId: direction === 'outbound' ? entity.id : otherId,
        toEntityId: direction === 'outbound' ? otherId : entity.id,
        type,
        effectiveFrom: effectiveFrom || undefined,
        beneficiaryClass: type === 'BENEFICIARY_OF' && beneficiaryClass ? beneficiaryClass : null,
        familyRelation: type === 'FAMILY_MEMBER_OF' && familyRelation ? familyRelation : null,
        lprReason:
          type === 'LEGAL_PERSONAL_REPRESENTATIVE_FOR' && lprReason ? lprReason : null,
        notes: notes.trim() || null,
      });
      resetForm();
      setAdding(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add the relationship.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnd = async (edge: CanvasEdge) => {
    setBusyId(edge.id);
    setError(null);
    try {
      await endRelationshipRequest(token, edge.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end the relationship.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError(null);
    try {
      await deleteRelationshipRequest(token, deleteTarget.id);
      setDeleteTarget(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the relationship.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${palette.iconBg} ${palette.icon}`}
              >
                <meta.icon className="h-4 w-4" />
              </span>
              {entity.name}
              <StateIcon className={`h-4 w-4 ${stateIcon.cls}`} />
            </DialogTitle>
            <DialogDescription>
              {meta.label} · {ROLE_LABELS[entity.role] ?? entity.role}
            </DialogDescription>
          </DialogHeader>

          {/* ---- Overview ---- */}
          <section className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {entity.abn && (
                <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                  <span className="text-slate-400">ABN</span>{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {formatAbn(entity.abn)}
                  </span>
                </div>
              )}
              {entity.acn && (
                <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                  <span className="text-slate-400">ACN</span>{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {formatAcn(entity.acn)}
                  </span>
                </div>
              )}
            </div>

            {issues.length > 0 && (
              <div className="rounded-lg border border-amber-200/70 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="mb-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Structural notes
                </p>
                <ul className="list-disc space-y-0.5 pl-4">
                  {issues.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onEditEntity(entity.id)}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit details
              </Button>
              {entity.accountantVerified && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Accountant-verified
                </span>
              )}
            </div>
          </section>

          {/* ---- Relationships ---- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Relationships ({relationships.length})
              </h3>
              <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            {relationships.length === 0 && !adding && (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs italic text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                No relationships recorded yet. Add a trustee, director, shareholder or beneficiary
                to build out the structure.
              </p>
            )}

            <ul className="space-y-1.5">
              {relationships.map((edge) => {
                const rMeta = relationshipTypeMeta(edge.type);
                const ended = edge.effectiveTo !== null;
                const outbound = edge.fromEntityId === entity.id;
                const otherName = outbound ? edge.toEntityName : edge.fromEntityName;
                return (
                  <li
                    key={edge.id}
                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                      ended
                        ? 'border-slate-200/60 bg-slate-50/60 opacity-70 dark:border-slate-800 dark:bg-slate-900/40'
                        : 'border-slate-200/80 bg-white dark:border-slate-700/60 dark:bg-slate-900/60'
                    }`}
                  >
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {rMeta.label}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1 text-slate-700 dark:text-slate-200">
                      {outbound ? (
                        <>
                          <span className="text-slate-400">this</span>
                          <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-400" />
                          <span className="truncate font-medium">{otherName}</span>
                        </>
                      ) : (
                        <>
                          <span className="truncate font-medium">{otherName}</span>
                          <ArrowRight className="h-3 w-3 flex-shrink-0 text-slate-400" />
                          <span className="text-slate-400">this</span>
                        </>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-slate-400">
                      {ended ? `ended ${fmtDate(edge.effectiveTo)}` : `since ${fmtDate(edge.effectiveFrom)}`}
                    </span>
                    {edge.structuralState === 'NON_COMPLIANT_BUT_RECORDED' && (
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                    )}
                    {!ended && (
                      <button
                        type="button"
                        title="End this relationship"
                        disabled={busyId === edge.id}
                        onClick={() => handleEnd(edge)}
                        className="flex-shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        {busyId === edge.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CircleSlash className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      title="Delete this relationship"
                      disabled={busyId === edge.id}
                      onClick={() => setDeleteTarget(edge)}
                      className="flex-shrink-0 rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* ---- Add-relationship form ---- */}
            {adding && (
              <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/50">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rel-type">Relationship</Label>
                    <Select
                      value={type}
                      onValueChange={(v) => setType(v as EntityRelationshipType)}
                    >
                      <SelectTrigger id="rel-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_TYPE_GROUPS.map((grp) => (
                          <SelectGroup key={grp.group}>
                            <SelectLabel>{grp.group}</SelectLabel>
                            {grp.types.map((t) => (
                              <SelectItem key={t} value={t}>
                                {relationshipTypeMeta(t).label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rel-other">Other entity</Label>
                    <Select value={otherId} onValueChange={setOtherId}>
                      <SelectTrigger id="rel-other">
                        <SelectValue placeholder="Choose an entity" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherEntities.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Direction toggle */}
                <div>
                  <Label>Direction</Label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setDirection('outbound')}
                      className={`rounded-lg border px-2 py-1.5 transition ${
                        direction === 'outbound'
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {entity.name} → {relationshipTypeMeta(type).label} → other
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('inbound')}
                      className={`rounded-lg border px-2 py-1.5 transition ${
                        direction === 'inbound'
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      other → {relationshipTypeMeta(type).label} → {entity.name}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="rel-from">Effective from (optional)</Label>
                    <Input
                      id="rel-from"
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                    />
                  </div>
                  {type === 'BENEFICIARY_OF' && (
                    <div>
                      <Label htmlFor="rel-bclass">Beneficiary class</Label>
                      <Select
                        value={beneficiaryClass}
                        onValueChange={(v) => setBeneficiaryClass(v as BeneficiaryClass)}
                      >
                        <SelectTrigger id="rel-bclass">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {BENEFICIARY_CLASSES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c.replace(/_/g, ' ').toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {type === 'FAMILY_MEMBER_OF' && (
                    <div>
                      <Label htmlFor="rel-fam">Family relation</Label>
                      <Select value={familyRelation} onValueChange={setFamilyRelation}>
                        <SelectTrigger id="rel-fam">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {FAMILY_RELATIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r.replace(/_/g, ' ').toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {type === 'LEGAL_PERSONAL_REPRESENTATIVE_FOR' && (
                    <div>
                      <Label htmlFor="rel-lpr">Reason</Label>
                      <Select value={lprReason} onValueChange={setLprReason}>
                        <SelectTrigger id="rel-lpr">
                          <SelectValue placeholder="Optional" />
                        </SelectTrigger>
                        <SelectContent>
                          {LPR_REASONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r.toLowerCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="rel-notes">Notes (optional)</Label>
                  <Input
                    id="rel-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything worth recording about this relationship"
                  />
                </div>

                {/* Live §6.2 validity preview */}
                {previewValidity && previewValidity.state !== 'VALID' && (
                  <div
                    className={`rounded-lg p-2 text-xs ${
                      previewValidity.state === 'IMPOSSIBLE_SYSTEM_ERROR'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                    }`}
                  >
                    {previewValidity.state === 'IMPOSSIBLE_SYSTEM_ERROR'
                      ? 'This relationship is impossible and cannot be recorded:'
                      : 'This relationship can be recorded, but it will be flagged:'}{' '}
                    {previewValidity.issues[0]?.message}
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
                  <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={
                      submitting ||
                      !otherId ||
                      previewValidity?.state === 'IMPOSSIBLE_SYSTEM_ERROR'
                    }
                  >
                    {submitting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Add relationship
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </section>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => (o ? null : setDeleteTarget(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this relationship?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the relationship. If it genuinely ended (a director
              resigned, shares were sold), use &ldquo;End&rdquo; instead so the history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
