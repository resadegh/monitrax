'use client';

/**
 * Phase 44 Part 1c — the entity-structure canvas box (§11A point 1, 2, 4).
 *
 * A custom React Flow node: a role-coloured Apple-glass tile. The canvas
 * brings its OWN node component so the Phase 39 / 41c design language —
 * role palette, glass surface, restraint — carries over; React Flow
 * supplies only the interaction engine, never the look.
 *
 * Progressive disclosure (§11A point 2): the box shows name + type + one
 * key line only. Full detail opens in the entity-detail dialog on click.
 *
 * Structural-state badge (§11A point 4 / §6.1): green VALID, amber
 * NON_COMPLIANT_BUT_RECORDED (reason on hover), red IMPOSSIBLE — the §6.1
 * state is visible at a glance, never buried.
 */

import React from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Lock, ShieldCheck, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { LegalEntityType, LegalEntityRole, StructuralState } from '@prisma/client';
import { ROLE_PALETTE } from '../types';
import { entityTypeMeta } from './graphMeta';

export interface EntityNodeData {
  name: string;
  entityType: LegalEntityType;
  role: LegalEntityRole;
  /** The single key line — "ABN 12 345…" or "Trustee: Acme Pty Ltd". */
  keyLine: string | null;
  state: StructuralState;
  /** First validity-issue message — the badge hover reason. */
  stateReason: string | null;
  accountantVerified: boolean;
  hasTfn: boolean;
  unsupportedStructure: boolean;
  [key: string]: unknown;
}

export type EntityCanvasNodeType = Node<EntityNodeData, 'entity'>;

const STATE_BADGE: Record<
  StructuralState,
  { icon: typeof CheckCircle2; cls: string; label: string }
> = {
  VALID: {
    icon: CheckCircle2,
    cls: 'text-emerald-600 dark:text-emerald-400',
    label: 'Structurally valid',
  },
  NON_COMPLIANT_BUT_RECORDED: {
    icon: AlertTriangle,
    cls: 'text-amber-600 dark:text-amber-400',
    label: 'Recorded — needs attention',
  },
  IMPOSSIBLE_SYSTEM_ERROR: {
    icon: XCircle,
    cls: 'text-rose-600 dark:text-rose-400',
    label: 'Structural error',
  },
};

function EntityCanvasNodeImpl({ data, selected }: NodeProps<EntityCanvasNodeType>) {
  const palette = ROLE_PALETTE[data.role] ?? ROLE_PALETTE.PERSONAL;
  const meta = entityTypeMeta(data.entityType);
  const Icon = meta.icon;
  const badge = STATE_BADGE[data.state] ?? STATE_BADGE.VALID;
  const BadgeIcon = badge.icon;

  return (
    <div
      className={`relative flex w-[232px] flex-col gap-1.5 rounded-2xl border bg-white/90 px-3.5 py-3 shadow-sm ring-1 backdrop-blur-sm transition dark:bg-slate-900/90 ${
        selected
          ? 'border-slate-400 ring-2 ring-slate-900/10 dark:border-slate-500'
          : 'border-slate-200/80 ring-slate-900/[0.04] dark:border-slate-700/60'
      }`}
    >
      {/* React Flow connection handles — top = inbound, bottom = outbound. */}
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-slate-300 dark:!bg-slate-600" />
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-slate-300 dark:!bg-slate-600" />

      <div className="flex items-start gap-2.5">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${palette.iconBg} ${palette.icon}`}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {data.name}
          </p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{meta.short}</p>
        </div>
        {/* Structural-state badge — §6.1 visible at a glance. */}
        <span title={data.stateReason ?? badge.label} className={`flex-shrink-0 ${badge.cls}`}>
          <BadgeIcon className="h-4 w-4" />
        </span>
      </div>

      {data.keyLine && (
        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{data.keyLine}</p>
      )}

      <div className="flex items-center gap-1.5">
        {data.accountantVerified && (
          <span
            title="Accountant-verified"
            className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
          >
            <ShieldCheck className="h-2.5 w-2.5" />
            Verified
          </span>
        )}
        {data.hasTfn && (
          <span
            title="TFN on file (encrypted)"
            className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <Lock className="h-2.5 w-2.5" />
            TFN
          </span>
        )}
        {data.unsupportedStructure && (
          <span
            title="Outside the supported structural grammar — recorded and flagged"
            className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          >
            Unsupported
          </span>
        )}
      </div>
    </div>
  );
}

export const EntityCanvasNode = React.memo(EntityCanvasNodeImpl);
