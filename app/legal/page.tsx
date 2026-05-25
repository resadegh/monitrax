/**
 * Phase 47 — Legal documents index page.
 *
 * Public, anonymous, statically generated. Lists all 13 published legal
 * documents grouped by category. The "Read" link on each card opens the
 * full text at `/legal/<slug>`. Linked from the Footer + Settings → Legal
 * + the legal-route header "All documents" link.
 *
 * Behavioural framing: this is the user-facing "table of contents" for
 * the policy library. Calm typography, no marketing chrome. The 3
 * mandatory documents are listed first (matches the signup tick order);
 * supporting documents follow grouped by purpose.
 */

import Link from 'next/link';
import { listLegalDocumentsByCategory } from '@/lib/legal/content';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Legal documents · Monitrax',
  description: 'The full set of Monitrax legal documents, policies, and disclosures.',
};

export default async function LegalIndexPage() {
  const { mandatory, supporting } = listLegalDocumentsByCategory();

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
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900">← Back to Monitrax</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Legal documents</h1>
        <p className="text-stone-600 mt-2">
          The full set of Monitrax legal documents, policies, and disclosures. Operated by ReNew Holding Company Pty Ltd (ACN 675 267 311).
        </p>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-4">
            Documents you accept at signup
          </h2>
          <ul className="space-y-2">
            {mandatory.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/legal/${d.slug}`}
                  className="block rounded-lg border border-stone-200 hover:border-stone-300 p-4 transition-colors"
                >
                  <div className="font-medium text-stone-900">{d.frontmatter.title}</div>
                  <p className="text-sm text-stone-600 mt-1">{d.frontmatter.summary}</p>
                  <div className="text-xs text-stone-500 mt-2 font-mono">
                    {d.frontmatter.version} · Effective from {d.frontmatter.effectiveFrom}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 mb-4">
            Other policies and disclosures
          </h2>
          <p className="text-sm text-stone-600 mb-4">
            These documents form part of how Monitrax operates and are incorporated by reference into the Terms of Service. Some apply only when you use a specific feature (for example, Open Banking, a paid subscription, or the professional marketplace).
          </p>
          <ul className="space-y-2">
            {supporting.map((d) => (
              <li key={d.slug}>
                <Link
                  href={`/legal/${d.slug}`}
                  className="block rounded-lg border border-stone-200 hover:border-stone-300 p-4 transition-colors"
                >
                  <div className="font-medium text-stone-900">{d.frontmatter.title}</div>
                  <p className="text-sm text-stone-600 mt-1">{d.frontmatter.summary}</p>
                  <div className="text-xs text-stone-500 mt-2 font-mono">
                    {d.frontmatter.version} · Effective from {d.frontmatter.effectiveFrom}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-16 border-t border-stone-200 pt-8 text-sm text-stone-500">
          <p>
            Questions about any document? Email{' '}
            <a href="mailto:admin@monitrax.com.au" className="underline">admin@monitrax.com.au</a>.
          </p>
        </footer>
      </main>
    </div>
  );
}
