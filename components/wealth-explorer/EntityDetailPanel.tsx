/**
 * EntityDetailPanel — slide-in right panel for the Wealth Universe canvas.
 *
 * Triggered by clicking a tile. Loads `/api/entities/[id]` for the full
 * entity record + asset counts, then renders summary + role list + asset
 * counts + actions. Mirrors the v5 Stitch design's intent for "Level 3 —
 * Entity File".
 *
 * Phase 3 (Level 3 extension) — accepts the entity's linked assets
 * from the parent canvas (already in memory via the wealth-graph
 * snapshot — no extra fetch). Renders them as a tappable list with
 * click-through to each asset's individual detail page where one
 * exists, falling back to the asset list-route otherwise.
 *
 * WX.5.4 (Reza 2026-06-11: asset bubbles erred "Failed (404)") — the
 * `/api/entities/[id]` fetch only fires for REAL entities. Asset and
 * ownership-group bubbles are synthetic canvas nodes with no entity
 * record: they render from the in-memory graph instead (value, held-by
 * owner per the ownership-trail rule, and a click-through CTA via the
 * canonical `assetHrefFor`).
 *
 * Surface SoT: Stitch screen `a3b43b9164d74f1c8ec53bc20f319cbd`
 */

'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Building2,
  Home as HomeIcon,
  LineChart,
  Landmark,
  Box,
  Banknote,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  type LucideIcon,
  PiggyBank,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import type { WealthNode } from '@/lib/data/wealthExplorerTypes';
import { NODE_ACCENT, assetHrefFor, assetCtaLabelFor } from '@/lib/data/wealthExplorerTypes';
import type { WealthGraphAsset } from '@/lib/services/wealthGraphService';
import RolesAndPeopleSection from './RolesAndPeopleSection';
import type { LegalEntityType } from '@prisma/client';

interface EntityDetail {
  id: string;
  name: string;
  type: string;
  role: string;
  abn: string | null;
  acn: string | null;
  hasTfn: boolean;
  tradingName: string | null;
  establishedDate: string | null;
  parentEntityId: string | null;
  parentEntityName: string | null;
  trustType: string | null;
  isForeignResident: boolean | null;
  ownedObjectsCount: {
    properties: number;
    loans: number;
    accounts: number;
    investmentAccounts: number;
    assets: number;
  };
}

interface Props {
  node: WealthNode | null;
  onClose: () => void;
  /**
   * Phase 3 Level 3 — assets held by this entity. Already in memory
   * via the wealth-graph snapshot; the canvas filters + passes the
   * subset whose `ownerEntityId === node.id`. Empty array when the
   * entity owns nothing directly.
   */
  assets?: WealthGraphAsset[];
  /**
   * WX.5.4 — for asset-tier nodes: the full graph record (already in
   * memory via the snapshot). Drives the value + click-through CTA.
   */
  assetRecord?: WealthGraphAsset | null;
  /**
   * WX.5.4 — name of the entity holding this asset (ownership-trail
   * rule: the owner is always visible on every layer).
   */
  ownerName?: string | null;
}

