/**
 * Phase 33c — Help article print view (Save as PDF).
 *
 * Route: `/print/help/<audience>/<slug>`
 *
 * Renders the same canonical Markdown article as the screen version
 * (`lib/help/content.ts` → `getArticle()`) but with a print-optimised
 * stylesheet, a paginated header/footer carrying provenance (URL +
 * reviewed date), and an auto-triggered browser print dialog so the
 * user lands here and the "Save as PDF" sheet opens.
 *
 * Why browser-native PDF instead of a server-side renderer:
 *   - Zero new dependencies (the registry would have added 1,000+
 *     packages for `@react-pdf/renderer`; rejected per CLAUDE.md §12.7
 *     and the same zero-dep posture used in `lib/help/markdown.ts`).
 *   - Every browser has a deterministic, accessible print pipeline.
 *     Stripe Docs, MDN, and GitHub all use this approach for the same
 *     reason — output is consistent across Chrome / Safari / Firefox,
 *     respects user paper-size + orientation preferences, and the file
 *     stays selectable / searchable in the resulting PDF.
 *   - Compliance auditors care about evidence + provenance, not pixel
 *     polish. The header carries the article slug + reviewed date + the
 *     canonical URL — all the provenance an audit pack needs.
 *
 * Layout strategy:
 *   - This route lives OUTSIDE `/help/*` so it bypasses
 *     `app/help/layout.tsx` (brand nav, footer). The print view is a
 *     genuinely different surface — clean document, no chrome.
 *   - `app/print/help/[...slug]/layout.tsx` is a tiny white-background
 *     wrapper. Nothing else.
 *   - Auto-print: a small client component (`AutoPrint`) calls
 *     `window.print()` after fonts settle. Re-triggerable via the
 *     toolbar link so a dismissed dialog isn't a dead-end.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AUDIENCE_LABEL,
  getAllArticleParams,
  getArticle,
  type HelpAudience,
} from '@/lib/help/content';
import { AutoPrint } from './AutoPrint';

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
    title: `${article.frontmatter.title} · Print · Monitrax Help`,
    description: article.frontmatter.summary ?? undefined,
    robots: { index: false, follow: false },
  };
}

const PRINT_CSS = `
  [data-print-root] {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 32px 48px;
    color: #0f172a;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #ffffff;
  }
  [data-print-root] [data-print-toolbar] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    margin-bottom: 24px;
    border-radius: 12px;
    background: #f1f5f9;
    color: #334155;
    font-size: 12px;
  }
  [data-print-root] [data-print-toolbar] a {
    appearance: none;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #0f172a;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 999px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.12s ease;
  }
  [data-print-root] [data-print-toolbar] a:hover {
    background: #f8fafc;
  }

  [data-print-root] [data-print-doc-header] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 2px solid #0f172a;
    margin-bottom: 24px;
  }
  [data-print-root] [data-print-brand] {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    letter-spacing: -0.01em;
    font-size: 14px;
    color: #0f172a;
  }
  [data-print-root] [data-print-brand] [data-print-mark] {
    width: 22px; height: 22px; border-radius: 6px;
    background: #0f172a; color: #ffffff;
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
  }
  [data-print-root] [data-print-meta] {
    font-size: 11px;
    color: #475569;
    text-align: right;
    line-height: 1.5;
  }

  [data-print-root] h1.doc-title {
    font-size: 28px;
    line-height: 1.2;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #0f172a;
    margin: 0 0 8px;
  }
  [data-print-root] p.doc-summary {
    color: #475569;
    font-size: 15px;
    line-height: 1.6;
    margin: 0 0 16px;
  }
  [data-print-root] [data-print-tag] {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: #ecfdf5;
    color: #047857;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 12px;
  }

  [data-print-root] [data-print-body] {
    font-size: 14px;
    line-height: 1.65;
    color: #1e293b;
  }
  [data-print-root] [data-print-body] h1,
  [data-print-root] [data-print-body] h2,
  [data-print-root] [data-print-body] h3,
  [data-print-root] [data-print-body] h4 {
    color: #0f172a;
    page-break-after: avoid;
  }
  [data-print-root] [data-print-body] pre {
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    page-break-inside: avoid;
  }
  [data-print-root] [data-print-body] blockquote {
    page-break-inside: avoid;
  }
  [data-print-root] [data-print-body] a {
    color: #047857 !important;
    text-decoration: underline;
  }

  [data-print-root] [data-print-doc-footer] {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    color: #64748b;
    font-size: 11px;
    line-height: 1.5;
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }
  [data-print-root] [data-print-doc-footer] [data-print-url] {
    word-break: break-all;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
  }

  @media print {
    @page {
      size: A4;
      margin: 18mm 16mm 22mm 16mm;
    }
    [data-print-root] [data-print-toolbar] { display: none !important; }
    [data-print-root] {
      max-width: none;
      margin: 0;
      padding: 0;
    }
    [data-print-root] [data-print-body] pre,
    [data-print-root] [data-print-body] blockquote,
    [data-print-root] [data-print-body] li {
      page-break-inside: avoid;
    }
    a { color: #047857 !important; }
  }
`;

export default async function HelpArticlePrintPage({ params }: PageProps) {
  const { slug } = await params;
  if (slug.length !== 2) notFound();
  const [audience, articleSlug] = slug;
  if (!VALID_AUDIENCES.includes(audience as HelpAudience)) notFound();
  const article = getArticle(audience as HelpAudience, articleSlug);
  if (!article) notFound();

  const audienceLabel = AUDIENCE_LABEL[audience as HelpAudience];
  const canonicalPath = `/help/${audience}/${articleSlug}`;
  const canonicalUrl = `https://www.monitrax.com.au${canonicalPath}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <AutoPrint />
      <div data-print-root>
        <div data-print-toolbar>
          <span>
            Print preview &middot; use your browser&rsquo;s Print dialog &rarr;
            choose &ldquo;Save as PDF&rdquo;.
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <Link href={canonicalPath}>Back to article</Link>
            <a href="#" data-print-trigger>
              Open print dialog
            </a>
          </span>
        </div>

        <header data-print-doc-header>
          <span data-print-brand>
            <span data-print-mark>M</span>
            Monitrax Help
          </span>
          <span data-print-meta>
            {audienceLabel}
            {article.frontmatter.category && ` · ${article.frontmatter.category}`}
            <br />
            Reviewed {article.frontmatter.lastReviewed}
          </span>
        </header>

        {article.frontmatter.complianceClass && (
          <span data-print-tag>{article.frontmatter.complianceClass}</span>
        )}
        <h1 className="doc-title">{article.frontmatter.title}</h1>
        {article.frontmatter.summary && (
          <p className="doc-summary">{article.frontmatter.summary}</p>
        )}

        <div
          data-print-body
          // eslint-disable-next-line react/no-danger -- canonical zero-dep
          // markdown renderer (`lib/help/markdown.ts`) — same renderer the
          // screen view uses; HTML is escaped, links are scheme-restricted.
          dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
        />

        <footer data-print-doc-footer>
          <span>
            Monitrax — wealth orchestration for Australian households and the
            professionals who advise them.
          </span>
          <span data-print-url>{canonicalUrl}</span>
        </footer>
      </div>
    </>
  );
}
