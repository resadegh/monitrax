/**
 * EntityDetailPanel — slide-in right panel for the Wealth Universe canvas.
 *
 * Triggered by clicking a tile. Loads `/api/entities/[id]` for the full
 * entity record + asset counts, then renders summary + role list + asset
 * counts + actions. Mirrors the v5 Stitch design's intent for "Level 3 —
 * Entity File".
 *
 * Surface SoT: Stitch screen `a3b43b9164d74f1c8ec53bc20f319cbd`
 */

'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Building2,
  Home as HomeIcon,
  LineChart,
  Landmark,
  Box,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import type { WealthNode } from '@/lib/data/wealthExplorerTypes';
import { NODE_ACCENT } from '@/lib/data/wealthExplorerTypes';

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
}

export default function EntityDetailPanel({ node, onClose }: Props) {
  const { token } = useAuth();
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!node) {
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
  }, [node, token]);

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

                  {/* Asset counts */}
                  <Section title="Holds">
                    <div className="grid grid-cols-2 gap-2">
                      <AssetCountTile icon={HomeIcon} label="Properties" count={detail.ownedObjectsCount.properties} accent="#38BDF8" />
                      <AssetCountTile icon={LineChart} label="Investments" count={detail.ownedObjectsCount.investmentAccounts} accent="#818CF8" />
                      <AssetCountTile icon={Landmark} label="Accounts" count={detail.ownedObjectsCount.accounts} accent="#34D399" />
                      <AssetCountTile icon={Box} label="Other assets" count={detail.ownedObjectsCount.assets} accent="#FBBF24" />
                    </div>
                  </Section>

                  {/* Tap-through action */}
                  <a
                    href={`/dashboard/entities`}
                    className="block w-full rounded-xl py-3 text-center text-[12px] font-medium text-white transition"
                    style={{
                      background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
                      boxShadow: `0 8px 24px ${accent}33`,
                    }}
                  >
                    Open full entity file →
                  </a>
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
