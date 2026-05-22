'use client';

/**
 * RelationshipsStep — Phase 44 Part 1d
 *
 * "Who runs what" — the relationship-skeleton sub-step. Sits straight
 * after the entity step and is shown only when the user has at least one
 * non-personal entity (a personal-name-only user never sees it —
 * `getStepsForProfile` filters it out).
 *
 * It captures a working-graph skeleton (PHASE_44_ENTITY_GRAPH.md §11,
 * Q3): per non-personal entity, the load-bearing edges for that entity
 * type — directors + shareholders for a company, trustee + beneficiaries
 * for a trust, members + trustee for an SMSF, and so on.
 *
 * Behaviour-psychology / growth lens (CLAUDE.md §0): onboarding friction
 * costs activation. So every entity card is collapsed by default, the
 * whole step is optional, and the copy makes clear it is finishable
 * later in My Structure — Continue is never blocked. A failed write is
 * best-effort (never traps the user — see `relationshipsSync`).
 *
 * On Continue: the skeleton is persisted to the real `EntityRelationship`
 * table via the Part 1c `/api/entities/relationships` route. The entity
 * step has already persisted its entities, so the ids wired here are
 * real DB ids.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Crown,
  Landmark,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronRight,
  Link2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  WizardData,
  EntityInput,
  LegalEntityType,
  WizardRelationshipType,
  RelationshipInput,
  LEGAL_ENTITY_TYPE_LABELS,
  generateId,
  type StepCommitFn,
} from '../types';
import { WizardStepShell } from '../primitives';
import { isPersistedId } from '@/lib/onboarding/entitiesSync';
import { syncRelationships } from '@/lib/onboarding/relationshipsSync';
import '@/styles/wizard-animations.css';

// =============================================================================
// ROLE CONFIG — the load-bearing edges per entity type
// =============================================================================

const isIndividualType = (t: LegalEntityType): boolean => t === 'PERSONAL_NAME';
const isCompanyType = (t: LegalEntityType): boolean => t === 'COMPANY';

interface RoleDef {
  type: WizardRelationshipType;
  label: string;
  singular: string;
  /** Which entity types may fill this role (the `from` candidates). */
  candidate: (t: LegalEntityType) => boolean;
  /** Plain-English hint shown under the role. */
  hint: string;
}

/** The load-bearing roles to capture for a given structure type (§6.2). */
function rolesForEntityType(type: LegalEntityType): RoleDef[] {
  switch (type) {
    case 'COMPANY':
      return [
        {
          type: 'DIRECTOR_OF',
          label: 'Directors',
          singular: 'director',
          candidate: isIndividualType,
          hint: 'The people who run the company.',
        },
        {
          type: 'SHAREHOLDER_OF',
          label: 'Shareholders',
          singular: 'shareholder',
          candidate: () => true,
          hint: 'Who holds the shares — a person or another entity.',
        },
      ];
    case 'DISCRETIONARY_TRUST':
      return [
        {
          type: 'TRUSTEE_OF',
          label: 'Trustee',
          singular: 'trustee',
          candidate: (t) => isIndividualType(t) || isCompanyType(t),
          hint: 'Who holds and administers the trust — a person or a company.',
        },
        {
          type: 'BENEFICIARY_OF',
          label: 'Beneficiaries',
          singular: 'beneficiary',
          candidate: () => true,
          hint: 'Who may receive distributions from the trust.',
        },
      ];
    case 'UNIT_TRUST':
      return [
        {
          type: 'TRUSTEE_OF',
          label: 'Trustee',
          singular: 'trustee',
          candidate: (t) => isIndividualType(t) || isCompanyType(t),
          hint: 'Who holds and administers the trust.',
        },
        {
          type: 'UNITHOLDER_OF',
          label: 'Unitholders',
          singular: 'unitholder',
          candidate: () => true,
          hint: 'Who holds the units.',
        },
      ];
    case 'SMSF':
      return [
        {
          type: 'MEMBER_OF',
          label: 'Members',
          singular: 'member',
          candidate: isIndividualType,
          hint: 'The fund members (1–6).',
        },
        {
          type: 'TRUSTEE_OF',
          label: 'Trustee',
          singular: 'trustee',
          candidate: (t) => isIndividualType(t) || isCompanyType(t),
          hint: 'The corporate trustee, or the individual trustees.',
        },
      ];
    case 'PARTNERSHIP':
      return [
        {
          type: 'PARTNER_OF',
          label: 'Partners',
          singular: 'partner',
          candidate: () => true,
          hint: 'The partners — people or entities.',
        },
      ];
    case 'SOLE_TRADER':
      return [
        {
          type: 'OPERATES_AS_SOLE_TRADER',
          label: 'Operated by',
          singular: 'owner',
          candidate: isIndividualType,
          hint: 'The person operating under this ABN.',
        },
      ];
    default:
      return [];
  }
}

function entityTypeIcon(type: LegalEntityType) {
  switch (type) {
    case 'COMPANY':
      return <Building2 className="h-5 w-5" />;
    case 'DISCRETIONARY_TRUST':
      return <Crown className="h-5 w-5" />;
    case 'UNIT_TRUST':
      return <Layers className="h-5 w-5" />;
    case 'SMSF':
      return <Landmark className="h-5 w-5" />;
    case 'PARTNERSHIP':
    case 'SOLE_TRADER':
      return <Briefcase className="h-5 w-5" />;
    default:
      return <Building2 className="h-5 w-5" />;
  }
}

// =============================================================================
// ENTITY CARD
// =============================================================================

interface EntityWiringCardProps {
  entity: EntityInput;
  allEntities: EntityInput[];
  relationships: RelationshipInput[];
  onToggle: (fromId: string, toId: string, type: WizardRelationshipType) => void;
}

