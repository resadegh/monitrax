/**
 * Phase 42 PR6 — Streak badge.
 *
 * Small pill that surfaces the user's current streak. Per spec §6.4:
 *   - Hidden when streak < 3 (no shame for new users)
 *   - Capped at "365+" beyond a year
 *   - 🔥 emoji + warm amber palette (warm, not aggressive)
 *
 * Accessibility — `aria-label` includes the explicit count so screen
 * readers don't have to guess from the emoji.
 */

import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  count: number;
  /** Optional label override (e.g. "personal best"). */
  label?: string;
  size?: 'sm' | 'md';
}

export function StreakBadge({ count, label, size = 'sm' }: StreakBadgeProps) {
  if (count < 3) return null;
  const display = count >= 365 ? '365+' : String(count);
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${padding} rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium tabular-nums`}
      aria-label={label ?? `${display}-day streak`}
    >
      <Flame className="w-3.5 h-3.5 text-amber-600" aria-hidden />
      <span>{display}</span>
      {label && <span className="text-amber-700/80">· {label}</span>}
    </span>
  );
}
