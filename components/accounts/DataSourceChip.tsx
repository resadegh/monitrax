/**
 * Phase 12 PR 3c.1 — DataSourceChip.
 *
 * Renders a small "freshness chip" next to any rendered account
 * balance to expose where that balance came from and how stale it
 * is. Lifted out of the inline `isBasiq && <Badge>...</Badge>`
 * pattern previously hard-coded on `/dashboard/balances`.
 *
 * Five visual states keyed by `(balanceSource, age)`:
 *
 *   - BASIQ          → emerald  "Synced 2m ago"
 *   - IMPORT         → sky      "Imported 3d ago"
 *   - USER_VERIFIED  → indigo   "Verified 1d ago"
 *   - MANUAL fresh   → slate    "Manual · 4d ago"
 *   - MANUAL stale   → amber    "Manual · 32d ago"   (age ≥ 14d)
 *   - no source/date → null     (component renders nothing)
 *
 * Tone choices follow the §0 behaviour-psychologist lens — slate (not
 * red) for stale-manual, because that's a hygiene nudge, not an
 * alarm; emerald reserved for live-Open-Banking sync (the strongest
 * trust state).
 *
 * Per CLAUDE.md §12.2 SSOT: the chip is the **one** UI primitive
 * that turns `(balanceSource, balanceLastUpdatedAt)` into a user
 * label. Future surfaces that render an Account balance should
 * import this — do not re-implement the mapping inline. When a
 * second consumer needs the time-ago helper, promote
 * `formatBalanceAge` to `lib/utils/formatters.ts` (§16.4 rule —
 * mirrors the `TrailStagePill` precedent from PR D).
 */

'use client';

import { Zap, Upload, ShieldCheck, Hand, AlertTriangle } from 'lucide-react';

/** Days after which a MANUAL balance is treated as stale. */
export const MANUAL_STALE_THRESHOLD_DAYS = 14;

export type BalanceSourceLiteral = 'BASIQ' | 'IMPORT' | 'USER_VERIFIED' | 'MANUAL';

interface DataSourceChipProps {
  balanceSource?: string | null;
  balanceLastUpdatedAt?: string | Date | null;
  /** Visual variant. `compact` strips the icon for tight rows. */
  size?: 'default' | 'compact';
  className?: string;
}

interface ChipTone {
  border: string;
  text: string;
  bg: string;
  Icon: typeof Zap;
}

const TONE_BY_KEY: Record<string, ChipTone> = {
  basiq: { border: 'border-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50', Icon: Zap },
  import: { border: 'border-sky-200', text: 'text-sky-700', bg: 'bg-sky-50', Icon: Upload },
  verified: { border: 'border-indigo-200', text: 'text-indigo-700', bg: 'bg-indigo-50', Icon: ShieldCheck },
  manualFresh: { border: 'border-slate-200', text: 'text-slate-600', bg: 'bg-slate-50', Icon: Hand },
  manualStale: { border: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50', Icon: AlertTriangle },
};

export function DataSourceChip({
  balanceSource,
  balanceLastUpdatedAt,
  size = 'default',
  className = '',
}: DataSourceChipProps) {
  if (!balanceSource) return null;

  const source = balanceSource as BalanceSourceLiteral;
  const ageDays = balanceLastUpdatedAt ? daysSince(balanceLastUpdatedAt) : null;
  const ageLabel = balanceLastUpdatedAt ? formatBalanceAge(balanceLastUpdatedAt) : null;

  let toneKey: keyof typeof TONE_BY_KEY;
  let label: string;

  switch (source) {
    case 'BASIQ':
      toneKey = 'basiq';
      label = ageLabel ? `Synced ${ageLabel}` : 'Basiq';
      break;
    case 'IMPORT':
      toneKey = 'import';
      label = ageLabel ? `Imported ${ageLabel}` : 'Imported';
      break;
    case 'USER_VERIFIED':
      toneKey = 'verified';
      label = ageLabel ? `Verified ${ageLabel}` : 'Verified';
      break;
    case 'MANUAL': {
      const isStale = ageDays !== null && ageDays >= MANUAL_STALE_THRESHOLD_DAYS;
      toneKey = isStale ? 'manualStale' : 'manualFresh';
      label = ageLabel ? `Manual · ${ageLabel}` : 'Manual';
      break;
    }
    default:
      return null;
  }

  const tone = TONE_BY_KEY[toneKey];
  const { Icon } = tone;
  const sizing = size === 'compact'
    ? 'text-[10px] px-1.5 py-0'
    : 'text-[11px] px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${tone.border} ${tone.text} ${tone.bg} font-medium ${sizing} ${className}`.trim()}
    >
      {size !== 'compact' && <Icon aria-hidden className="h-2.5 w-2.5" />}
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

/**
 * `true` when this account's balance should drive the stale-balance
 * nudge banner (MANUAL + last-updated ≥ 14 days ago, OR MANUAL with
 * no timestamp at all — we treat unknown-age MANUAL as stale, since
 * the user has never refreshed it).
 *
 * Exported so the page-level `StaleBalanceNudge` can apply exactly
 * the same rule the chip applies — single SSOT for "is this stale".
 */
export function isBalanceStale(
  balanceSource: string | null | undefined,
  balanceLastUpdatedAt: string | Date | null | undefined
): boolean {
  if (balanceSource !== 'MANUAL') return false;
  if (!balanceLastUpdatedAt) return true;
  return daysSince(balanceLastUpdatedAt) >= MANUAL_STALE_THRESHOLD_DAYS;
}

// ---- private helpers (promote to lib/utils/formatters.ts when a 2nd consumer needs them) ----

function daysSince(input: string | Date): number {
  const then = typeof input === 'string' ? new Date(input).getTime() : input.getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

function formatBalanceAge(input: string | Date): string {
  const then = typeof input === 'string' ? new Date(input).getTime() : input.getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
