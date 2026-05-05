/**
 * Help Center — route → primary article registry.
 *
 * Maps a pathname to the help article that should surface FIRST when the
 * in-app `?` drawer opens on that route. Falls back to the user's audience
 * landing list when no rule matches.
 *
 * Phase 33h (2026-05-09): the registry is now **derived from article
 * frontmatter** — each article in `docs/help/<audience>/<slug>.md` declares
 * its own `routeContext` (single string, single glob, or array of either).
 * Adding a new mapping = author the article + set the field. No code edit.
 *
 * Glob support is suffix-only:
 *   - `/foo`     matches only `/foo`
 *   - `/foo/*`   matches `/foo` AND `/foo/bar` AND `/foo/bar/baz` etc.
 *
 * Longest-matching-prefix wins. Articles flagged
 * `status: DRAFT_AI_SCAFFOLD` are excluded from resolution.
 *
 * The previous hardcoded `RULES` array (5 entries from Phase 33b) is
 * removed — its content is now expressed inside the article frontmatter
 * of each target article.
 */
import 'server-only';
import { listAllArticles, type HelpAudience } from './content';

export interface HelpRouteTarget {
  audience: HelpAudience;
  slug: string;
}

/**
 * Internal: a single route → target binding derived from one article's
 * `routeContext` field. One article with `routeContext: [a, b]` produces
 * two of these.
 */
interface DerivedRule {
  pattern: string; // exact path or `/foo/*` suffix-glob
  prefix: string;  // for matching: `/foo/*` becomes `/foo`
  isGlob: boolean;
  target: HelpRouteTarget;
}

const normalisePath = (p: string): string =>
  p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;

/**
 * Build the resolver rule set from every published article's frontmatter.
 * Called fresh on each `resolveRouteTarget` invocation — `listAllArticles`
 * walks the file tree but at our scale (10s of articles) this is fine and
 * keeps the resolver hot-reloadable in dev.
 */
function buildRules(): DerivedRule[] {
  const articles = listAllArticles();
  const out: DerivedRule[] = [];
  for (const a of articles) {
    if (a.frontmatter.status === 'DRAFT_AI_SCAFFOLD') continue;
    const rc = a.frontmatter.routeContext;
    if (!rc) continue;
    const patterns = Array.isArray(rc) ? rc : [rc];
    for (const raw of patterns) {
      const pattern = String(raw).trim();
      if (!pattern) continue;
      const isGlob = pattern.endsWith('/*');
      const prefix = isGlob ? pattern.slice(0, -2) : pattern;
      out.push({
        pattern,
        prefix: normalisePath(prefix),
        isGlob,
        target: {
          audience: a.frontmatter.audience,
          slug: a.frontmatter.slug,
        },
      });
    }
  }
  return out;
}

/**
 * Resolve the primary help article for a pathname. Returns null when no
 * rule matches — caller should fall back to the audience landing list.
 *
 * Match precedence: longest matching prefix wins. Within equal-length
 * prefixes, exact (non-glob) wins over glob.
 */
export function resolveRouteTarget(
  pathname: string | null | undefined,
): HelpRouteTarget | null {
  if (!pathname) return null;
  const path = normalisePath(pathname);

  let best: DerivedRule | null = null;
  for (const rule of buildRules()) {
    const exactMatch = !rule.isGlob && path === rule.prefix;
    const globMatch =
      rule.isGlob && (path === rule.prefix || path.startsWith(rule.prefix + '/'));
    if (!exactMatch && !globMatch) continue;
    if (!best) {
      best = rule;
      continue;
    }
    // Longest prefix wins; tie → exact beats glob.
    if (rule.prefix.length > best.prefix.length) {
      best = rule;
    } else if (
      rule.prefix.length === best.prefix.length &&
      !rule.isGlob &&
      best.isGlob
    ) {
      best = rule;
    }
  }
  return best ? best.target : null;
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
