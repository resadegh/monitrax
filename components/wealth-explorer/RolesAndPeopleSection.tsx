/**
 * RolesAndPeopleSection — Phase 47 F2: the "Entity File" roles editor.
 *
 * Restores the relationship add/end capability deleted with the legacy
 * EntityCanvas (2026-05-31) — now in the Wealth Universe's dark-glass
 * vocabulary, driven by the F2a per-type role templates
 * (`lib/entity-graph/roleTemplates.ts`): a company card shows
 * Director / Shareholder / Secretary rows, a trust card shows
 * Trustee / Beneficiary rows — exactly like the advisor org-chart.
 *
 * - Filled rows render counterpart chips with an end-role affordance
 *   ("Sarah resigned as director" closes the edge — history is kept).
 * - Missing REQUIRED/EXPECTED rows render quiet dashed invitations
 *   ("Add a director") — celebration of the next action, never red.
 * - "More roles" opens the full 19-type grammar (grouped per
 *   `graphMeta.RELATIONSHIP_TYPE_GROUPS`).
 * - The Add dialog previews §6.2 validity LIVE via the pure
 *   `classifyEdge` (same contract as the deleted 1c dialog):
 *   NON_COMPLIANT records with an amber note; IMPOSSIBLE blocks.
 * - "Actually held for…" lists beneficial-ownership overrides on the
 *   entity's assets (the LRBA case: legal title bare trustee,
 *   beneficially the SMSF) and can add one.
 * - Completeness chip ("Structure file 2/3") — invitation framing.
 *
 * Writes go through the canonical Phase 44 routes
 * (`/api/entities/relationships*`, `/api/entities/beneficial-ownership`)
 * via the retained `entityGraphClient` — this component computes
 * nothing financial (§8.3/§8.4).
 *
 * Surface SoT: Stitch screen `88f4ac2d8f6544bdbacb90fbb4bf9072`
 * artefact `.stitch/designs/phase47-f2/entity-file-roles-people-dark.{html,png}`.
 * Spec: docs/blueprint/PHASE_47_ENTITY_OWNERSHIP_FABRIC.md §4 Stage F (F2/F2a).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Building2,
  User,
} from 'lucide-react';
import type {
  EntityRelationshipType,
  BeneficiaryClass,
  LegalEntityType,
  BeneficialOwnershipBasis,
} from '@prisma/client';
import { useAuth } from '@/lib/context/AuthContext';
import {
  fetchEntityGraph,
  createRelationshipRequest,
  endRelationshipRequest,
  extractApiError,
  type CanvasGraph,
  type CanvasEdge,
} from '@/components/entities/canvas/entityGraphClient';
import {
  relationshipTypeMeta,
  RELATIONSHIP_TYPE_GROUPS,
} from '@/components/entities/canvas/graphMeta';
import { classifyEdge } from '@/lib/entity-graph/validityMatrix';
import type { GraphEdge } from '@/lib/entity-graph/types';
import {
  roleTemplateFor,
  roleCompleteness,
  type RoleTemplateRow,
} from '@/lib/entity-graph/roleTemplates';
import type { WealthGraphAsset } from '@/lib/services/wealthGraphService';
import TrustDistributionsSection from './TrustDistributionsSection';

// =============================================================================
// shared option sets
// =============================================================================

const FAMILY_RELATIONS = ['SPOUSE', 'DE_FACTO', 'CHILD', 'PARENT', 'SIBLING', 'OTHER_RELATIVE'] as const;
const BENEFICIARY_CLASSES: readonly BeneficiaryClass[] = ['PRIMARY', 'GENERAL', 'DEFAULT', 'NAMED'] as const;
const BASIS_OPTIONS: ReadonlyArray<{ value: BeneficialOwnershipBasis; label: string }> = [
  { value: 'BARE_TRUST', label: 'Bare trust' },
  { value: 'NOMINEE', label: 'Nominee' },
  { value: 'CUSTODIAN', label: 'Custodian' },
  { value: 'RESULTING_TRUST', label: 'Resulting trust' },
  { value: 'OTHER', label: 'Other' },
];

function prettify(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
}

interface OverrideRow {
  id: string;
  legalOwnerEntityId: string;
  beneficialOwnerEntityId: string;
  ownedObjectType: string;
  ownedObjectId: string;
  basis: BeneficialOwnershipBasis;
}

// =============================================================================
// the section
// =============================================================================

export default function RolesAndPeopleSection({
  entityId,
  entityType,
  entityName,
  assets = [],
}: {
  entityId: string;
  entityType: LegalEntityType;
  entityName: string;
  /** The entity's directly-held assets (in memory via the panel). */
  assets?: WealthGraphAsset[];
}) {
  const { token } = useAuth();
  const [graph, setGraph] = useState<CanvasGraph | null>(null);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addRole, setAddRole] = useState<{ preset?: RoleTemplateRow } | null>(null);
  const [addHeldFor, setAddHeldFor] = useState(false);
  const [busyEdgeId, setBusyEdgeId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const [g, ovRes] = await Promise.all([
        fetchEntityGraph(token),
        fetch('/api/entities/beneficial-ownership', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      setGraph(g);
      if (ovRes.ok) {
        const json = (await ovRes.json()) as { data?: OverrideRow[] };
        setOverrides(json.data ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const nodesById = useMemo(
    () => Object.fromEntries((graph?.nodes ?? []).map(n => [n.id, n])),
    [graph],
  );

  // Active edges pointing INTO this entity (counterpart → entity).
  const inboundEdges = useMemo(
    () =>
      (graph?.edges ?? []).filter(
        e => e.toEntityId === entityId && e.effectiveTo == null,
      ),
    [graph, entityId],
  );

  const template = roleTemplateFor(entityType);
  const completeness = useMemo(
    () => roleCompleteness(entityType, new Set(inboundEdges.map(e => e.type))),
    [entityType, inboundEdges],
  );

  // Edges shown under template rows; the rest land in "Other roles".
  const templateTypes = useMemo(
    () => new Set(template.flatMap(r => r.anyOf)),
    [template],
  );
  const otherEdges = inboundEdges.filter(e => !templateTypes.has(e.type));

  // Stage D capture (Reza spot-check 2026-06-13) — distributing trusts
  // get the per-FY Distributions section. The PERCENTAGES live on the
  // trustee's yearly resolution, never on the beneficiary roles — a
  // discretionary trust's defining feature.
  const DISTRIBUTING_TRUST_TYPES: ReadonlySet<string> = new Set([
    'DISCRETIONARY_TRUST',
    'UNIT_TRUST',
    'FIXED_TRUST',
    'HYBRID_TRUST',
    'TESTAMENTARY_TRUST',
  ]);
  const isDistributingTrust = DISTRIBUTING_TRUST_TYPES.has(entityType);
  const distributionBeneficiaries = useMemo(
    () =>
      inboundEdges
        .filter(e => e.type === 'BENEFICIARY_OF' || e.type === 'UNITHOLDER_OF')
        .map(e => ({ id: e.fromEntityId, name: e.fromEntityName })),
    [inboundEdges],
  );

  const myOverrides = overrides.filter(o => o.legalOwnerEntityId === entityId);

  async function endRole(edge: CanvasEdge) {
    if (!token) return;
    setBusyEdgeId(edge.id);
    try {
      await endRelationshipRequest(token, edge.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to end the role.');
    } finally {
      setBusyEdgeId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-[11px] text-white/45">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading roles…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
            Roles &amp; people
          </div>
          {completeness.total > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] tabular-nums text-white/70"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              Structure file {completeness.filled}/{completeness.total}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-2 flex items-start gap-2 rounded-xl p-3 text-[11px]" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <AlertTriangle size={13} color="#FBBF24" strokeWidth={1.5} />
            <span className="text-amber-200/80">{error}</span>
          </div>
        )}

        <div className="space-y-3">
          {template.map(rowDef => {
            const rowEdges = inboundEdges.filter(e => rowDef.anyOf.includes(e.type));
            return (
              <div key={rowDef.key}>
                <div className="mb-1 text-[12px] font-medium text-white/85">{rowDef.label}</div>
                {rowEdges.length > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {rowEdges.map(e => (
                        <RoleChip
                          key={e.id}
                          edge={e}
                          nodeType={nodesById[e.fromEntityId]?.type}
                          busy={busyEdgeId === e.id}
                          onEnd={() => void endRole(e)}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => setAddRole({ preset: rowDef })}
                        className="rounded-full px-2 py-1 text-[11px] text-white/45 transition hover:text-white/75"
                        style={{ border: '1px dashed rgba(255,255,255,0.15)' }}
                      >
                        + Add
                      </button>
                    </div>
                    {/* Phase 47 F3 — equity edges expand to their parcels
                        ("500 ordinary · acquired 12 Mar 2021"). */}
                    {rowEdges
                      .filter(e => e.type === 'SHAREHOLDER_OF' || e.type === 'UNITHOLDER_OF')
                      .map(e => (
                        <EquityParcels key={`parcels-${e.id}`} edge={e} />
                      ))}
                  </>
                ) : (
                  // Empty — a quiet invitation, never a warning (F2a).
                  <button
                    type="button"
                    onClick={() => setAddRole({ preset: rowDef })}
                    className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] text-white/45 transition hover:text-white/70"
                    style={{ border: '1px dashed rgba(255,255,255,0.15)' }}
                  >
                    <Plus size={12} strokeWidth={1.5} />
                    {rowDef.addLabel}
                  </button>
                )}
              </div>
            );
          })}

          {otherEdges.length > 0 && (
            <div>
              <div className="mb-1 text-[12px] font-medium text-white/85">Other roles</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {otherEdges.map(e => (
                  <RoleChip
                    key={e.id}
                    edge={e}
                    nodeType={nodesById[e.fromEntityId]?.type}
                    busy={busyEdgeId === e.id}
                    onEnd={() => void endRole(e)}
                    showType
                  />
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setAddRole({})}
            className="text-[11px] font-medium text-white/50 transition hover:text-white/80"
          >
            More roles →
          </button>
          {entityType === 'DISCRETIONARY_TRUST' && (
            // Financial-adviser teaching line (Reza 2026-06-13) — fixed
            // percentages are not a thing for discretionary
            // beneficiaries; the yearly split is.
            <p className="text-[11px] leading-relaxed text-white/45">
              Beneficiaries don&rsquo;t hold fixed shares in a family trust —
              the trustee decides each year&rsquo;s split. Record it under
              Distributions below.
            </p>
          )}
        </div>
      </div>

      {isDistributingTrust && (
        <TrustDistributionsSection
          trustEntityId={entityId}
          beneficiaries={distributionBeneficiaries}
        />
      )}

      {/* Beneficial ownership — "this entity holds X, but it's really
          Y's" (the LRBA shape). Only offered when the entity holds
          assets the override could attach to. */}
      {(myOverrides.length > 0 || assets.length > 0) && (
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
            Actually held for
          </div>
          <div className="space-y-1.5">
            {myOverrides.map(o => {
              const asset = assets.find(a => a.id === o.ownedObjectId);
              const beneficial = nodesById[o.beneficialOwnerEntityId];
              return (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="min-w-0 text-[12px] text-white/85">
                    <span className="font-medium">{asset?.name ?? prettify(o.ownedObjectType)}</span>
                    <span className="text-white/50"> → held for </span>
                    <span className="font-medium">{beneficial?.name ?? 'another entity'}</span>
                  </div>
                  <span
                    className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ background: 'rgba(251,191,36,0.1)', color: '#FCD34D', border: '1px solid rgba(251,191,36,0.25)' }}
                  >
                    {BASIS_OPTIONS.find(b => b.value === o.basis)?.label ?? prettify(o.basis)}
                  </span>
                </div>
              );
            })}
            {assets.length > 0 && (
              <button
                type="button"
                onClick={() => setAddHeldFor(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] text-white/45 transition hover:text-white/70"
                style={{ border: '1px dashed rgba(255,255,255,0.15)' }}
              >
                <Plus size={12} strokeWidth={1.5} />
                Record that something here is held for someone else
              </button>
            )}
          </div>
        </div>
      )}

      {addRole && graph && (
        <AddRoleDialog
          graph={graph}
          entityId={entityId}
          entityType={entityType}
          entityName={entityName}
          preset={addRole.preset}
          onClose={() => setAddRole(null)}
          onSaved={() => {
            setAddRole(null);
            void reload();
          }}
        />
      )}
      {addHeldFor && graph && (
        <AddHeldForDialog
          graph={graph}
          entityId={entityId}
          assets={assets}
          onClose={() => setAddHeldFor(false)}
          onSaved={() => {
            setAddHeldFor(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// chip
// =============================================================================

function RoleChip({
  edge,
  nodeType,
  busy,
  onEnd,
  showType = false,
}: {
  edge: CanvasEdge;
  nodeType?: LegalEntityType;
  busy: boolean;
  onEnd: () => void;
  showType?: boolean;
}) {
  const isPerson = nodeType === 'INDIVIDUAL' || nodeType === 'PERSONAL_NAME';
  const Icon = isPerson ? User : Building2;
  return (
    <span
      className="group/chip inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-1 text-[11px] text-white/85"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(125,211,252,0.3)' }}
    >
      <Icon size={11} strokeWidth={1.5} className="text-sky-300/80" />
      <span className="max-w-[160px] truncate">{edge.fromEntityName}</span>
      {showType && (
        <span className="text-white/40">· {relationshipTypeMeta(edge.type).label}</span>
      )}
      {edge.familyRelation && (
        <span className="text-white/40">· {prettify(edge.familyRelation)}</span>
      )}
      <button
        type="button"
        aria-label={`End ${edge.fromEntityName}'s role`}
        title="End this role (keeps history)"
        onClick={onEnd}
        disabled={busy}
        className="flex h-4 w-4 items-center justify-center rounded-full text-white/35 transition hover:bg-white/10 hover:text-white/80"
      >
        {busy ? <Loader2 size={9} className="animate-spin" /> : <X size={9} strokeWidth={2} />}
      </button>
    </span>
  );
}

// =============================================================================
// add-role dialog (dark glass, live §6.2 validity)
// =============================================================================

function AddRoleDialog({
  graph,
  entityId,
  entityType,
  entityName,
  preset,
  onClose,
  onSaved,
}: {
  graph: CanvasGraph;
  entityId: string;
  entityType: LegalEntityType;
  entityName: string;
  preset?: RoleTemplateRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  // Type-aware suggestions (Reza 2026-06-12) — the entity's template
  // rows name the roles that make sense here; everything else stays
  // reachable under "All roles".
  const suggestedTypes = useMemo(
    () => [...new Set(roleTemplateFor(entityType).flatMap(r => r.anyOf))],
    [entityType],
  );
  const suggestedSet = useMemo(() => new Set(suggestedTypes), [suggestedTypes]);
  const [type, setType] = useState<EntityRelationshipType>(
    preset?.anyOf[0] ?? suggestedTypes[0] ?? 'DIRECTOR_OF',
  );
  const [counterpartId, setCounterpartId] = useState<string>('');
  const [newPersonName, setNewPersonName] = useState('');
  const [beneficiaryClass, setBeneficiaryClass] = useState<BeneficiaryClass | ''>('');
  const [familyRelation, setFamilyRelation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates = graph.nodes.filter(n => n.id !== entityId);
  const creatingNew = counterpartId === '__new__';

  // Live §6.2 preview — judge the candidate edge against the real graph
  // plus itself (the SMSF rules count graph edges). Pure client-side
  // call: classifyEdge has no I/O.
  const validity = useMemo(() => {
    if (!counterpartId || creatingNew) return null;
    const candidate: GraphEdge = {
      id: '__candidate__',
      fromEntityId: counterpartId,
      toEntityId: entityId,
      type,
      effectiveFrom: new Date(),
      effectiveTo: null,
      beneficiaryClass: (beneficiaryClass || null) as BeneficiaryClass | null,
      familyRelation: familyRelation || null,
      lprReason: null,
      appointorPower: [],
      powerType: null,
      powerSubject: null,
      structuralState: 'VALID',
      accountantVerified: false,
    };
    return classifyEdge(
      { nodes: graph.nodes, edges: [...graph.edges, candidate] },
      candidate,
      new Date(),
    );
  }, [graph, counterpartId, creatingNew, entityId, type, beneficiaryClass, familyRelation]);

  const blocked = validity?.state === 'IMPOSSIBLE_SYSTEM_ERROR';

  async function save() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      let fromId = counterpartId;
      if (creatingNew) {
        // Quick-create the person (D1 dedup lives server-side in the
        // ownership service; here a direct INDIVIDUAL create — the
        // entities API is idempotent per name only via user review).
        const res = await fetch('/api/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: newPersonName.trim(), type: 'INDIVIDUAL', role: 'PERSONAL' }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(extractApiError(json, res.status, 'Failed to add the person.'));
        const created = (json as { data?: { id?: string } }).data ?? (json as { id?: string });
        if (!created?.id) throw new Error('Person created but no id returned.');
        fromId = created.id;
      }
      await createRelationshipRequest(token, {
        fromEntityId: fromId,
        toEntityId: entityId,
        type,
        beneficiaryClass: type === 'BENEFICIARY_OF' ? ((beneficiaryClass || null) as BeneficiaryClass | null) : null,
        familyRelation: type === 'FAMILY_MEMBER_OF' ? familyRelation || null : null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add the role.');
      setSaving(false);
    }
  }

  const canSave =
    !saving &&
    !blocked &&
    (creatingNew ? newPersonName.trim().length > 0 : counterpartId.length > 0) &&
    (type !== 'FAMILY_MEMBER_OF' || familyRelation.length > 0);

  return (
    <DarkOverlay onClose={onClose} title={preset ? preset.addLabel : `Add a role on ${entityName}`}>
      {/* Role type — preset rows pin it; "More roles" offers the grammar */}
      {!preset || preset.anyOf.length > 1 ? (
        <div>
          <DarkLabel>Role</DarkLabel>
          <select
            value={type}
            onChange={e => setType(e.target.value as EntityRelationshipType)}
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {preset ? (
              preset.anyOf.map(t => (
                <option key={t} value={t} className="bg-slate-900">
                  {relationshipTypeMeta(t).label}
                </option>
              ))
            ) : (
              // Reza 2026-06-12: "if entity is SMSF only available
              // options for that entity is showing" — the F2a template
              // drives a suggested-first list; the full grammar stays
              // one optgroup away (guidance, never gates — §14.3).
              <>
                {suggestedTypes.length > 0 && (
                  <optgroup label="Suggested for this entity">
                    {suggestedTypes.map(t => (
                      <option key={t} value={t} className="bg-slate-900">
                        {relationshipTypeMeta(t).label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {RELATIONSHIP_TYPE_GROUPS.map(g => {
                  const rest = g.types.filter(t => !suggestedSet.has(t));
                  if (rest.length === 0) return null;
                  return (
                    <optgroup key={g.group} label={`All roles · ${g.group}`}>
                      {rest.map(t => (
                        <option key={t} value={t} className="bg-slate-900">
                          {relationshipTypeMeta(t).label}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </>
            )}
          </select>
        </div>
      ) : (
        <div className="text-[12px] text-white/60">
          Role: <span className="font-medium text-white/90">{relationshipTypeMeta(type).label}</span>
        </div>
      )}

      <div>
        <DarkLabel>Who</DarkLabel>
        <select
          value={counterpartId}
          onChange={e => setCounterpartId(e.target.value)}
          className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white outline-none"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <option value="" className="bg-slate-900">Choose a person or entity…</option>
          {candidates.map(n => (
            <option key={n.id} value={n.id} className="bg-slate-900">
              {n.name}
            </option>
          ))}
          <option value="__new__" className="bg-slate-900">+ Someone new…</option>
        </select>
        {creatingNew && (
          <input
            value={newPersonName}
            onChange={e => setNewPersonName(e.target.value)}
            placeholder="Their name"
            className="mt-2 w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white placeholder-white/30 outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          />
        )}
      </div>

      {type === 'BENEFICIARY_OF' && (
        <div>
          <DarkLabel>Beneficiary class (optional)</DarkLabel>
          <select
            value={beneficiaryClass}
            onChange={e => setBeneficiaryClass(e.target.value as BeneficiaryClass | '')}
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <option value="" className="bg-slate-900">Not sure</option>
            {BENEFICIARY_CLASSES.map(c => (
              <option key={c} value={c} className="bg-slate-900">{prettify(c)}</option>
            ))}
          </select>
        </div>
      )}

      {type === 'FAMILY_MEMBER_OF' && (
        <div>
          <DarkLabel>Relationship</DarkLabel>
          <select
            value={familyRelation}
            onChange={e => setFamilyRelation(e.target.value)}
            className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white outline-none"
            style={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <option value="" className="bg-slate-900">Choose…</option>
            {FAMILY_RELATIONS.map(r => (
              <option key={r} value={r} className="bg-slate-900">{prettify(r)}</option>
            ))}
          </select>
        </div>
      )}

      {/* Live §6.2 validity preview */}
      {validity && validity.issues.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl p-3 text-[11px]"
          style={
            blocked
              ? { background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }
              : { background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }
          }
        >
          <AlertTriangle size={13} color={blocked ? '#FB7185' : '#FBBF24'} strokeWidth={1.5} className="mt-0.5 flex-shrink-0" />
          <div className={blocked ? 'text-rose-200/90' : 'text-amber-200/80'}>
            {validity.issues.map(i => (
              <div key={i.code}>{i.message}</div>
            ))}
            {!blocked && (
              <div className="mt-1 text-amber-200/60">
                Recorded with a flag — Monitrax keeps a faithful record.
              </div>
            )}
          </div>
        </div>
      )}
      {validity && validity.issues.length === 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/90">
          <CheckCircle2 size={12} strokeWidth={1.5} /> Looks structurally valid
        </div>
      )}

      {error && (
        <div className="text-[11px] text-rose-300/90">{error}</div>
      )}

      <DialogActions onClose={onClose} onSave={() => void save()} canSave={canSave} saving={saving} saveLabel="Add role" />
    </DarkOverlay>
  );
}

// =============================================================================
// held-for dialog (beneficial-ownership override)
// =============================================================================

function AddHeldForDialog({
  graph,
  entityId,
  assets,
  onClose,
  onSaved,
}: {
  graph: CanvasGraph;
  entityId: string;
  assets: WealthGraphAsset[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const [assetId, setAssetId] = useState('');
  const [beneficialId, setBeneficialId] = useState('');
  const [basis, setBasis] = useState<BeneficialOwnershipBasis>('BARE_TRUST');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Map the wealth-graph asset kind to the override's ownedObjectType.
  const objectTypeFor = (kind: WealthGraphAsset['kind']): string => {
    switch (kind) {
      case 'property': return 'property';
      case 'loan': return 'loan';
      case 'account': return 'account';
      case 'investment-account': return 'investmentAccount';
      case 'super': return 'superannuationAccount';
      case 'asset': return 'asset';
    }
  };

  async function save() {
    if (!token) return;
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/entities/beneficial-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          legalOwnerEntityId: entityId,
          beneficialOwnerEntityId: beneficialId,
          ownedObjectType: objectTypeFor(asset.kind),
          ownedObjectId: asset.id,
          basis,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(extractApiError(json, res.status, 'Failed to record beneficial ownership.'));
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record beneficial ownership.');
      setSaving(false);
    }
  }

  const canSave = !saving && assetId.length > 0 && beneficialId.length > 0;

  return (
    <DarkOverlay onClose={onClose} title="Actually held for…">
      <p className="text-[11px] leading-relaxed text-white/50">
        Legal title stays where it is — this records that the benefit
        belongs to someone else (a bare trust, nominee or custodian
        arrangement).
      </p>
      <div>
        <DarkLabel>Which holding</DarkLabel>
        <select
          value={assetId}
          onChange={e => setAssetId(e.target.value)}
          className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white outline-none"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <option value="" className="bg-slate-900">Choose…</option>
          {assets.map(a => (
            <option key={a.id} value={a.id} className="bg-slate-900">{a.name}</option>
          ))}
        </select>
      </div>
      <div>
        <DarkLabel>Held for</DarkLabel>
        <select
          value={beneficialId}
          onChange={e => setBeneficialId(e.target.value)}
          className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white outline-none"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <option value="" className="bg-slate-900">Choose the beneficial owner…</option>
          {graph.nodes.filter(n => n.id !== entityId).map(n => (
            <option key={n.id} value={n.id} className="bg-slate-900">{n.name}</option>
          ))}
        </select>
      </div>
      <div>
        <DarkLabel>Basis</DarkLabel>
        <select
          value={basis}
          onChange={e => setBasis(e.target.value as BeneficialOwnershipBasis)}
          className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white outline-none"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          {BASIS_OPTIONS.map(b => (
            <option key={b.value} value={b.value} className="bg-slate-900">{b.label}</option>
          ))}
        </select>
      </div>
      {error && <div className="text-[11px] text-rose-300/90">{error}</div>}
      <DialogActions onClose={onClose} onSave={() => void save()} canSave={canSave} saving={saving} saveLabel="Record" />
    </DarkOverlay>
  );
}

// =============================================================================
// dark dialog shell
// =============================================================================

function DarkOverlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl p-5"
        style={{
          background: 'rgba(13, 18, 32, 0.97)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-[15px] font-semibold text-white">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10"
          >
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DarkLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[11px] font-medium text-white/60">{children}</div>
  );
}

function DialogActions({
  onClose,
  onSave,
  canSave,
  saving,
  saveLabel,
}: {
  onClose: () => void;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
  saveLabel: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg px-3 py-1.5 text-[12px] text-white/60 transition hover:text-white/90"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-white transition disabled:opacity-40"
        style={{ background: '#059669' }}
      >
        {saving && <Loader2 size={12} className="animate-spin" />}
        {saveLabel}
      </button>
    </div>
  );
}

// =============================================================================
// equity parcels — Phase 47 F3 ("[500 ORD]" becomes data)
// =============================================================================

interface ParcelRow {
  id: string;
  shareClass: string;
  quantity: number;
  paidPerUnit: number;
  acquiredAt: string;
  disposedAt: string | null;
}

const SHARE_CLASS_OPTIONS = [
  { value: 'ORDINARY', label: 'Ordinary' },
  { value: 'PREFERENCE', label: 'Preference' },
  { value: 'REDEEMABLE_PREFERENCE', label: 'Redeemable preference' },
  { value: 'A_CLASS', label: 'A class' },
  { value: 'B_CLASS', label: 'B class' },
  { value: 'C_CLASS', label: 'C class' },
  { value: 'OTHER', label: 'Other' },
] as const;

/**
 * Per-edge parcel block: lazy-loads on expand, lists active + disposed
 * parcels, adds via an inline form, disposes (never deletes — CGT
 * history survives; §12.11-guarded server-side).
 */
function EquityParcels({ edge }: { edge: CanvasEdge }) {
  const { token } = useAuth();
  const unitWord = edge.type === 'UNITHOLDER_OF' ? 'units' : 'shares';
  const [open, setOpen] = useState(false);
  const [parcels, setParcels] = useState<ParcelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ shareClass: 'ORDINARY', quantity: '', paidPerUnit: '', acquiredAt: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/entities/relationships/${edge.id}/parcels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(json, res.status, 'Failed to load parcels.'));
      setParcels((json as { data?: ParcelRow[] }).data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load parcels.');
    }
  }, [token, edge.id]);

  useEffect(() => {
    if (open && parcels === null) void load();
  }, [open, parcels, load]);

  async function addParcel() {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/entities/relationships/${edge.id}/parcels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shareClass: form.shareClass,
          quantity: Number(form.quantity),
          paidPerUnit: form.paidPerUnit ? Number(form.paidPerUnit) : undefined,
          acquiredAt: form.acquiredAt,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(json, res.status, 'Failed to add the parcel.'));
      setForm({ shareClass: 'ORDINARY', quantity: '', paidPerUnit: '', acquiredAt: '' });
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add the parcel.');
    } finally {
      setSaving(false);
    }
  }

  async function dispose(parcelId: string) {
    if (!token) return;
    try {
      const res = await fetch(`/api/entities/relationships/${edge.id}/parcels/${parcelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ disposedAt: new Date().toISOString() }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(extractApiError(json, res.status, 'Failed to record the disposal.'));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record the disposal.');
    }
  }

  const canAdd = !saving && Number(form.quantity) > 0 && form.acquiredAt.length > 0;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="mt-1.5 pl-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/35 transition hover:text-white/65"
      >
        {edge.fromEntityName}&rsquo;s {unitWord} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {error && <div className="text-[11px] text-amber-200/80">{error}</div>}
          {parcels === null && !error && (
            <div className="text-[11px] text-white/40">Loading…</div>
          )}
          {parcels?.length === 0 && (
            <div className="text-[11px] text-white/40">No {unitWord} recorded yet.</div>
          )}
          {parcels?.map(pcl => (
            <div
              key={pcl.id}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                opacity: pcl.disposedAt ? 0.55 : 1,
              }}
            >
              <span className="tabular-nums text-white/85">
                {pcl.quantity.toLocaleString()}{' '}
                {SHARE_CLASS_OPTIONS.find(c => c.value === pcl.shareClass)?.label.toLowerCase() ?? pcl.shareClass}
                <span className="text-white/45"> · acquired {fmtDate(pcl.acquiredAt)}</span>
                {pcl.paidPerUnit > 0 && (
                  <span className="text-white/45"> · ${pcl.paidPerUnit.toFixed(2)} paid</span>
                )}
                {pcl.disposedAt && (
                  <span className="text-white/45"> · disposed {fmtDate(pcl.disposedAt)}</span>
                )}
              </span>
              {!pcl.disposedAt && (
                <button
                  type="button"
                  onClick={() => void dispose(pcl.id)}
                  title="Record a disposal (keeps the history for CGT)"
                  className="flex-shrink-0 text-[10px] text-white/40 transition hover:text-white/75"
                >
                  dispose
                </button>
              )}
            </div>
          ))}
          {adding ? (
            <div className="space-y-1.5 rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  placeholder="Quantity"
                  inputMode="decimal"
                  className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-white placeholder-white/30 outline-none"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                />
                <select
                  value={form.shareClass}
                  onChange={e => setForm({ ...form, shareClass: e.target.value })}
                  className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-white outline-none"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  {SHARE_CLASS_OPTIONS.map(c => (
                    <option key={c.value} value={c.value} className="bg-slate-900">{c.label}</option>
                  ))}
                </select>
                <input
                  value={form.paidPerUnit}
                  onChange={e => setForm({ ...form, paidPerUnit: e.target.value })}
                  placeholder="$ paid each (optional)"
                  inputMode="decimal"
                  className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-white placeholder-white/30 outline-none"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                />
                <input
                  type="date"
                  value={form.acquiredAt}
                  onChange={e => setForm({ ...form, acquiredAt: e.target.value })}
                  className="rounded-md bg-white/5 px-2 py-1.5 text-[11px] text-white outline-none"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setAdding(false)} className="text-[11px] text-white/50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void addParcel()}
                  disabled={!canAdd}
                  className="rounded-md px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
                  style={{ background: '#059669' }}
                >
                  {saving ? 'Saving…' : 'Add parcel'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-white/45 transition hover:text-white/70"
              style={{ border: '1px dashed rgba(255,255,255,0.15)' }}
            >
              <Plus size={11} strokeWidth={1.5} /> Add a parcel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
