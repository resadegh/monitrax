'use client';

/**
 * EmptyStateTile — Phase 12 v3 (dashboard-as-onboarding)
 *
 * The reusable shell for "examples as instruction" empty states on
 * dashboard tiles. Replaces the legacy "show zeros and a sad face"
 * empty state with a purposeful teaching surface that:
 *
 *   1. Shows the user a static example illustration of what the tile
 *      will look like once populated (an image, a screenshot, an SVG,
 *      or just a stylised icon — never fake data rows).
 *   2. Explains in one sentence what the tile does and what adding
 *      data unlocks.
 *   3. Offers a single primary CTA that opens the real entity dialog
 *      on the dashboard — never a wizard step.
 *
 * This is the §2.2 "examples as instruction" pattern from the v3
 * plan, distilled into a single reusable shell so every tile that
 * needs an empty state can drop the same pattern in without
 * reinventing the layout.
 *
 * UX shape:
 *
 *   ┌─────────────────────────────────────────────┐
 *   │                                             │
 *   │   ┌───────────────────────────┐            │
 *   │   │                           │             │
 *   │   │      [illustration]       │  ← example  │
 *   │   │                           │    image,   │
 *   │   └───────────────────────────┘    not data │
 *   │                                             │
 *   │   Track your properties                     │  ← title
 *   │   See equity, LVR, and net worth in        │  ← description
 *   │   one place.                                │
 *   │                                             │
 *   │   ⚡ Unlocks net-worth tracking            │  ← unlocks
 *   │                                             │
 *   │   [ Add your first property → ]            │  ← primary CTA
 *   │                                             │
 *   └─────────────────────────────────────────────┘
 *
 * Architecture decisions:
 *   - Pure presentational. Zero state, zero hooks (other than no-op
 *     'use client' for the Link), zero business logic. Composable
 *     by props.
 *   - The illustration is a `ReactNode` slot, not an image src, so
 *     callers can pass a `<NextImage>`, an inline SVG, an icon, or
 *     even a small JSX tree of placeholder shapes. Keeps this shell
 *     fully decoupled from how each tile's example is sourced.
 *   - Per CLAUDE.md §6 ground rules: dark-mode native (`dark:`
 *     variants throughout), `prefers-reduced-motion` honoured via
 *     Tailwind `motion-reduce:` variants, ARIA `role="region"` with
 *     a labelling heading, primary CTA is a real `<Link>` so the
 *     browser handles focus, keyboard, and middle-click for free.
 *   - Per §11 keep/remove matrix: the styling vocabulary inherits
 *     from the existing wizard design tokens (`from-blue-500 via-
 *     indigo-500 to-violet-500`, `rounded-2xl`, etc.) so the empty
 *     states feel like the rest of v3 without depending on the
 *     wizard primitives module.
 *   - No fake data, ever. The illustration prop is ALWAYS visually
 *     distinct from real data (callers must use static SVG /
 *     screenshots, never seeded rows from the database).
 *
 * See:
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.2 (empty-state tiles)
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §10 (5 magic moments)
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

// =============================================================================
// PROPS
// =============================================================================

export interface EmptyStateTileCta {
  /** Visible button label, e.g. "Add your first property". */
  label: string;
  /**
   * Deep-link target. Always a real dashboard dialog or page —
   * never a wizard step. Uses the same href shape as the Setup
   * Tray task registry (`/dashboard/properties?action=add`).
   */
  href: string;
}

// Phase 12 twin-track (A.3/A.5): visual-priority and confidence-state
// unions. These are optional props so existing callers continue to
// render with the default "secondary" priority and no badge.
export type EmptyStateTilePriority = 'primary' | 'secondary' | 'dimmed';
export type EmptyStateTileConfidence = 'Missing' | 'Estimated' | 'Verified';

export interface EmptyStateTileProps {
  /**
   * The example illustration. Pass an `<Image>`, inline SVG, lucide
   * icon, or a small JSX tree of placeholder shapes. NEVER fake data
   * rows from the database — that's the whole point of this shell.
   * Optional: tiles that don't have an illustration yet can still
   * use the shell with just the headline + CTA.
   */
  illustration?: ReactNode;

  /**
   * One-sentence headline above the description. Sets the topic of
   * the tile in the user's words ("Track your properties", not
   * "Properties module").
   */
  title: string;

  /**
   * One- or two-sentence body explaining what the tile shows once
   * data lands. Plain language, end-user voice.
   */
  description: string;

  /**
   * Optional "what this unlocks" subline. Renders as a small chip
   * below the description with a sparkles icon. Use it to anchor
   * the user's reason for filling this tile in: "Unlocks net-worth
   * tracking" / "Powers cashflow forecasts" / etc.
   */
  unlocks?: string;

  /**
   * Phase 12 twin-track (A.4): "why this matters" explanatory line
   * with a `→` prefix. Rendered as a small muted line below the
   * description. Different from `unlocks` — `whyThisMatters` is an
   * imperative why-the-user-should-care line; `unlocks` is a chip
   * noting what capability appears. Use either or both.
   */
  whyThisMatters?: string;

  /** Primary call-to-action. Required — every empty state must have a way out. */
  cta: EmptyStateTileCta;

  /**
   * Optional secondary action, rendered as a ghost button below the
   * primary CTA. Use sparingly — most tiles ship with just the
   * primary CTA. Common use: "Connect a bank instead" on a manual-
   * entry empty state.
   */
  secondaryCta?: EmptyStateTileCta;

