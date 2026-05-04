/**
 * Help article page — `/help/<audience>/<slug>`.
 *
 * Statically generated at build for every article that exists at build
 * time. New articles authored later trigger a fresh build (or a rebuild
 * via Vercel ISR if revalidate is configured).
 *
 * Slug shape: `[...slug]` captures both the audience segment and the
 * article slug (`/help/consumer/what-is-trail` → `slug = ['consumer',
 * 'what-is-trail']`). Anything else 404s.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AUDIENCE_LABEL,
  getAllArticleParams,
  getArticle,
  type HelpAudience,
} from '@/lib/help/content';

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

const VALID_AUDIENCES: HelpAudience[] = [
  'consumer',
  'org-admin',
  'org-professional',
  'org-client',
  'monitrax-internal',
  'compliance',
];

export const dynamic = 'force-static';

export async function generateStaticParams() {
  return getAllArticleParams();
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  if (slug.length !== 2) return {};
  const [audience, articleSlug] = slug;
  if (!VALID_AUDIENCES.includes(audience as HelpAudience)) return {};
  const article = getArticle(audience as HelpAudience, articleSlug);
  if (!article) return {};
  return {
    title: `${article.frontmatter.title} · Monitrax Help`,
    description: article.frontmatter.summary ?? undefined,
  };
}

export default async function HelpArticlePage({ params }: PageProps) {
  const { slug } = await params;
  if (slug.length !== 2) notFound();
  const [audience, articleSlug] = slug;
  if (!VALID_AUDIENCES.includes(audience as HelpAudience)) notFound();
  const article = getArticle(audience as HelpAudience, articleSlug);
  if (!article) notFound();

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-6">
        <Link href="/help" className="hover:text-slate-900 transition-colors">
          Help Center
        </Link>
        <span className="mx-2 text-slate-300">/</span>
        <Link
          href={`/help#audience-${audience}`}
          className="hover:text-slate-900 transition-colors"
        >
          {AUDIENCE_LABEL[audience as HelpAudience]}
        </Link>
      </nav>

      <header className="mb-8 pb-8 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4 mb-3">
          {article.frontmatter.complianceClass ? (
            <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em]">
              {article.frontmatter.complianceClass}
            </span>
          ) : (
            <span />
          )}
          <Link
            href={`/print/help/${audience}/${articleSlug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-full ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700 transition-colors print:hidden"
            aria-label="Download this article as PDF"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5v8m0 0L4.5 6m3.5 3.5L11.5 6M2.5 11v2A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download as PDF
          </Link>
        </div>
        <h1 className="text-3xl sm:text-[34px] font-semibold tracking-tight text-slate-900 leading-tight">
          {article.frontmatter.title}
        </h1>
        {article.frontmatter.summary && (
          <p className="mt-3 text-lg text-slate-600 leading-relaxed">
            {article.frontmatter.summary}
          </p>
        )}
        <p className="mt-4 text-[11px] text-slate-500 tabular-nums">
          Reviewed {article.frontmatter.lastReviewed}
          {article.frontmatter.category && ` · ${article.frontmatter.category}`}
        </p>
      </header>

      <div
        className="text-slate-700"
        // eslint-disable-next-line react/no-danger -- markdown renderer
        // is the zero-dep one in `lib/help/markdown.ts`; HTML inputs are
        // escaped, links are scheme-restricted, no inline HTML pass-through
        dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
      />

      <footer className="mt-12 pt-8 border-t border-slate-200 text-sm text-slate-500">
        <p>
          Need something this article didn&rsquo;t answer?{' '}
          <Link href="/help" className="text-emerald-700 underline decoration-emerald-200 underline-offset-2 hover:decoration-emerald-500">
            Browse the rest of the Help Center
          </Link>{' '}
          or contact support.
        </p>
      </footer>
    </article>
  );
}
