'use client';

/**
 * AddSourcePicker — small 2-tile dialog used to pick how a new
 * Account or Loan should be added.
 *
 * Phase 1c of accounts/loans-page retirement (CHANGELOG_2026_04_29).
 *
 * Mirrors the spirit of the onboarding wizard's
 * `AccountsDataSourceTiles` component (3 tiles: Basiq / Import /
 * Manual), but trimmed to **two** tiles because Connect Bank is now
 * a separate top-level toolbar button on `/dashboard/balances`. The
 * recommended path is shown first (Import for accounts, Upload
 * document for loans — per user direction "import file should be
 * higher value than the manual create").
 *
 * Caller-owned state: this component is pure presentation. The
 * parent decides what each tile does via callbacks.
 *
 * Lives in `components/ui/` rather than `components/accounts/`
 * because it's a generic visual primitive — same picker shape, just
 * different copy + icons. Used by both `+ Account` and `+ Loan`.
 */

import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface AddSourceTile {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Show the "Recommended" badge on this tile. */
  recommended?: boolean;
  /** Tile colour accent — defaults to blue. */
  accent?: 'blue' | 'emerald' | 'amber';
  onSelect: () => void;
}

interface AddSourcePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  tiles: AddSourceTile[];
}

const ACCENT_CLASSES: Record<NonNullable<AddSourceTile['accent']>, string> = {
  blue:
    'border-blue-200/70 bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 hover:shadow-[0_14px_38px_-10px_rgba(99,102,241,0.4)] dark:border-blue-800/40 dark:from-blue-900/30 dark:via-indigo-900/20 dark:to-violet-900/20',
  emerald:
    'border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 hover:shadow-[0_14px_38px_-10px_rgba(16,185,129,0.35)] dark:border-emerald-800/40 dark:from-emerald-900/30 dark:via-teal-900/20 dark:to-cyan-900/20',
  amber:
    'border-amber-200/70 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 hover:shadow-[0_14px_38px_-10px_rgba(245,158,11,0.35)] dark:border-amber-800/40 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-yellow-900/20',
};

const ICON_BG: Record<NonNullable<AddSourceTile['accent']>, string> = {
  blue: 'from-blue-500 via-indigo-500 to-violet-600 text-white',
  emerald: 'from-emerald-500 via-teal-500 to-cyan-500 text-white',
  amber: 'from-amber-500 via-orange-500 to-yellow-500 text-white',
};

export function AddSourcePicker({
  open,
  onOpenChange,
  title,
  description,
  tiles,
}: AddSourcePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {tiles.map((tile, idx) => {
            const Icon = tile.icon;
            const accent = tile.accent ?? 'blue';
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  // Close the picker before invoking the tile's
                  // handler so the next dialog (form / import) can
                  // open without two modals stacking.
                  onOpenChange(false);
                  tile.onSelect();
                }}
                className={`group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border p-5 text-left transition-all hover:scale-[1.01] ${ACCENT_CLASSES[accent]}`}
              >
                <div
                  className={`relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-[0_8px_20px_-6px_rgba(0,0,0,0.25)] ${ICON_BG[accent]}`}
                >
                  <Icon className="h-6 w-6" />
                </div>

                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {tile.title}
                    </h4>
                    {tile.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                    {tile.description}
                  </p>
                </div>

                <ArrowRight className="relative h-5 w-5 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700 dark:group-hover:text-slate-200" />
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddSourcePicker;
