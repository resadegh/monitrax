/**
 * EditorialNavRow — the canonical row primitive for the Restrained
 * Editorial sidebar + mobile drawer. Active state carries the signature
 * 3px emerald left-edge accent + emerald-10% background; inactive rows
 * sit on the warm-ivory ground with slate-500 text.
 *
 * Spec (from Stitch desktop screen 2543c8240b944c8fa6b6e89d20ac8e77 +
 * mobile screen dc038cd19aea4cfc8d0300f4d9122ffd):
 *   - height:   44px (touch target compliant)
 *   - padding:  12px 16px (left-padded to make room for the 3px accent)
 *   - icon:     20px lucide, 1.5px stroke, matches text colour
 *   - label:    14px / 500 (label-md) — navy when active, slate-500 otherwise
 *   - active:   bg-editorial-emerald-chip + 3px left bar + navy 600 text
 *   - hover:    surface-container-low (#FAF8F3) bg
 *
 * Children optional — TRAIL stage tone dot can be appended on the right
 * (sky / amber / indigo / emerald / violet) for the 5 stage-bearing rows.
 *
 * @see lib/navigation/trailNav.tsx — NavItem SSOT
 */

'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ComponentType } from 'react';
import type { TrailStage } from '@/lib/cfo/trailStage';

export interface EditorialNavRowProps {
  href: string;
  label: string;
  /**
   * Icon component. Typed to match the loose `NavItem.icon` contract in
   * `lib/navigation/trailNav.tsx` (SSOT) — accepts any component that
   * takes a `className` prop, which both lucide icons and any custom
   * icon component satisfy. Strict `LucideIcon` typing would reject the
   * canonical nav config.
   */
  icon: ComponentType<{ className?: string }>;
  /** Match-active state — driven by the consumer's pathname check. */
  active?: boolean;
  /**
   * Optional TRAIL stage. When set, appends a tiny stage-tone dot at the
   * right edge so the user can visually parse the journey position.
   */
  trailStage?: TrailStage;
  /** Render compact 36px height for nested children rows. */
  dense?: boolean;
  onClick?: () => void;
  /**
   * Optional `data-tour` attribute forwarded to the rendered Link. Used
   * by `<GuidedTour />` to anchor onboarding spotlights to specific
   * nav rows (e.g. `data-tour="nav-accounts"`).
   */
  dataTour?: string;
}

const STAGE_DOT: Record<TrailStage, string> = {
  T: 'bg-editorial-sky',
  R: 'bg-editorial-amber',
  A: 'bg-editorial-indigo',
  I: 'bg-editorial-emerald',
  L: 'bg-editorial-violet',
};

export function EditorialNavRow({
  href,
  label,
  icon: Icon,
  active = false,
  trailStage,
  dense = false,
  onClick,
  dataTour,
}: EditorialNavRowProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      data-tour={dataTour}
      className={cn(
        'relative flex items-center gap-3 rounded-lg pl-4 pr-3 outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-editorial-emerald/40 focus-visible:ring-offset-1',
        dense ? 'h-9 text-[13px]' : 'h-11 text-sm',
        active
          ? 'bg-editorial-emerald-chip font-semibold text-editorial-ink'
          : 'font-medium text-editorial-slate hover:bg-editorial-warm hover:text-editorial-ink'
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-editorial-emerald"
        />
      )}
      {/* Icon rendered without strokeWidth — the loose NavItem.icon
          contract doesn't declare it. Active/inactive distinction is
          carried by font weight + colour change instead, which reads
          more cleanly on dense nav rails anyway. */}
      <Icon className={cn('shrink-0', dense ? 'h-4 w-4' : 'h-5 w-5')} />
      <span className="flex-1 truncate">{label}</span>
      {trailStage && (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STAGE_DOT[trailStage])}
        />
      )}
    </Link>
  );
}