export default function EntityDetailPanel({
  node,
  onClose,
  assets = [],
  assetRecord = null,
  ownerName = null,
}: Props) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WX.5.4 — only real entities have /api/entities/[id] records.
  // Asset + ownership-group bubbles are synthetic canvas nodes;
  // fetching them 404s (the bug Reza hit on the Qantas Credit Card).
  const isEntity =
    !!node && node.type !== 'ownership-group' && !node.type.startsWith('asset-');

  useEffect(() => {
    if (!node || !isEntity) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/entities/${node.id}`, { headers });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) setDetail(json.entity ?? json.data ?? json);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [node, isEntity, token]);

  const accent = node ? NODE_ACCENT[node.type] : '#94A3B8';

  return (
    <AnimatePresence>
      {node && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="absolute right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col overflow-y-auto"
            style={{
              background: 'rgba(13, 18, 32, 0.96)',
              backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 0 60px rgba(0, 0, 0, 0.6)',
            }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/5 p-6 backdrop-blur-md" style={{ background: 'rgba(13, 18, 32, 0.7)' }}>
              <div className="flex min-w-0 items-start gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    background: `${accent}22`,
                    border: `1px solid ${accent}55`,
                  }}
                >
                  <Building2 size={20} color={accent} strokeWidth={1.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[16px] font-semibold leading-tight text-white">
                    {node.name}
                  </div>
                  <div
                    className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em]"
                    style={{ color: accent }}
                  >
                    {node.subtitle ?? prettifyType(node.type)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full hover:bg-white/5"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <X size={14} color="rgba(255,255,255,0.7)" strokeWidth={1.5} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-6">
              {/* WX.5.4 — asset / ownership-group bubbles render from
                  the in-memory graph; there's no entity file to fetch. */}
              {!isEntity && (
                <div className="space-y-6">
                  {(assetRecord || node.value) && (
                    <div>
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                        Value
                      </div>
                      <div className="text-[28px] font-semibold tabular-nums leading-none text-white">
                        {assetRecord ? formatValue(assetRecord.value) : node.value}
                      </div>
                    </div>
                  )}
                  <Section title="Ownership">
                    <Row
                      label="Held by"
                      value={
                        ownerName ??
                        (node.type === 'ownership-group'
                          ? `${node.subtitle ?? 'Joint owners'}`
                          : 'Your structure')
                      }
                    />
                    {assetRecord?.subtype && (
                      <Row label="Type" value={assetRecord.subtype} />
                    )}
                    {assetRecord?.context && !assetRecord.subtype && (
                      <Row label="Context" value={assetRecord.context} />
                    )}
                  </Section>
                  {assetRecord && (
                    <Link
                      href={assetHrefFor(assetRecord.kind, assetRecord.id)}
                      onClick={onClose}
                      className="flex items-center justify-between gap-3 rounded-xl p-4 text-[12px] font-medium transition hover:bg-white/[0.06]"
                      style={{
                        background: 'rgba(52, 211, 153, 0.08)',
                        border: '1px solid rgba(52, 211, 153, 0.25)',
                        color: '#6EE7B7',
                      }}
                    >
                      <span>{assetCtaLabelFor(assetRecord.kind)}</span>
                      <ChevronRight size={14} strokeWidth={1.5} />
                    </Link>
                  )}
                  {/* Group bubbles list what the group holds */}
                  {node.type === 'ownership-group' && assets.length > 0 && (
                    <Section title="Held jointly">
                      <div className="space-y-1.5">
                        {assets.map(a => (
                          <LinkedAssetRow key={a.id} asset={a} onNavigate={onClose} />
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              )}

              {loading && (
                <div className="flex h-32 items-center justify-center text-[12px] text-white/50">
                  Loading details…
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 rounded-xl p-4 text-[12px]" style={{ background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                  <AlertTriangle size={14} color="#FBBF24" strokeWidth={1.5} />
                  <div>
                    <div className="font-medium text-amber-200">Couldn&rsquo;t load full details</div>
                    <div className="mt-0.5 text-amber-200/70">{error}</div>
                  </div>
                </div>
              )}

              {detail && (
                <div className="space-y-6">
                  {/* Validity / status */}
                  <div className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', color: '#6EE7B7', alignSelf: 'flex-start', width: 'fit-content' }}>
                    <CheckCircle2 size={12} strokeWidth={1.5} />
                    <span>Active &middot; Verified</span>
                  </div>

                  {/* Metadata */}
                  <Section title="Identity">
                    {detail.abn && (
                      <Row label="ABN" value={detail.abn} />
                    )}
                    {detail.acn && (
                      <Row label="ACN" value={detail.acn} />
                    )}
                    {detail.tradingName && (
                      <Row label="Trading as" value={detail.tradingName} />
                    )}
                    {detail.establishedDate && (
                      <Row
                        label="Established"
                        value={new Date(detail.establishedDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                      />
                    )}
                    {detail.trustType && (
                      <Row label="Trust type" value={detail.trustType.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase())} />
                    )}
                  </Section>

                  {/* Parent relationship */}
                  {detail.parentEntityName && (
                    <Section title="Controlled by">
                      <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <Building2 size={14} color="#7DD3FC" strokeWidth={1.5} />
                        <div className="flex-1 truncate text-[12px] text-white/90">{detail.parentEntityName}</div>
                        <ChevronRight size={12} color="rgba(255,255,255,0.4)" />
                      </div>
                    </Section>
                  )}

                  {/* Phase 47 F2 — the Entity File: type-aware role rows
                      (directors / trustees / beneficiaries…), the
                      "actually held for" overrides, and the completeness
                      chip. Full editor — add, end-date, validity preview. */}
                  <RolesAndPeopleSection
                    entityId={detail.id}
                    entityType={detail.type as LegalEntityType}
                    entityName={detail.name}
                    assets={assets}
                  />

                  {/* Asset counts */}
                  <Section title="Holds">
                    <div className="grid grid-cols-2 gap-2">
                      <AssetCountTile icon={HomeIcon} label="Properties" count={detail.ownedObjectsCount.properties} accent="#38BDF8" />
                      <AssetCountTile icon={LineChart} label="Investments" count={detail.ownedObjectsCount.investmentAccounts} accent="#818CF8" />
                      <AssetCountTile icon={Landmark} label="Accounts" count={detail.ownedObjectsCount.accounts} accent="#34D399" />
                      <AssetCountTile icon={Box} label="Other assets" count={detail.ownedObjectsCount.assets} accent="#FBBF24" />
                    </div>
                  </Section>

                  {/* Phase 3 Level 3 — Linked assets list with
                      click-through. Renders only when ≥1 asset
                      exists. Replaces the prior "Open full entity
                      file →" dead-end CTA (it pointed back to
                      /dashboard/entities, which is where the user
                      already is). */}
                  {assets.length > 0 && (
                    <Section title="Linked assets">
                      <div className="space-y-1.5">
                        {assets.map(a => (
                          <LinkedAssetRow key={a.id} asset={a} onNavigate={onClose} />
                        ))}
                      </div>
                    </Section>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11px] text-white/50">{label}</span>
      <span className="text-[12px] font-medium tabular-nums text-white/90">{value}</span>
    </div>
  );
}

function AssetCountTile({
  icon: Icon,
  label,
  count,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  count: number;
  accent: string;
}) {
  const dim = count === 0;
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        opacity: dim ? 0.5 : 1,
      }}
    >
      <Icon size={14} color={accent} strokeWidth={1.5} />
      <div className="mt-2 text-[18px] font-semibold tabular-nums text-white">{count}</div>
      <div className="text-[10px] text-white/45">{label}</div>
    </div>
  );
}

function prettifyType(t: string): string {
  return t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Phase 3 Level 3 — render one linked asset as a tappable row with
 * click-through to the asset's individual detail page where one
 * exists, falling back to the asset list-route otherwise.
 *
 * URL map: canonical `assetHrefFor` in `lib/data/wealthExplorerTypes.ts`
 * (WX.5.4 — the local copy drifted once investments + super gained
 * detail pages).
 *
 * `onNavigate` closes the panel before the route change so the user
 * lands on the destination cleanly without a stale Level-3 panel
 * hanging over it.
 */
function LinkedAssetRow({
  asset,
  onNavigate,
}: {
  asset: WealthGraphAsset;
  onNavigate: () => void;
}) {
  const { icon: Icon, accent } = assetGlyphFor(asset.kind);
  const href = assetHrefFor(asset.kind, asset.id);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group flex items-center gap-3 rounded-xl p-3 transition"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accent}1f`, border: `1px solid ${accent}44` }}
      >
        <Icon size={15} color={accent} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-white/95">{asset.name}</div>
        <div className="truncate text-[10px] text-white/45">
          {asset.subtype ?? asset.context ?? prettifyType(asset.kind)}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <div className="text-[12px] font-semibold tabular-nums text-white/85">
          {formatValue(asset.value)}
        </div>
        <ChevronRight size={12} color="rgba(255,255,255,0.4)" className="transition group-hover:text-white/70" />
      </div>
    </Link>
  );
}

function assetGlyphFor(kind: WealthGraphAsset['kind']): { icon: LucideIcon; accent: string } {
  switch (kind) {
    case 'property': return { icon: HomeIcon, accent: '#38BDF8' };
    case 'loan': return { icon: Banknote, accent: '#F87171' };
    case 'account': return { icon: Landmark, accent: '#34D399' };
    case 'investment-account': return { icon: LineChart, accent: '#818CF8' };
    case 'asset': return { icon: Box, accent: '#FBBF24' };
    case 'super': return { icon: PiggyBank, accent: '#818CF8' }; // Phase 47 B1
  }
}

function formatValue(v: number): string {
  if (!isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toFixed(0)}`;
}
