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
  LegalEntityRole,
  WizardRelationshipType,
  RelationshipInput,
  LEGAL_ENTITY_TYPE_LABELS,
  generateId,
  type StepCommitFn,
} from '../types';
import { WizardStepShell } from '../primitives';
import { isPersistedId } from '@/lib/onboarding/entitiesSync';
import { syncRelationships } from '@/lib/onboarding/relationshipsSync';
import { roleTemplateFor } from '@/lib/entity-graph/roleTemplates';
import '@/styles/wizard-animations.css';

// =============================================================================
// ROLE CONFIG — the load-bearing edges per entity type
// =============================================================================

const isIndividualType = (t: LegalEntityType): boolean =>
  t === 'PERSONAL_NAME' || t === 'INDIVIDUAL';
const isCompanyType = (t: LegalEntityType): boolean => t === 'COMPANY';

interface RoleDef {
  type: WizardRelationshipType;
  label: string;
  singular: string;
  /** Which entity types may fill this role (the `from` candidates). */
  candidate: (t: LegalEntityType) => boolean;
  /** Plain-English hint shown under the role. */
  hint: string;
  /** Phase 47 F4 — optional roles sit behind the "More detail" disclosure. */
  optional: boolean;
}

const isCompanyFamilyType = (t: LegalEntityType): boolean =>
  t === 'COMPANY' || t === 'FOREIGN_COMPANY';
const isPersonOrCompany = (t: LegalEntityType): boolean =>
  isIndividualType(t) || isCompanyFamilyType(t);

/** Per-edge-type candidate predicates + warm hints (wizard-presentation
 * concerns layered over the canonical templates). */
const ROLE_PRESENTATION: Partial<
  Record<WizardRelationshipType, { singular: string; candidate: (t: LegalEntityType) => boolean; hint: string }>
> = {
  DIRECTOR_OF: { singular: 'director', candidate: isIndividualType, hint: 'The people who run it.' },
  SHAREHOLDER_OF: { singular: 'shareholder', candidate: () => true, hint: 'Who holds the shares — a person or another entity.' },
  SECRETARY_OF: { singular: 'secretary', candidate: isIndividualType, hint: 'The company secretary, if appointed.' },
  TRUSTEE_OF: { singular: 'trustee', candidate: isPersonOrCompany, hint: 'Who holds and administers it — a person or a company.' },
  BENEFICIARY_OF: { singular: 'beneficiary', candidate: () => true, hint: 'Who may receive distributions or benefits.' },
  UNITHOLDER_OF: { singular: 'unitholder', candidate: () => true, hint: 'Who holds the units.' },
  MEMBER_OF: { singular: 'member', candidate: isIndividualType, hint: 'The members.' },
  PARTNER_OF: { singular: 'partner', candidate: () => true, hint: 'The partners — people or entities.' },
  OPERATES_AS_SOLE_TRADER: { singular: 'owner', candidate: isIndividualType, hint: 'The person operating under this ABN.' },
  SETTLOR_OF: { singular: 'settlor', candidate: isIndividualType, hint: 'Who settled the trust (then arm\u2019s-length).' },
  APPOINTOR_OF: { singular: 'appointor', candidate: isPersonOrCompany, hint: 'Can usually appoint or remove the trustee.' },
  GUARDIAN_OF: { singular: 'guardian', candidate: isPersonOrCompany, hint: 'Consent required for certain trustee actions.' },
  EXECUTOR_OF: { singular: 'executor', candidate: isPersonOrCompany, hint: 'Administers the estate under the will.' },
  ADMINISTRATOR_OF: { singular: 'administrator', candidate: isPersonOrCompany, hint: 'Administers an intestate estate.' },
};

const WIZARD_EDGE_TYPES = new Set<string>([
  'TRUSTEE_OF', 'DIRECTOR_OF', 'SHAREHOLDER_OF', 'BENEFICIARY_OF',
  'UNITHOLDER_OF', 'MEMBER_OF', 'PARTNER_OF', 'OPERATES_AS_SOLE_TRADER',
  'SECRETARY_OF', 'SETTLOR_OF', 'APPOINTOR_OF', 'GUARDIAN_OF',
  'EXECUTOR_OF', 'ADMINISTRATOR_OF',
]);

/**
 * Phase 47 F4 — the load-bearing roles come from the canonical F2a
 * templates (`lib/entity-graph/roleTemplates.ts`), so the wizard and
 * the My Structure Entity File can never drift (§12.2). Required +
 * expected rows are the skeleton; `optional` rows render behind the
 * per-entity "More detail" disclosure. Roles outside the wizard's
 * capture set (e.g. POWER_HOLDER_OF) stay My-Structure-only.
 */
