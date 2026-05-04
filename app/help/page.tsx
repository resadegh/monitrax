/**
 * Help Center index — lists articles grouped by audience.
 *
 * Audience cards are visually scoped: consumer + org-admin +
 * org-professional + org-client + compliance get cards; monitrax-internal
 * is hidden from public index (still reachable via direct URL gated by
 * Monitrax admin role at the route level when wired in PR2).
 *
 * Empty audiences (no articles authored yet) render a placeholder card
 * with a "coming soon" indication so the IA reads as intentional, not
 * incomplete.
 */
import Link from 'next/link';
import {
  AUDIENCE_DESCRIPTION,
  AUDIENCE_LABEL,
  listArticlesByAudience,
  type HelpAudience,
} from '@/lib/help/content';

const PUBLIC_AUDIENCES: HelpAudience[] = [
  'consumer',
  'compliance',
  'org-admin',
  'org-professional',
  'org-client',
];

export const dynamic = 'force-static';

export default function HelpIndexPage() {
  const sections = PUBLIC_AUDIENCES.map((audience) => ({
    audience,
    articles: listArticlesByAudience(audience),
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16 space-y-12">
      {/* Hero */}
      <section className="text-center max-w-2xl mx-auto">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-700 mb-2">
          Help Center
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">
          How can we help?
        </h1>
        <p className="mt-4 text-base text-slate-600 leading-relaxed">
          Find answers about how Monitrax works for you, your organisation,
          and your compliance team. Every article is reviewed and dated; the
          compliance section is what your auditor will ask for.
        </p>
      </section>

      {/* Audience sections */}
      {sections.map(({ audience, articles }) => (
        <section key={audience} aria-labelledby={`audience-${audience}`}>
          <header className="mb-4">
            <h2
              id={`audience-${audience}`}
              className="text-xl font-semibold tracking-tight text-slate-900"
            >
              {AUDIENCE_LABEL[audience]}
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              {AUDIENCE_DESCRIPTION[audience]}
            </p>
          </header>

          {articles.length === 0 ? (
            <div className="rounded-[22px] bg-white/60 ring-1 ring-slate-900/[0.06] p-6 text-sm text-slate-500">
              Articles for this audience are being authored. Check back soon.
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {articles.map(({ frontmatter }) => (
                <li key={frontmatter.slug}>
                  <Link
                    href={`/help/${audience}/${frontmatter.slug}`}
                    className="block rounded-[22px] bg-white/85 ring-1 ring-slate-900/[0.06] p-5 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(11,18,32,0.18)] motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                        {frontmatter.title}
                      </h3>
                      {frontmatter.complianceClass && (
                        <span className="shrink-0 inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
                          {frontmatter.complianceClass}
                        </span>
                      )}
                    </div>
                    {frontmatter.summary && (
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                        {frontmatter.summary}
                      </p>
                    )}
                    <p className="mt-3 text-[11px] text-slate-400 tabular-nums">
                      Reviewed {frontmatter.lastReviewed}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
