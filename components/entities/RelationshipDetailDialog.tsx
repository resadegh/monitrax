'use client';

/**
 * Phase 44 Part 1c — relationship-detail dialog (§11A point 4).
 *
 * Opens when a connector on the canvas is clicked. Shows the edge's
 * detail — type, direction, effective dates, §6.1 structural state,
 * accountant-verified provenance, notes — and the end / delete
 * affordances. Writes go through `/api/entities/relationships/[id]` →
 * `entityRelationshipService` (the only writer, §8.4).
 */

import React, { useState } from 'react';
import { Loader2, AlertCircle, ArrowRight, CircleSlash, Trash2 } from 'lucide-react';
import type { StructuralState } from '@prisma/client';
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
import { relationshipTypeMeta } from './canvas/graphMeta';
import type { CanvasEdge } from './canvas/entityGraphClient';
import { endRelationshipRequest, deleteRelationshipRequest } from './canvas/entityGraphClient';

const STATE_LABEL: Record<StructuralState, { label: string; cls: string }> = {
  VALID: {
    label: 'Valid',
    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  NON_COMPLIANT_BUT_RECORDED: {
    label: 'Recorded — flagged',
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  IMPOSSIBLE_SYSTEM_ERROR: {
    label: 'Structural error',
    cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
};

function fmtDate(d: Date | null): string {
  if (!d) return 'current';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface RelationshipDetailDialogProps {
  open: boolean;
  edge: CanvasEdge | null;
  token: string;
  onClose: () => void;
  onChanged: () => void;
}

export function RelationshipDetailDialog({
  open,
  edge,
  token,
  onClose,
  onChanged,
}: RelationshipDetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!edge) return null;

  const meta = relationshipTypeMeta(edge.type);
  const state = STATE_LABEL[edge.structuralState] ?? STATE_LABEL.VALID;
  const ended = edge.effectiveTo !== null;

  const handleEnd = async () => {
    setBusy(true);
    setError(null);
    try {
      await endRelationshipRequest(token, edge.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end the relationship.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteRelationshipRequest(token, edge.id);
      setConfirmDelete(false);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the relationship.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{meta.label} relationship</DialogTitle>
            <DialogDescription>
              A typed, time-bounded edge in your entity structure.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-100">
                {edge.fromEntityName}
              </span>
              <span className="flex flex-shrink-0 items-center gap-1 text-xs text-slate-500">
                <ArrowRight className="h-3.5 w-3.5" />
                {meta.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-right font-medium text-slate-800 dark:text-slate-100">
                {edge.toEntityName}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-slate-400">Effective from</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">
                  {fmtDate(edge.effectiveFrom)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Effective to</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">
                  {fmtDate(edge.effectiveTo)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Structural state</dt>
                <dd>
                  <span className={`inline-block rounded-full px-2 py-0.5 font-medium ${state.cls}`}>
                    {state.label}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Provenance</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">
                  {edge.accountantVerified ? 'Accountant-verified' : 'User-entered'}
                </dd>
              </div>
            </dl>

            {edge.beneficiaryClass && (
              <p className="text-xs text-slate-500">
                Beneficiary class:{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {edge.beneficiaryClass.replace(/_/g, ' ').toLowerCase()}
                </span>
              </p>
            )}
            {edge.familyRelation && (
              <p className="text-xs text-slate-500">
                Family relation:{' '}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {edge.familyRelation.replace(/_/g, ' ').toLowerCase()}
                </span>
              </p>
            )}
            {edge.notes && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                {edge.notes}
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              {!ended && (
                <Button variant="outline" size="sm" onClick={handleEnd} disabled={busy}>
                  {busy ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CircleSlash className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  End relationship
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this relationship?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the relationship. If it genuinely ended, use
              &ldquo;End relationship&rdquo; instead so the history is kept.
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
