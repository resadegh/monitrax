'use client';

/**
 * PortalPageHero — page-level glass hero shared across all Org Portal
 * surfaces. Replaces the old `PracticeHeader` + duplicate
 * `<h1>` / `<p>` page-title block with a single Phase-39-aligned hero.
 *
 * Defaults are tuned for the "section landing page" pattern (page
 * title + subtitle + optional action). For the dashboard, use
 * `<GlassHero>` directly with KPI cells — this wrapper is for
 * non-dashboard portal surfaces where the hero is purely
 * orientation, not metric-driven.
 *
 * Composes <GlassHero> from components/shell — never re-implements
 * the glass + atmosphere pattern locally.
 */

import { ReactNode } from 'react';
import type { OrganizationType } from '@prisma/client';
import {
  GlassHero,
  GlassHeroEyebrow,
  type GlassHeroAtmosphere,
} from '@/components/shell';

interface PortalPageHeroProps {
  /** Atmosphere palette. Defaults to sky (Practice / Stage I — Invest). */
  atmosphere?: GlassHeroAtmosphere;
  /** Practice label badge text — e.g. "Financial advisor", "Mortgage broker". */
  practiceLabel?: string;
  /** First-name greeting recipient. Optional. */
  greetingName?: string;
  /** Page title — large bold headline. */
  title: string;
  /** Optional one-line subtitle below title. */
  subtitle?: string;
  /** Right-aligned action slot (button row, link, etc.). */
  actions?: ReactNode;
  /** Optional KPI rail composed by caller (use GlassHeroKpiCell children). */
  kpis?: ReactNode;
  /** Profession identifier — currently unused but preserved for future
      profession-driven theming. */
  profession?: OrganizationType;
}

export function PortalPageHero({
  atmosphere = 'sky',
  practiceLabel,
  greetingName,
  title,
  subtitle,
  actions,
  kpis,
}: PortalPageHeroProps) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <GlassHero atmosphere={atmosphere}>
      {(practiceLabel || greetingName) && (
        <GlassHeroEyebrow
          label={greetingName ? `${greeting}, ${greetingName}` : greeting}
          badge={
            practiceLabel ? (
              <span className="inline-flex items-center rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                {practiceLabel}
              </span>
            ) : undefined
          }
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 lg:justify-end">{actions}</div>
        )}
      </div>

      {kpis && <div className="mt-6">{kpis}</div>}
    </GlassHero>
  );
}
