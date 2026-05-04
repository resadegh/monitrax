/**
 * Help Center — drawer feed endpoint.
 *
 * Powers the in-app `?` slide-in drawer. Returns:
 *   - The primary article for the caller's current pathname (resolved via
 *     `lib/help/routeContext.ts`), already rendered to HTML
 *   - The list of articles in the audiences the caller is allowed to see
 *     (for the fallback list + search filter)
 *
 * Help content is non-sensitive (already publicly browsable at `/help`),
 * so this route is unauthenticated by design. The caller passes the
 * audience set it wants to scope to via `?audiences=...`; we validate that
 * against the public audience whitelist so a malicious caller can't
 * peek at `monitrax-internal`.
 *
 * Pin to Node + syd1 to match the rest of the API plane.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  AUDIENCE_LABEL,
  getArticle,
  listArticlesByAudience,
  type HelpAudience,
  type HelpArticleSummary,
} from '@/lib/help/content';
import { resolveRouteTarget } from '@/lib/help/routeContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'syd1';

const PUBLIC_AUDIENCES: ReadonlySet<HelpAudience> = new Set([
  'consumer',
  'org-admin',
  'org-professional',
  'org-client',
  'compliance',
]);

const parseAudiences = (raw: string | null): HelpAudience[] => {
  if (!raw) return ['consumer', 'compliance'];
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  const filtered = parts.filter((p): p is HelpAudience =>
    PUBLIC_AUDIENCES.has(p as HelpAudience),
  );
  return filtered.length > 0 ? filtered : ['consumer', 'compliance'];
};

interface DrawerArticleSummaryPayload {
  audience: HelpAudience;
  audienceLabel: string;
  title: string;
  slug: string;
  summary: string | null;
  category: string | null;
  complianceClass: string | null;
  lastReviewed: string;
  href: string;
}

const toSummaryPayload = (
  audience: HelpAudience,
  s: HelpArticleSummary,
): DrawerArticleSummaryPayload => ({
  audience,
  audienceLabel: AUDIENCE_LABEL[audience],
  title: s.frontmatter.title,
  slug: s.frontmatter.slug,
  summary: s.frontmatter.summary ?? null,
  category: s.frontmatter.category ?? null,
  complianceClass: s.frontmatter.complianceClass ?? null,
  lastReviewed: s.frontmatter.lastReviewed,
  href: `/help/${audience}/${s.frontmatter.slug}`,
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  const overrideAudience = url.searchParams.get('audience') as HelpAudience | null;
  const overrideSlug = url.searchParams.get('slug');
  const audiences = parseAudiences(url.searchParams.get('audiences'));

  // Build the audience-scoped article list once — used for both the
  // fallback list and the (now happily simple) search filter.
  const audienceArticles = audiences.flatMap((aud) =>
    listArticlesByAudience(aud).map((s) => toSummaryPayload(aud, s)),
  );

  // Resolve the primary article. Priority:
  //   1. Explicit ?audience=...&slug=... override (drawer "navigate to article")
  //   2. Pathname → route registry match
  //   3. null (drawer shows the audience list)
  let primary: ReturnType<typeof getArticle> = null;
  let primaryAudience: HelpAudience | null = null;

  if (overrideAudience && overrideSlug && PUBLIC_AUDIENCES.has(overrideAudience)) {
    primary = getArticle(overrideAudience, overrideSlug);
    primaryAudience = overrideAudience;
  } else {
    const target = resolveRouteTarget(path);
    if (target && audiences.includes(target.audience)) {
      primary = getArticle(target.audience, target.slug);
      primaryAudience = target.audience;
    }
  }

  return NextResponse.json({
    primary: primary && primaryAudience
      ? {
          audience: primaryAudience,
          audienceLabel: AUDIENCE_LABEL[primaryAudience],
          title: primary.frontmatter.title,
          slug: primary.frontmatter.slug,
          summary: primary.frontmatter.summary ?? null,
          category: primary.frontmatter.category ?? null,
          complianceClass: primary.frontmatter.complianceClass ?? null,
          lastReviewed: primary.frontmatter.lastReviewed,
          bodyHtml: primary.bodyHtml,
          href: `/help/${primaryAudience}/${primary.frontmatter.slug}`,
        }
      : null,
    articles: audienceArticles,
    audiences,
  });
}