function EntityWiringCard({
  entity,
  allEntities,
  relationships,
  onToggle,
}: EntityWiringCardProps) {
  const roles = useMemo(() => rolesForEntityType(entity.type), [entity.type]);
  const edgesForEntity = relationships.filter((r) => r.toEntityTempId === entity.id);
  const [expanded, setExpanded] = useState(false);

  // Collapsed summary — "1 trustee · 3 beneficiaries" or "Not wired yet".
  const summary = roles
    .map((role) => {
      const n = edgesForEntity.filter((r) => r.type === role.type).length;
      if (n === 0) return null;
      return `${n} ${n === 1 ? role.singular : role.label.toLowerCase()}`;
    })
    .filter((s): s is string => s !== null)
    .join(' · ');

  return (
    <div className="wz-section">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
            {entityTypeIcon(entity.type)}
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {entity.name || 'Untitled entity'}
            </h4>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {summary || (
                <span className="italic text-slate-400">Not wired yet — optional</span>
              )}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3 dark:border-slate-700/50">
          {roles.map((role) => {
            const candidates = allEntities.filter(
              (e) => e.id !== entity.id && role.candidate(e.type),
            );
            return (
              <div key={role.type}>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {role.label}
                </p>
                <p className="mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {role.hint}
                </p>
                {candidates.length === 0 ? (
                  <p className="text-[11px] italic text-slate-400">
                    No-one to choose yet — add a person or entity in the previous step.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.map((c) => {
                      const on = relationships.some(
                        (r) =>
                          r.fromEntityTempId === c.id &&
                          r.toEntityTempId === entity.id &&
                          r.type === role.type,
                      );
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onToggle(c.id, entity.id, role.type)}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition ${
                            on
                              ? 'border-indigo-500 bg-indigo-600 text-white'
                              : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300'
                          }`}
                        >
                          {on && <Check className="h-3 w-3" />}
                          {c.name || 'Untitled'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface RelationshipsStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  registerStepCommit?: (fn: StepCommitFn | null) => void;
}

export function RelationshipsStep({
  data,
  onUpdate,
  registerStepCommit,
}: RelationshipsStepProps) {
  const { token } = useAuth();
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const nonPersonalEntities = useMemo(
    () => data.entities.filter((e) => e.type !== 'PERSONAL_NAME'),
    [data.entities],
  );

  // Pre-seed TRUSTEE_OF edges from the trustee links the user already set
  // in the entity step (`parentEntityTempId`) — no double entry. Runs once.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (data.relationships.length > 0) return;
    const seeded: RelationshipInput[] = data.entities
      .filter(
        (e) =>
          e.parentEntityTempId &&
          isPersistedId(e.parentEntityTempId) &&
          isPersistedId(e.id),
      )
      .map((e) => ({
        id: generateId(),
        fromEntityTempId: e.parentEntityTempId as string,
        toEntityTempId: e.id,
        type: 'TRUSTEE_OF' as WizardRelationshipType,
      }));
    if (seeded.length > 0) onUpdate({ relationships: seeded });
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register the commit — persist the skeleton via the Part 1c route.
  useEffect(() => {
    if (!registerStepCommit) return;
    const commit: StepCommitFn = async () => {
      const result = await syncRelationships(token, dataRef.current.relationships);
      if (result.failed > 0) {
        // Best-effort: never trap the user in onboarding. The structure is
        // saved; the missed edges are finishable in My Structure (§11).
        console.warn(
          `Relationship skeleton: ${result.failed} edge(s) failed to save — ` +
            'finishable later in My Structure.',
        );
      }
    };
    registerStepCommit(commit);
    return () => registerStepCommit(null);
  }, [registerStepCommit, token]);

  const toggle = (
    fromId: string,
    toId: string,
    type: WizardRelationshipType,
  ) => {
    const existing = data.relationships.find(
      (r) =>
        r.fromEntityTempId === fromId &&
        r.toEntityTempId === toId &&
        r.type === type,
    );
    if (existing) {
      onUpdate({
        relationships: data.relationships.filter((r) => r.id !== existing.id),
      });
    } else {
      onUpdate({
        relationships: [
          ...data.relationships,
          { id: generateId(), fromEntityTempId: fromId, toEntityTempId: toId, type },
        ],
      });
    }
  };

  return (
    <WizardStepShell
      icon={<Link2 className="h-8 w-8" strokeWidth={1.5} />}
      title="Who runs what"
      subtitle="Map the load-bearing relationships in your structure — who's a director, trustee, shareholder, beneficiary or member. This is optional and you can finish it anytime in My Structure."
    >
      {nonPersonalEntities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Nothing to wire — tap <span className="font-medium">Continue</span>.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2 rounded-xl border border-indigo-200/70 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-800 dark:border-indigo-800/40 dark:bg-indigo-900/20 dark:text-indigo-200">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Tap an entity to expand it, then tap the people and entities in each
              role. A rough sketch is fine — refine it later on the structure canvas.
            </span>
          </div>

          <div className="space-y-3">
            {nonPersonalEntities.map((entity) => (
              <EntityWiringCard
                key={entity.id}
                entity={entity}
                allEntities={data.entities}
                relationships={data.relationships}
                onToggle={toggle}
              />
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            {data.relationships.length > 0
              ? `${data.relationships.length} relationship${
                  data.relationships.length === 1 ? '' : 's'
                } sketched — saved when you continue.`
              : 'No relationships yet — you can skip this and add them later.'}
          </p>
        </>
      )}
    </WizardStepShell>
  );
}

export default RelationshipsStep;
