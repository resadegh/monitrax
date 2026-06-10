'use client';

/**
 * OwnershipPicker — Phase 47 Stage A (Entity Ownership Fabric).
 *
 * The §4A ownership picker: "Just me / Joint / Shared / An entity" as a
 * 2×2 grid of selectable glass choice cards with an expanding panel for
 * the selected mode. Warm words only — users never see "OwnershipGroup",
 * "tenancy" or "TENANTS_IN_COMMON" (CLAUDE.md §14.3): they see "Just me",
 * "Joint with Sarah", "Shared 70/30".
 *
 *   - Joint  → equal shares with survivorship (P2 — TR 93/32 note shown)
 *   - Shared → per-owner percentages that must total 100% (P3)
 *   - An entity → a trust/company/SMSF the user has added; the card only
 *     renders when such an entity exists (progressive disclosure —
 *     single-entity users see zero structure jargon)
 *
 * Co-owner chips come from My Household members; picking one (or typing a
 * name) quick-creates an INDIVIDUAL LegalEntity server-side
 * (`lib/services/ownershipSelectionService.ts` — the canonical writer).
 *
 * Emits an `OwnershipSelectionValue` for the create route's `ownership`
 * payload. Create-time only — post-creation changes go through the
 * "correct ownership record" flow (Stage A2), never this picker.
 *
 * Design SoT (§18.4): Stitch screen `8e6fc018886e4d54b18abff0f7c80c13`,
 * artefact `.stitch/designs/phase47/ownership-picker-property-joint-v2.{html,png}`
 * (project `1859462351962811110`). Properties sub-palette (sky→indigo).
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Info, Landmark, PieChart, Plus, User, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';

export type OwnershipSelectionValue =
  | { mode: 'sole' }
  | { mode: 'entity'; entityId: string }
  | { mode: 'joint'; coOwners: Array<{ entityId?: string; name?: string }> }
  | {
      mode: 'shared';
      owners: Array<{ entityId?: string; name?: string; sharePct: number; isSelf?: boolean }>;
    };

interface EntityOption {
  id: string;
  name: string;
  type: string;
}

interface HouseholdMemberOption {
  id: string;
  name: string;
  relationship: string;
}

interface OwnershipPickerProps {
  token: string | null;
  value: OwnershipSelectionValue;
  onChange: (value: OwnershipSelectionValue) => void;
}

const CARD_BASE =
  'relative flex flex-col gap-1 rounded-[14px] border p-3 text-left transition-all duration-200';
const CARD_IDLE = 'border-foreground/10 bg-background/50 hover:border-sky-300/60';
const CARD_SELECTED = 'border-sky-400 bg-sky-50/40 ring-1 ring-sky-400/60';

export default function OwnershipPicker({ token, value, onChange }: OwnershipPickerProps) {
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [members, setMembers] = useState<HouseholdMemberOption[]>([]);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch('/api/entities', { headers })
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(result => {
        const list: EntityOption[] = (result.data ?? [])
          .filter((e: { type: string }) => e.type !== 'PERSONAL_NAME' && e.type !== 'INDIVIDUAL')
          .map((e: { id: string; name: string; type: string }) => ({
            id: e.id,
            name: e.name,
            type: e.type,
          }));
        setEntities(list);
      })
      .catch(() => setEntities([]));
    fetch('/api/household-members', { headers })
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(result => {
        const list: HouseholdMemberOption[] = (result.data ?? [])
          .filter((m: { relationship: string }) => m.relationship !== 'SELF')
          .map((m: { id: string; name: string; relationship: string }) => ({
            id: m.id,
            name: m.name,
            relationship: m.relationship,
          }));
        setMembers(list);
      })
      .catch(() => setMembers([]));
  }, [token]);

  const hasEntities = entities.length > 0;

  const jointNames = useMemo(
    () => (value.mode === 'joint' ? value.coOwners.map(c => c.name ?? '') : []),
    [value],
  );

  function selectMode(mode: 'sole' | 'joint' | 'shared' | 'entity') {
    if (mode === 'sole') onChange({ mode: 'sole' });
    if (mode === 'joint') onChange({ mode: 'joint', coOwners: [] });
    if (mode === 'shared')
      onChange({
        mode: 'shared',
        owners: [
          { isSelf: true, sharePct: 50 },
          { name: '', sharePct: 50 },
        ],
      });
    if (mode === 'entity') onChange({ mode: 'entity', entityId: entities[0]?.id ?? '' });
  }

  function toggleJointCoOwner(name: string) {
    if (value.mode !== 'joint') return;
    const exists = value.coOwners.some(c => c.name === name);
    onChange({
      mode: 'joint',
      coOwners: exists
        ? value.coOwners.filter(c => c.name !== name)
        : [...value.coOwners, { name }],
    });
  }

  function updateSharedOwner(
    idx: number,
    patch: Partial<{ name: string; sharePct: number }>,
  ) {
    if (value.mode !== 'shared') return;
    const owners = value.owners.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    onChange({ mode: 'shared', owners });
  }

  const sharedTotal =
    value.mode === 'shared' ? value.owners.reduce((s, o) => s + (o.sharePct || 0), 0) : 0;

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Who owns this?
      </div>

      {/* 2×2 choice grid (3 cards when no entity exists — progressive disclosure) */}
      <div className="grid grid-cols-2 gap-3">
        <ChoiceCard
          selected={value.mode === 'sole'}
          onClick={() => selectMode('sole')}
          icon={<User size={16} className="text-sky-600" strokeWidth={1.8} />}
          title="Just me"
          caption="Owned in your name"
        />
        <ChoiceCard
          selected={value.mode === 'joint'}
          onClick={() => selectMode('joint')}
          icon={<Users size={16} className="text-sky-600" strokeWidth={1.8} />}
          title="Joint"
          caption="Equal shares, with survivorship"
        />
        <ChoiceCard
          selected={value.mode === 'shared'}
          onClick={() => selectMode('shared')}
          icon={<PieChart size={16} className="text-sky-600" strokeWidth={1.8} />}
          title="Shared"
          caption="Set each owner's percentage"
        />
        {hasEntities && (
          <ChoiceCard
            selected={value.mode === 'entity'}
            onClick={() => selectMode('entity')}
            icon={<Landmark size={16} className="text-sky-600" strokeWidth={1.8} />}
            title="An entity"
            caption="A trust, company or SMSF you've added"
          />
        )}
      </div>

      {/* Joint panel */}
      {value.mode === 'joint' && (
        <div className="space-y-3 rounded-[14px] border border-sky-200/60 bg-sky-50/30 p-4">
          <div className="text-sm font-medium">Who owns it with you?</div>
          <div className="flex flex-wrap gap-2">
            {members.map(m => {
              const selected = jointNames.includes(m.name);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleJointCoOwner(m.name)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                    selected
                      ? 'border-sky-400 bg-sky-100/70 text-sky-900'
                      : 'border-foreground/15 bg-background/60 hover:border-sky-300'
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[10px] font-semibold text-white">
                    {m.name.charAt(0).toUpperCase()}
                  </span>
                  {m.name}
                  {selected && <Check size={12} strokeWidth={2.4} />}
                </button>
              );
            })}
            <div className="flex items-center gap-1.5">
              <Input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Add someone"
                className="h-8 w-36 rounded-full text-sm"
              />
              <button
                type="button"
                aria-label="Add co-owner"
                disabled={!customName.trim()}
                onClick={() => {
                  if (!customName.trim()) return;
                  toggleJointCoOwner(customName.trim());
                  setCustomName('');
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground hover:border-sky-300 disabled:opacity-40"
              >
                <Plus size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={13} className="mt-0.5 shrink-0" strokeWidth={1.8} />
            Income and costs split 50/50 — the ATO follows the names on the title, not who paid.
          </div>
        </div>
      )}

      {/* Shared panel */}
      {value.mode === 'shared' && (
        <div className="space-y-3 rounded-[14px] border border-sky-200/60 bg-sky-50/30 p-4">
          <div className="text-sm font-medium">
            Set each owner&apos;s share — it should match the names on the title.
          </div>
          <div className="space-y-2">
            {value.owners.map((o, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-[10px] font-semibold text-white">
                  {o.isSelf ? 'Y' : (o.name || '?').charAt(0).toUpperCase()}
                </span>
                {o.isSelf ? (
                  <span className="flex-1 text-sm">You</span>
                ) : (
                  <Input
                    value={o.name ?? ''}
                    onChange={e => updateSharedOwner(idx, { name: e.target.value })}
                    placeholder="Owner name"
                    className="h-8 flex-1 text-sm"
                    list={`household-names-${idx}`}
                  />
                )}
                {!o.isSelf && (
                  <datalist id={`household-names-${idx}`}>
                    {members.map(m => (
                      <option key={m.id} value={m.name} />
                    ))}
                  </datalist>
                )}
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={o.sharePct || ''}
                    onChange={e => updateSharedOwner(idx, { sharePct: Number(e.target.value) })}
                    className="h-8 w-20 text-right text-sm tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              value.mode === 'shared' &&
              onChange({ mode: 'shared', owners: [...value.owners, { name: '', sharePct: 0 }] })
            }
            className="rounded-full border border-foreground/15 px-3 py-1 text-xs text-muted-foreground hover:border-sky-300"
          >
            + Add someone
          </button>
          <div
            className={`flex items-center gap-1.5 text-xs font-medium ${
              Math.abs(sharedTotal - 100) <= 0.5 ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            Total {sharedTotal}%
            {Math.abs(sharedTotal - 100) <= 0.5 && <Check size={13} strokeWidth={2.4} />}
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={13} className="mt-0.5 shrink-0" strokeWidth={1.8} />
            Income, costs and capital gains follow these shares.
          </div>
        </div>
      )}

      {/* Entity panel */}
      {value.mode === 'entity' && (
        <div className="space-y-2 rounded-[14px] border border-sky-200/60 bg-sky-50/30 p-4">
          <div className="text-sm font-medium">Which entity owns it?</div>
          <select
            value={value.entityId}
            onChange={e => onChange({ mode: 'entity', entityId: e.target.value })}
            className="w-full rounded-[12px] border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            {entities.map(e => (
              <option key={e.id} value={e.id}>
                {e.name} — {entityTypeLabel(e.type)}
              </option>
            ))}
          </select>
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={13} className="mt-0.5 shrink-0" strokeWidth={1.8} />
            Tax treatment follows the owner — entity-held assets are taxed differently to
            personally-held ones.
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  icon,
  title,
  caption,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  caption: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${CARD_BASE} ${selected ? CARD_SELECTED : CARD_IDLE}`}
    >
      {selected && (
        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-white">
          <Check size={10} strokeWidth={3} />
        </span>
      )}
      {icon}
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs leading-snug text-muted-foreground">{caption}</span>
    </button>
  );
}

function entityTypeLabel(type: string): string {
  switch (type) {
    case 'COMPANY':
      return 'Company';
    case 'DISCRETIONARY_TRUST':
      return 'Family trust';
    case 'UNIT_TRUST':
      return 'Unit trust';
    case 'SMSF':
      return 'SMSF';
    case 'PARTNERSHIP':
      return 'Partnership';
    case 'SOLE_TRADER':
      return 'Sole trader';
    default:
      return type.replaceAll('_', ' ').toLowerCase();
  }
}