function rolesForEntityType(type: LegalEntityType): RoleDef[] {
  const defs: RoleDef[] = [];
  for (const row of roleTemplateFor(type)) {
    for (const t of row.anyOf) {
      if (!WIZARD_EDGE_TYPES.has(t)) continue;
      const pres = ROLE_PRESENTATION[t as WizardRelationshipType];
      if (!pres) continue;
      defs.push({
        type: t as WizardRelationshipType,
        label: row.anyOf.length > 1 ? relationLabel(t) : row.label,
        singular: pres.singular,
        candidate: pres.candidate,
        hint: pres.hint,
        optional: row.requirement === 'optional',
      });
    }
  }
  return defs;
}

function relationLabel(t: string): string {
  return t.replace(/_OF$|_FOR$/, '').replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()) + 's';
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
  // Phase 47 F4 — optional roles (secretary / settlor / appointor /
  // guardian) sit behind "More detail" so the default flow stays the
  // light skeleton. Auto-opens if any optional role already has edges.
  const primaryRoles = roles.filter((r) => !r.optional);
  const optionalRoles = roles.filter((r) => r.optional);
  const optionalHasEdges = optionalRoles.some((role) =>
    edgesForEntity.some((r) => r.type === role.type),
  );
  const [moreDetail, setMoreDetail] = useState(optionalHasEdges);

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
          {[...primaryRoles, ...(moreDetail ? optionalRoles : [])].map((role) => {
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
          {/* Phase 47 F4 — optional roles behind one quiet tap.
              "Fine-tune anytime in My Structure" is the contract. */}
          {optionalRoles.length > 0 && !moreDetail && (
            <button
              type="button"
              onClick={() => setMoreDetail(true)}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              More detail — secretary, settlor, appointor…
            </button>
          )}
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

  // Reza spot-check fix (2026-06-13): PEOPLE must be pickable for roles
  // — he couldn't nominate himself or Newsha as beneficiaries because
  // the wizard's candidate pool only carried structure entities. The
  // user's PERSONAL_NAME entity ("You") + any INDIVIDUAL entities are
  // fetched with their REAL ids (auto-created server-side at signup /
  // by the ownership picker), so the relationship sync persists edges
  // directly. A quick "Add a person" creates an INDIVIDUAL on the spot.
  const [people, setPeople] = useState<EntityInput[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [addingPerson, setAddingPerson] = useState(false);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/entities', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: Array<{ id: string; name: string; type: LegalEntityType }>;
        };
        if (cancelled) return;
        setPeople(
          (json.data ?? [])
            .filter((r) => r.type === 'PERSONAL_NAME' || r.type === 'INDIVIDUAL')
            .map((r) => ({
              id: r.id,
              name: r.type === 'PERSONAL_NAME' ? `You (${r.name})` : r.name,
              type: r.type,
              role: 'PERSONAL' as LegalEntityRole,
            })),
        );
      } catch {
        // People stay empty — the chips simply don't render.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function addPerson() {
    const name = newPersonName.trim();
    if (!token || !name) return;
    setAddingPerson(true);
    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type: 'INDIVIDUAL', role: 'PERSONAL' }),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: { id?: string; name?: string } };
      const created = json.data;
      if (res.ok && created?.id) {
        setPeople((prev) => [
          ...prev,
          { id: created.id!, name: created.name ?? name, type: 'INDIVIDUAL', role: 'PERSONAL' as LegalEntityRole },
        ]);
        setNewPersonName('');
      }
    } finally {
      setAddingPerson(false);
    }
  }

  // The candidate pool every wiring card picks from: wizard entities +
  // persisted people (deduped by id).
  const candidatePool = useMemo(() => {
    const seen = new Set(data.entities.map((e) => e.id));
    return [...data.entities, ...people.filter((p) => !seen.has(p.id))];
  }, [data.entities, people]);

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
                allEntities={candidatePool}
                relationships={data.relationships}
                onToggle={toggle}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              placeholder="Add a person (e.g. your spouse) so you can pick them above"
              className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <button
              type="button"
              onClick={() => void addPerson()}
              disabled={addingPerson || newPersonName.trim().length === 0}
              className="h-9 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white disabled:opacity-40"
            >
              {addingPerson ? 'Adding…' : 'Add person'}
            </button>
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
