'use client';

/**
 * EntityTree — Phase 41c "My Structure"
 *
 * Interactive, live, navigable tree visualisation of the user's
 * `LegalEntity` graph. Replaces the list view at `/dashboard/entities`
 * per Reza directive 2026-05-04.
 *
 * Layout (desktop ≥md):
 *
 *   ┌──────────── Household members (top row) ─────────────┐
 *   │  [👤 David]    [👤 Emma]                              │
 *   └──┬───────────────┬────────────────────────────────────┘
 *      │               │
 *      ↓               ↓ (Person → matched PERSONAL_NAME entity)
 *   ┌──┴───────────────┴────────────────────────────────────┐
 *   │  Legal entities (middle, role-coloured glass tiles)   │
 *   │  [David] [Emma] [Mei Holdings] [Mei Trust] [Mei SMSF] │
 *   │                          ⤓⤓                          │ ← dashed line: corporate trustee
 *   └────────────────────────────────────────────────────────┘
 *      Each entity tile carries its owned-objects summary
 *      (chips) inline; clicking the tile opens the form
 *      dialog; clicking a chip drills to /dashboard/<type>.
 *
 * SVG layer absolutely positioned above the grid renders the
 * Person→Entity connectors and the dashed Trustee→Trust corporate
 * lines. Coordinates are measured via refs + ResizeObserver so the
 * tree responds to container/viewport changes.
 *
 * Mobile (<md): falls back to a stacked, indented list — the
 * SVG connectors are suppressed; trustee→trust hierarchy is
 * indicated with a "trustee: …" line on the child entity.
 *
 * Apple-glass aesthetic + Phase 39 design language. Honours
 * `prefers-reduced-motion` (motion lines render but don't animate).
 *
 * Click affordances:
 *   - Person tile  → no-op for v1 (Phase 41e+ will navigate to a
 *                    person-scoped tax position view)
 *   - Entity tile  → opens EntityFormDialog (edit)
 *   - Add button   → opens EntityFormDialog (add)
 *
 * All counts and metadata flow from `/api/entities` — single SSOT.
 */

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Building2,
  Crown,
  Landmark,
  Users,
  Briefcase,
  User as UserIcon,
  Plus,
  Lock,
  ArrowRight,
  TreePine,
  Wallet,
  Home,
  TrendingUp,
  CreditCard,
  Banknote,
} from 'lucide-react';
import {
  Entity,
  HouseholdMember,
  LegalEntityType,
  LegalEntityRole,
  ROLE_PALETTE,
  TYPE_LABELS_SHORT,
} from './types';
import { formatAbn } from '@/lib/utils/auValidators';

// =============================================================================
// HELPERS
// =============================================================================

function entityIcon(type: LegalEntityType) {
  switch (type) {
    case 'PERSONAL_NAME':
      return <Users className="h-4 w-4" />;
    case 'COMPANY':
      return <Building2 className="h-4 w-4" />;
    case 'SOLE_TRADER':
      return <Briefcase className="h-4 w-4" />;
    case 'PARTNERSHIP':
      return <Briefcase className="h-4 w-4" />;
    case 'DISCRETIONARY_TRUST':
    case 'UNIT_TRUST':
      return <Crown className="h-4 w-4" />;
    case 'SMSF':
      return <Landmark className="h-4 w-4" />;
    default:
      return <Building2 className="h-4 w-4" />;
  }
}

