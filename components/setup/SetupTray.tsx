'use client';

/**
 * SetupTray — Phase 12 v3 (dashboard-as-onboarding)
 *
 * The dashboard chrome component that replaces the linear wizard's
 * resume banner with a persistent setup-progress tracker. Reads from
 * `useSetupState()` (Phase C.1), renders a collapsible header with a
 * progress meter, and expands into a checklist of task rows that
 * deep-link to the **real dashboard dialogs** — never wizard steps.
 *
 * UX shape:
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  ⚡ Set up Monitrax     3 of 7 done   ▼                    │  ← collapsed
 *   └───────────────────────────────────────────────────────────┘
 *
 *   ┌───────────────────────────────────────────────────────────┐
 *   │  ⚡ Set up Monitrax     3 of 7 done   ▲                    │
 *   │  ────────────────────────────────────────────────────     │
 *   │  ✓  Bank accounts connected                                │
 *   │  ○  Add a property            Unlock equity & net worth   →│
 *   │  ○  Add your household        Personalises budget targets →│
 *   │  …                                                         │
 *   └───────────────────────────────────────────────────────────┘
 *
 *   When all tasks are done, the tray collapses to a "Setup
 *   complete ✓" pill that the user can dismiss entirely.
 *
 * Architecture decisions:
 *   - Pure consumer of `useSetupState`. Zero business logic, zero
 *     completion calculation, zero registry walking — those all live
 *     server-side per CLAUDE.md §12.2 (SSOT) and §12.3 (thin clients).
 *   - Icons are resolved from the registry's lucide-name strings via
 *     a tiny local `ICON_MAP`. Keeps the registry server-safe (no
 *     React) while letting the UI render real components.
 *   - `prefers-reduced-motion` honoured via Tailwind `motion-reduce:`
 *     variants — no JavaScript required.
 *   - Dark-mode native via `dark:` variants throughout.
 *   - ARIA: the tray is a `region` with an `aria-labelledby` heading,
 *     the toggle button has `aria-expanded` + `aria-controls`, task
 *     rows are `<a>` tags so the browser handles focus, keyboard, and
 *     middle-click for free. Done rows get `aria-current="step"` to
 *     announce completion.
 *   - No external animation libs. Tailwind transitions only.
 *   - Hidden completely on `error` to fail silently — the dashboard
 *     should never get worse because the setup tray failed to load.
 *
 * See:
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.1 (Setup Tray)
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §10 (5 magic moments)
 *   - hooks/useSetupState.ts (the data source)
 *   - lib/setup/tasks.ts (the registry this UI renders)
 */

import { useState, useId } from 'react';
import Link from 'next/link';
import {
  Banknote,
  Home,
  Users,
  Wallet,
  Receipt,
  TrendingUp,
  UserPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CircleDashed,
  type LucideIcon,
} from 'lucide-react';
import { useSetupState } from '@/hooks/useSetupState';

// =============================================================================
// ICON RESOLUTION
// =============================================================================

/**
 * Maps the lucide-name strings the registry uses to real lucide
 * components. The registry stays server-safe (no React imports) and
 * this map is the single resolution point for the UI.
 *
 * Adding a new task to the registry: add its icon name to the
 * registry's `icon` field, then add the same name → component
 * mapping here. TypeScript will not catch a missing entry, so the
 * fallback below renders a generic dashed circle to make the gap
 * obvious in dev rather than crashing.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Banknote,
  Home,
  Users,
  Wallet,
  Receipt,
  TrendingUp,
  UserPlus,
};

function resolveIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? CircleDashed;
}

// =============================================================================
// COMPONENT
// =============================================================================

export interface SetupTrayProps {
  /**
   * Optional className appended to the outer container so consumers
   * (e.g. DashboardLayout) can position the tray within their grid
   * without hard-coding the layout here.
   */
  className?: string;
  /**
   * If true, the tray starts collapsed. Defaults to `false` — most
   * users benefit from seeing the full checklist on first load.
   */
  defaultCollapsed?: boolean;
}

export function SetupTray({
  className = '',
  defaultCollapsed = false,
}: SetupTrayProps) {
  const { tasks, progress, isLoading, error } = useSetupState();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);
  const headingId = useId();
  const panelId = useId();

  // Fail silently — the dashboard should never be made worse by a
  // setup-tray fetch error. Logged in the hook already.
  if (error) return null;

  // Initial-load skeleton: stable shape so the dashboard layout
  // doesn't reflow when the data lands.
  if (isLoading && !tasks) {
    return (
      <section
        aria-busy="true"
        aria-label="Loading setup progress"
        className={`rounded-2xl border border-slate-200/70 bg-white/95 p-4 shadow-sm backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/95 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
            <div className="h-2 w-full animate-pulse rounded bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />
          </div>
        </div>
      </section>
    );
  }

  // Hook hasn't resolved yet (no token, etc.) — render nothing.
  if (!tasks || !progress) return null;

  // All done → render the celebratory complete pill instead of the
  // full tray. The pill is dismissible by the parent (Phase B.4).
  if (progress.allDone) {
    return (
      <section
        aria-label="Setup complete"
        className={`flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm backdrop-blur-xl dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-300 ${className}`}
      >
        <Sparkles className="h-4 w-4" />
        <span>Setup complete</span>
        <Check className="h-4 w-4" />
      </section>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={`overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-xl transition-all duration-200 motion-reduce:transition-none dark:border-slate-700/50 dark:bg-slate-900/95 ${className}`}
    >
      {/* Header — always visible, click to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsCollapsed((prev) => !prev)}
        aria-expanded={!isCollapsed}
        aria-controls={panelId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/60 motion-reduce:transition-none dark:hover:bg-slate-800/40"
      >
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.55)]"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.25} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2
              id={headingId}
              className="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              Set up Monitrax
            </h2>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {progress.done} of {progress.total} done
            </span>
          </div>
          {/* Progress bar */}
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={progress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Setup progress: ${progress.percent}%`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none dark:text-slate-500 ${
            isCollapsed ? '' : 'rotate-180'
          }`}
        />
      </button>

      {/* Expandable panel — checklist of task rows */}
      {!isCollapsed && (
        <div
          id={panelId}
          role="list"
          className="border-t border-slate-200/70 px-2 py-2 dark:border-slate-700/50"
        >
          {tasks.map(({ task, isDone }) => {
            const Icon = resolveIcon(task.icon);
            return (
              <Link
                key={task.id}
                href={task.href}
                role="listitem"
                aria-current={isDone ? 'step' : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors motion-reduce:transition-none ${
                  isDone
                    ? 'cursor-default text-slate-400 hover:bg-transparent dark:text-slate-500'
                    : 'text-slate-700 hover:bg-slate-50/80 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-slate-200 dark:hover:bg-slate-800/40 dark:focus:bg-slate-800/40'
                }`}
                tabIndex={isDone ? -1 : 0}
                onClick={(e) => {
                  // Done rows are non-interactive — let users see them
                  // as confirmation but never re-trigger their flow.
                  if (isDone) e.preventDefault();
                }}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    isDone
                      ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-blue-900/40 dark:group-hover:text-blue-400'
                  }`}
                >
                  {isDone ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-medium ${
                      isDone ? 'line-through' : ''
                    }`}
                  >
                    {task.title}
                  </div>
                  {!isDone && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {task.subtitle}
                    </div>
                  )}
                </div>

                {!isDone && (
                  <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 motion-reduce:transition-none dark:text-slate-600 dark:group-hover:text-slate-400"
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default SetupTray;
