/**
 * Help Center — route → primary article registry.
 *
 * Maps a pathname (or pathname pattern) to the help article that should
 * surface FIRST when the in-app `?` drawer opens on that route. The drawer
 * still falls back to the user's audience landing list if no entry matches,
 * so this registry is *additive* — it sharpens the answer for routes we
 * have curated content for, and degrades gracefully everywhere else.
 *
 * Matching is longest-prefix-wins so that the more specific entry (e.g.
 * `/dashboard/cfo`) trumps the broader one (e.g. `/dashboard`).
 *
 * Adding a new mapping:
 *   1. Author the article under `docs/help/<audience>/<slug>.md`
 *   2. Add a row below pointing the relevant route at it
 *   3. Done — the drawer picks it up at next request (no client rebuild)
 *
 * Phase 33b — see `docs/changelog/CHANGELOG_2026_05_04.md`.
 */
import type { HelpAudience } from './content';

export interface HelpRouteTarget {
  audience: HelpAudience;
  slug: string;
}

export interface HelpRouteRule {
  /**
   * Pathname prefix to match (longest match wins). Trailing slash optional.
   * Use `/` to match the root only, `/dashboard` to match `/dashboard` and
   * its descendants.
   */
  prefix: string;
  target: HelpRouteTarget;
}

/**
 * Curated mappings. Order doesn't matter — resolver picks longest match.
 * Targets must be authored articles in `docs/help/<audience>/<slug>.md`.
 */
const RULES: readonly HelpRouteRule[] = [
  // Consumer surfaces
  { prefix: '/dashboard/cfo', target: { audience: 'consumer', slug: 'what-is-trail' } },
  { prefix: '/dashboard', target: { audience: 'consumer', slug: 'what-is-trail' } },
  { prefix: '/cashflow', target: { audience: 'consumer', slug: 'what-is-trail' } },
  { prefix: '/health', target: { audience: 'consumer', slug: 'what-is-trail' } },

  // Portal / org-pro surfaces
  { prefix: '/portal/clients', target: { audience: 'org-admin', slug: 'inviting-clients' } },
  { prefix: '/portal/team', target: { audience: 'org-admin', slug: 'inviting-clients' } },
  { prefix: '/portal/dashboard', target: { audience: 'org-admin', slug: 'inviting-clients' } },
  { prefix: '/portal', target: { audience: 'org-admin', slug: 'inviting-clients' } },

  // Public / consent
  { prefix: '/portal/consent', target: { audience: 'compliance', slug: 'cdr-consent-walkthrough' } },
] as const;

/**
 * Resolve the primary help article for a pathname. Returns null when no
 * mapping is registered — caller should fall back to the audience landing
 * list.
 */
export function resolveRouteTarget(pathname: string | null | undefined): HelpRouteTarget | null {
  if (!pathname) return null;
  // Normalise trailing slash (except root).
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  let bestMatch: HelpRouteRule | null = null;
  for (const rule of RULES) {
    const prefix = rule.prefix;
    if (path === prefix || path.startsWith(prefix + '/')) {
      if (!bestMatch || prefix.length > bestMatch.prefix.length) {
        bestMatch = rule;
      }
    }
  }
  return bestMatch ? bestMatch.target : null;
}

/**
 * Audiences a viewer is allowed to see in the drawer. Mirrors the public
 * site's PUBLIC_AUDIENCES with one addition: authenticated users gain
 * access to the audiences relevant to their context. We surface a generous
 * set — the drawer is non-destructive and the public site already exposes
 * all of these — but `monitrax-internal` is never returned here.
 */
export function audiencesForViewer(opts: {
  isAuthenticated: boolean;
  hasOrgMembership: boolean;
}): HelpAudience[] {
  if (opts.hasOrgMembership) {
    return ['consumer', 'org-admin', 'org-professional', 'org-client', 'compliance'];
  }
  if (opts.isAuthenticated) {
    return ['consumer', 'compliance'];
  }
  return ['consumer', 'compliance'];
}
