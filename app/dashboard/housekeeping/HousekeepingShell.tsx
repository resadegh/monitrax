'use client';

/**
 * Housekeeping — shared page shell (header + segmented tabs + badges).
 *
 * MON-094 relocation (Reza ruling 2026-07-21): personal-data review tools
 * live in the Monitrax app under the user's OWN session — never the staff
 * admin portal (the VR-021 principal-mismatch class). Every action on
 * these pages is per-item typed confirmation; nothing changes until the
 * user confirms.
 *
 * Design: Stitch screen 124c6e36cc8d4289ad7d152edd29d1ef, project
 * 1859462351962811110 (PR #1477, §18.8 score 9.2/10). Section identity:
 * amber (careful attention) per the approved design; emerald reserved for
 * confirmed states. Dark mode via the canonical theme tokens (§18.7.2).
 *
 * @see docs/issues/ISSUES.md MON-094
 * @see .stitch/designs/housekeeping/housekeeping-tax-desktop-light-v2.html
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

const TABS = [
  { name: 'Tax classification', href: '/dashboard/housekeeping/tax' },
  { name: 'Duplicate income', href: '/dashboard/housekeeping/duplicates' },
] as const;

export interface HousekeepingShellProps {
  /** Pending-item counts per tab href — renders the count badges (0 → none). */
  counts?: Partial<Record<(typeof TABS)[number]['href'], number>>;
  children: ReactNode;
}

export function HousekeepingShell({ counts, children }: HousekeepingShellProps) {
  const pathname = usePathname() ?? TABS[0].href;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Housekeeping
        </p>
        <h1 className="mt-1 text-[32px] font-semibold leading-[1.05] tracking-tight text-foreground">
          Housekeeping
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
          Review and confirm changes to your own data — nothing changes until you confirm.
        </p>
      </header>

      {/* Segmented tabs */}
      <div className="mb-8 inline-flex rounded-[14px] border border-foreground/10 bg-background/60 p-1 backdrop-blur">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
          const count = counts?.[tab.href] ?? 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-[10px] px-4 py-2 text-[14px] font-medium transition-colors',
                active
                  ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.name}
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {children}

      {/* Boundary line — general information only, NO licence number ever. */}
      <p className="mt-10 max-w-3xl text-[11px] leading-relaxed text-muted-foreground/70">
        General information only — not personal tax or financial advice. Confirmations on this
        page only change how Monitrax classifies your own records.
      </p>
    </div>
  );
}
