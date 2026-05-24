/**
 * Phase 47 — Public legal-document page.
 *
 * Route: `/legal/<slug>` where slug ∈ {terms-of-service, privacy-policy,
 * afsl-boundary-disclosure}.
 *
 * Anonymous, no auth, statically generated at build. Linked from the
 * registration consent block + the in-app Settings → Legal page (PR 2).
 *
 * Reuses the Phase 33a markdown renderer for SSOT compliance.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getLegalDocument,
  LEGAL_DOCUMENTS,
  type LegalSlug,
} from '@/lib/legal/content';
import { renderMarkdown } from '@/lib/help/markdown';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-static';

export async function generateStaticParams() {
  return (Object.keys(LEGAL_DOCUMENTS) as LegalSlug[]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  if (!(slug in LEGAL_DOCUMENTS)) return {};
  const doc = getLegalDocument(slug as LegalSlug);
  if (!doc) return {};
  return {
    title: `${doc.frontmatter.title} · Monitrax`,
    description: doc.frontmatter.summary,
  };
}

export default async function LegalDocumentPage({ params }: PageProps) {
  const { slug } = await params;
  if (!(slug in LEGAL_DOCUMENTS)) notFound();
  const doc = getLegalDocument(slug as LegalSlug);
  if (!doc) notFound();

  const isDraft = doc.frontmatter.status === 'DRAFT';
  const html = renderMarkdown(doc.body);

  return (
    <div className="min-h-screen bg-white text-stone-900">
      <header className="border-b border-stone-200 px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            <span className="font-semibold">Monitrax</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-stone-500">
            <Link href="/legal/terms-of-service" className="hover:text-stone-900">Terms</Link>
            <Link href="/legal/privacy-policy" className="hover:text-stone-900">Privacy</Link>
            <Link href="/legal/afsl-boundary-disclosure" className="hover:text-stone-900">AFSL</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {isDraft && (
          <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Draft version.</strong> This document is pending counsel review and is shown for development testing only. Do not rely on it.
          </div>
        )}
        <div className="mb-6 text-xs uppercase tracking-wider text-stone-500">
          <span>Version {doc.frontmatter.version}</span>
          <span className="mx-2">·</span>
          <span>Effective from {doc.frontmatter.effectiveFrom}</span>
        </div>
        <article
          className="prose prose-stone max-w-none prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h3:text-lg prose-a:text-stone-900 prose-a:underline"
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <footer className="mt-16 border-t border-stone-200 pt-8 text-sm text-stone-500">
          <p>If you have a question about this document, contact us at <a href="mailto:privacy@monitrax.com.au" className="underline">privacy@monitrax.com.au</a>.</p>
        </footer>
      </main>
    </div>
  );
}