  /**
   * Optional className appended to the outer container so consumers
   * (a specific tile component) can constrain height, override
   * spacing, or position the shell within their grid.
   */
  className?: string;

  /**
   * Compact mode renders a smaller, vertically tighter version
   * suited to half-width or quarter-width tiles. Default: false
   * (full-size).
   */
  compact?: boolean;

  /**
   * Phase 12 twin-track (A.3): visual priority state. Defaults to
   * `'secondary'` so existing unbranded callers stay unchanged.
   *   - primary   → gradient border, elevated shadow, blue glow
   *   - secondary → default (current) appearance
   *   - dimmed    → opacity-60, reduced visual weight
   */
  priority?: EmptyStateTilePriority;

  /**
   * Phase 12 twin-track (A.5): confidence state badge rendered in
   * the top-right corner of the tile. Reflects whether the module
   * has any rows and whether they're from onboarding estimates or
   * verified data.
   *   - Missing   → no badge (default visual, tile is empty)
   *   - Estimated → amber "Estimated" badge
   *   - Verified  → emerald "Verified" badge
   */
  confidenceState?: EmptyStateTileConfidence;

  /**
   * Phase 12 twin-track (A.7-A.12): optional click interceptor for
   * the primary CTA. When provided, the CTA renders as a `<button>`
   * and calls this handler on click instead of navigating to
   * `cta.href`. Used by `<DashboardEmptyStateGrid />` to open the
   * lightweight `<GuidedEntryModal />` flow instead of dumping the
   * user into the full entity page.
   */
  onCtaClick?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EmptyStateTile({
  illustration,
  title,
  description,
  unlocks,
  whyThisMatters,
  cta,
  secondaryCta,
  className = '',
  compact = false,
  priority = 'secondary',
  confidenceState = 'Missing',
  onCtaClick,
}: EmptyStateTileProps) {
  const padding = compact ? 'p-5' : 'p-6 sm:p-8';
  const titleSize = compact ? 'text-base' : 'text-lg';
  const descriptionSize = compact ? 'text-xs' : 'text-sm';
  const illustrationMargin = compact ? 'mb-3' : 'mb-5';

  // Phase 12 twin-track (A.3): priority visual state classes
  const priorityClasses: Record<EmptyStateTilePriority, string> = {
    primary:
      'border-indigo-300 bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-violet-50/60 shadow-[0_14px_40px_-12px_rgba(99,102,241,0.35)] dark:border-indigo-700/60 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/30',
    secondary: 'border-slate-200/70 bg-white/95 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/95',
    dimmed:
      'border-slate-200/50 bg-white/60 shadow-none opacity-60 dark:border-slate-700/30 dark:bg-slate-900/60',
  };

  // Phase 12 twin-track (A.5): confidence badge styles. Missing state
  // renders no badge (undefined).
  const confidenceBadge =
    confidenceState === 'Estimated'
      ? {
          label: 'Estimated',
          className:
            'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        }
      : confidenceState === 'Verified'
      ? {
          label: 'Verified',
          className:
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
        }
      : null;

  return (
    <section
      role="region"
      aria-label={title}
      className={`relative flex flex-col items-center justify-center rounded-2xl border text-center backdrop-blur-xl ${priorityClasses[priority]} ${padding} ${className}`}
    >
      {/* Phase 12 twin-track (A.5): confidence badge in top-right
          corner. Rendered only when the module has rows. */}
      {confidenceBadge && (
        <span
          className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadge.className}`}
        >
          {confidenceBadge.label}
        </span>
      )}
      {/* Example illustration slot — purely visual, marked aria-hidden
          so screen readers don't try to interpret a stylised SVG. */}
      {illustration && (
        <div
          aria-hidden="true"
          className={`flex items-center justify-center text-slate-400 dark:text-slate-500 ${illustrationMargin}`}
        >
          {illustration}
        </div>
      )}

      <h3
        className={`font-semibold tracking-tight text-slate-900 dark:text-slate-100 ${titleSize}`}
      >
        {title}
      </h3>

      <p
        className={`mt-1.5 max-w-sm text-slate-600 dark:text-slate-400 ${descriptionSize}`}
      >
        {description}
      </p>

      {/* Phase 12 twin-track (A.4): why-this-matters explanatory line.
          Renders as a small muted line with a → prefix, anchoring the
          user's reason for filling this tile in. */}
      {whyThisMatters && (
        <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-500">
          → {whyThisMatters}
        </p>
      )}

      {unlocks && (
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          {unlocks}
        </span>
      )}

      <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row">
        {onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)] transition-all hover:-translate-y-[1px] hover:shadow-[0_14px_36px_-12px_rgba(99,102,241,0.65)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <Link
            href={cta.href}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)] transition-all hover:-translate-y-[1px] hover:shadow-[0_14px_36px_-12px_rgba(99,102,241,0.65)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            {cta.label}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}

        {secondaryCta && (
          <Link
            href={secondaryCta.href}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 motion-reduce:transition-none dark:text-slate-400 dark:hover:text-slate-200 dark:focus-visible:ring-slate-600"
          >
            {secondaryCta.label}
          </Link>
        )}
      </div>
    </section>
  );
}

export default EmptyStateTile;