interface OwnedChip {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

function ownedChips(entity: Entity): OwnedChip[] {
  const c = entity.ownedObjectsCount;
  const chips: OwnedChip[] = [];
  if (c.properties > 0) {
    chips.push({
      key: 'p',
      label: `${c.properties} ${c.properties === 1 ? 'property' : 'properties'}`,
      icon: <Home className="h-3 w-3" />,
      href: '/dashboard/properties',
    });
  }
  if (c.loans > 0) {
    chips.push({
      key: 'l',
      label: `${c.loans} ${c.loans === 1 ? 'loan' : 'loans'}`,
      icon: <CreditCard className="h-3 w-3" />,
      href: '/dashboard/balances',
    });
  }
  if (c.accounts > 0) {
    chips.push({
      key: 'a',
      label: `${c.accounts} ${c.accounts === 1 ? 'account' : 'accounts'}`,
      icon: <Wallet className="h-3 w-3" />,
      href: '/dashboard/balances',
    });
  }
  if (c.investmentAccounts > 0) {
    chips.push({
      key: 'i',
      label: `${c.investmentAccounts} ${c.investmentAccounts === 1 ? 'investment' : 'investments'}`,
      icon: <TrendingUp className="h-3 w-3" />,
      href: '/dashboard/investments/accounts',
    });
  }
  if (c.assets > 0) {
    chips.push({
      key: 's',
      label: `${c.assets} ${c.assets === 1 ? 'asset' : 'assets'}`,
      icon: <Banknote className="h-3 w-3" />,
      href: '/dashboard/assets',
    });
  }
  return chips;
}

/**
 * Match each PERSONAL_NAME entity to a household member by name.
 * Case-insensitive, trim. If no match, returns null and the entity
 * connects directly to the "Household" header instead of a specific
 * person tile (rendered as a generic anchor on the People row).
 */
function matchPersonForEntity(
  entity: Entity,
  members: HouseholdMember[],
): HouseholdMember | null {
  if (entity.type !== 'PERSONAL_NAME') return null;
  if (members.length === 0) return null;
  const name = entity.name.trim().toLowerCase();
  return (
    members.find((m) => m.name.trim().toLowerCase() === name) ??
    members.find((m) => name.includes(m.name.trim().toLowerCase())) ??
    null
  );
}

/**
 * For non-PERSONAL_NAME entities, the "principal" (the person who
 * controls / is most associated) is a v1 heuristic: every
 * PERSONAL_NAME entity in the household. Visualised as connecting
 * lines from each PERSONAL_NAME row to every non-PERSONAL_NAME
 * entity (a fan-out). Phase 41e will replace this with proper
 * shareholder / beneficiary fields.
 */
function principalEntityIds(allEntities: Entity[]): string[] {
  return allEntities
    .filter((e) => e.type === 'PERSONAL_NAME')
    .map((e) => e.id);
}

// =============================================================================
// SVG CONNECTORS LAYER
// =============================================================================

interface NodeRect {
  id: string;
  /** Center-x of the node, relative to the SVG canvas */
  cx: number;
  /** Top-y (for entities) — connector arrives here */
  top: number;
  /** Bottom-y (for people) — connector leaves here */
  bottom: number;
}

interface ConnectorsProps {
  width: number;
  height: number;
  peopleNodes: NodeRect[];
  entityNodes: NodeRect[];
  peopleToEntity: Array<{ personId: string; entityId: string }>;
  trusteeToTrust: Array<{ parentId: string; childId: string }>;
}

function Connectors({
  width,
  height,
  peopleNodes,
  entityNodes,
  peopleToEntity,
  trusteeToTrust,
}: ConnectorsProps) {
  if (width === 0 || height === 0) return null;

  /** Cubic Bézier from (sx,sy) → (ex,ey) with vertical-leading control points. */
  function path(sx: number, sy: number, ex: number, ey: number): string {
    const my = (sy + ey) / 2;
    return `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`;
  }

  const personByid = new Map(peopleNodes.map((n) => [n.id, n]));
  const entityById = new Map(entityNodes.map((n) => [n.id, n]));

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="entity-edge-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* Person → Entity connectors */}
      {peopleToEntity.map(({ personId, entityId }, i) => {
        const p = personByid.get(personId);
        const e = entityById.get(entityId);
        if (!p || !e) return null;
        return (
          <path
            key={`pe-${personId}-${entityId}-${i}`}
            d={path(p.cx, p.bottom, e.cx, e.top)}
            stroke="url(#entity-edge-grad)"
            strokeWidth={1.5}
            fill="none"
          />
        );
      })}

      {/* Trustee → Trust dashed corporate links (between two entities) */}
      {trusteeToTrust.map(({ parentId, childId }, i) => {
        const p = entityById.get(parentId);
        const c = entityById.get(childId);
        if (!p || !c) return null;
        // Curve sideways between entity tiles on the same row.
        const sx = p.cx;
        const sy = p.bottom + 4;
        const ex = c.cx;
        const ey = c.top - 4;
        const ctrlY = sy + Math.max(28, Math.abs(ex - sx) * 0.18);
        return (
          <path
            key={`tt-${parentId}-${childId}-${i}`}
            d={`M ${sx} ${sy} C ${sx} ${ctrlY}, ${ex} ${ctrlY}, ${ex} ${ey}`}
            stroke="rgb(244 114 182)"
            strokeWidth={1.25}
            strokeDasharray="4 4"
            fill="none"
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

// =============================================================================
// PERSON TILE
// =============================================================================

interface PersonTileProps {
  member: HouseholdMember | null;   // null = generic "you" anchor when no household members exist
  motionDelay: number;
  reducedMotion: boolean;
  innerRef?: (el: HTMLDivElement | null) => void;
}

function PersonTile({ member, motionDelay, reducedMotion, innerRef }: PersonTileProps) {
  const name = member?.name ?? 'You';
  const sub = member?.relationship
    ? member.relationship === 'SELF'
      ? 'You'
      : member.relationship.charAt(0) + member.relationship.slice(1).toLowerCase()
    : 'Household';

  return (
    <motion.div
      ref={innerRef}
      initial={reducedMotion ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { delay: motionDelay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }
      }
      className="relative flex min-w-[140px] max-w-[180px] flex-col items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm ring-1 ring-slate-900/[0.04] backdrop-blur-sm transition hover:shadow-md dark:border-slate-700/50 dark:bg-slate-900/70"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <UserIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 text-center">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {name}
        </p>
        <p className="truncate text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {sub}
        </p>
      </div>
    </motion.div>
  );
}

// =============================================================================
// ENTITY TILE
// =============================================================================

interface EntityTileProps {
  entity: Entity;
  motionDelay: number;
  reducedMotion: boolean;
  onClick: () => void;
  onChipClick: (href: string) => void;
  innerRef?: (el: HTMLDivElement | null) => void;
}

function EntityTile({
  entity,
  motionDelay,
  reducedMotion,
  onClick,
  onChipClick,
  innerRef,
}: EntityTileProps) {
  const palette = ROLE_PALETTE[entity.role];
  const chips = ownedChips(entity);

  return (
    <motion.div
      ref={innerRef}
      initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              delay: motionDelay,
              duration: 0.5,
              ease: [0.22, 1, 0.36, 1],
            }
      }
      whileHover={reducedMotion ? undefined : { y: -2 }}
      className={`group relative flex min-w-[220px] max-w-[280px] flex-col gap-2 rounded-2xl border border-slate-200/70 bg-white/85 px-4 py-3.5 text-left shadow-sm ring-1 ring-slate-900/[0.04] backdrop-blur-sm transition hover:shadow-lg dark:border-slate-700/50 dark:bg-slate-900/80 ${palette.ring} hover:ring-2`}
    >
      <button
        type="button"
        onClick={onClick}
        className="absolute inset-0 rounded-2xl"
        aria-label={`Edit ${entity.name}`}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${palette.iconBg} ${palette.icon}`}
          >
            {entityIcon(entity.type)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {entity.name}
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {TYPE_LABELS_SHORT[entity.type]}
              {entity.abn && ` · ABN ${formatAbn(entity.abn).split(' ').slice(0, 2).join(' ')}…`}
            </p>
          </div>
        </div>
        {entity.hasTfn && (
          <span
            className="relative inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            title="TFN on file (encrypted)"
          >
            <Lock className="h-2.5 w-2.5" />
            TFN
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <div className="relative flex flex-wrap items-center gap-1.5 pt-1">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChipClick(chip.href);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label={`Open ${chip.label}`}
            >
              {chip.icon}
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {chips.length === 0 && (
        <p className="relative text-[11px] italic text-slate-400 dark:text-slate-500">
          Nothing attached yet
        </p>
      )}

      {entity.parentEntityName && (
        <p className="relative truncate text-[10px] text-fuchsia-700 dark:text-fuchsia-300">
          ↳ trustee: {entity.parentEntityName}
        </p>
      )}
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface EntityTreeProps {
  entities: Entity[];
  members: HouseholdMember[];
  onEntityClick: (entity: Entity) => void;
  onAdd: () => void;
}

export function EntityTree({
  entities,
  members,
  onEntityClick,
  onAdd,
}: EntityTreeProps) {
  const reducedMotion = useReducedMotion() ?? false;

  // Containers + node refs for SVG measurement
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const peopleRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const entityRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [nodeRects, setNodeRects] = useState<{
    width: number;
    height: number;
    people: NodeRect[];
    entities: NodeRect[];
  }>({ width: 0, height: 0, people: [], entities: [] });

  /** When there are no household members, fall back to a single anchor "You". */
  const peopleAnchors: HouseholdMember[] =
    members.length > 0
      ? members
      : [{ id: '__you__', name: 'You', relationship: 'SELF', isIncomeEarner: true }];

  // Person → Entity edges (heuristic v1)
  const personalIds = useMemo(() => principalEntityIds(entities), [entities]);
  const peopleToEntity = useMemo(() => {
    const edges: Array<{ personId: string; entityId: string }> = [];
    entities.forEach((e) => {
      if (e.type === 'PERSONAL_NAME') {
        const matched = matchPersonForEntity(e, peopleAnchors);
        edges.push({ personId: matched?.id ?? peopleAnchors[0].id, entityId: e.id });
      } else {
        // Non-PERSONAL_NAME entity: connect to every PERSONAL_NAME
        // entity's matched person (the "principals" of the household).
        // For demo this gives multi-person joint structures the right
        // visual: e.g. David + Emma both connect to Mei Family Trust.
        if (personalIds.length === 0) {
          edges.push({ personId: peopleAnchors[0].id, entityId: e.id });
        } else {
          personalIds.forEach((personalId) => {
            const personalEntity = entities.find((x) => x.id === personalId);
            const matched = personalEntity
              ? matchPersonForEntity(personalEntity, peopleAnchors)
              : null;
            edges.push({
              personId: matched?.id ?? peopleAnchors[0].id,
              entityId: e.id,
            });
          });
        }
      }
    });
    return edges;
  }, [entities, personalIds, peopleAnchors]);

  // Trustee → Trust edges (corporate hierarchy)
  const trusteeToTrust = useMemo(() => {
    return entities
      .filter((e) => e.parentEntityId)
      .map((e) => ({ parentId: e.parentEntityId as string, childId: e.id }));
  }, [entities]);

  // Group entities visually: PERSONAL_NAME first, then by role
  const orderedEntities = useMemo(() => {
    const order: LegalEntityRole[] = [
      'PERSONAL',
      'OPERATING',
      'HOLDING',
      'INVESTMENT',
      'SUPERANNUATION',
    ];
    return [...entities].sort((a, b) => {
      const ra = order.indexOf(a.role);
      const rb = order.indexOf(b.role);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [entities]);

  // Measure node positions for SVG connectors
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function measure() {
      if (!canvas) return;
      const cRect = canvas.getBoundingClientRect();
      const people: NodeRect[] = [];
      peopleRefs.current.forEach((el, id) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        people.push({
          id,
          cx: r.left - cRect.left + r.width / 2,
          top: r.top - cRect.top,
          bottom: r.top - cRect.top + r.height,
        });
      });
      const ents: NodeRect[] = [];
      entityRefs.current.forEach((el, id) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        ents.push({
          id,
          cx: r.left - cRect.left + r.width / 2,
          top: r.top - cRect.top,
          bottom: r.top - cRect.top + r.height,
        });
      });
      setNodeRects({
        width: cRect.width,
        height: canvas.scrollHeight,
        people,
        entities: ents,
      });
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [entities, members]);

  const handleChipClick = (href: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Tree canvas — desktop view (shown ≥md) */}
      <div
        ref={canvasRef}
        className="relative hidden rounded-3xl border border-slate-200/70 bg-gradient-to-br from-white/70 via-white/50 to-amber-50/30 p-6 shadow-sm ring-1 ring-slate-900/[0.04] backdrop-blur-sm md:block dark:border-slate-700/50 dark:from-slate-900/70 dark:via-slate-900/60 dark:to-slate-950/70"
      >
        {/* People row */}
        <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <TreePine className="h-3 w-3" />
          People
        </div>
        <div className="relative flex flex-wrap items-start justify-center gap-4 pb-2">
          {peopleAnchors.map((m, i) => (
            <PersonTile
              key={m.id}
              member={m.id === '__you__' ? null : m}
              motionDelay={i * 0.06}
              reducedMotion={reducedMotion}
              innerRef={(el) => {
                if (el) peopleRefs.current.set(m.id, el);
                else peopleRefs.current.delete(m.id);
              }}
            />
          ))}
        </div>

        {/* Spacer for the SVG connector layer */}
        <div className="h-12" aria-hidden />

        {/* Entity row */}
        <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Building2 className="h-3 w-3" />
          Legal entities
        </div>
        <div className="relative flex flex-wrap items-start justify-center gap-3">
          {orderedEntities.map((e, i) => (
            <EntityTile
              key={e.id}
              entity={e}
              motionDelay={0.15 + i * 0.06}
              reducedMotion={reducedMotion}
              onClick={() => onEntityClick(e)}
              onChipClick={handleChipClick}
              innerRef={(el) => {
                if (el) entityRefs.current.set(e.id, el);
                else entityRefs.current.delete(e.id);
              }}
            />
          ))}
        </div>

        {/* Add affordance */}
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white/60 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a trust, SMSF, or company
          </button>
        </div>

        {/* SVG connectors (drawn on top, pointer-events: none) */}
        <Connectors
          width={nodeRects.width}
          height={nodeRects.height}
          peopleNodes={nodeRects.people}
          entityNodes={nodeRects.entities}
          peopleToEntity={peopleToEntity}
          trusteeToTrust={trusteeToTrust}
        />
      </div>

      {/* Mobile fallback (<md) — stacked vertical view, no SVG */}
      <div className="space-y-3 md:hidden">
        <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <TreePine className="h-3 w-3" />
            People
          </div>
          <div className="flex flex-wrap gap-2">
            {peopleAnchors.map((m) => (
              <PersonTile
                key={m.id}
                member={m.id === '__you__' ? null : m}
                motionDelay={0}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {orderedEntities.map((e, i) => (
            <EntityTile
              key={e.id}
              entity={e}
              motionDelay={i * 0.04}
              reducedMotion={reducedMotion}
              onClick={() => onEntityClick(e)}
              onChipClick={handleChipClick}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
        >
          <Plus className="h-4 w-4" />
          Add a trust, SMSF, or company
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 px-2 text-[10px] text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <ArrowRight className="h-3 w-3 text-indigo-500" />
          ownership
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-px w-4 border-t border-dashed border-fuchsia-400" />
          corporate trustee
        </span>
        {(['PERSONAL', 'OPERATING', 'HOLDING', 'INVESTMENT', 'SUPERANNUATION'] as LegalEntityRole[]).map(
          (r) => (
            <span key={r} className="inline-flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-full ${ROLE_PALETTE[r].iconBg} ring-1 ring-slate-300 dark:ring-slate-700`}
              />
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
