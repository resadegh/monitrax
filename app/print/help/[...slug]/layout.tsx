/**
 * Phase 33c — print-only layout for `/print/help/<audience>/<slug>`.
 *
 * Bypasses `app/help/layout.tsx` (header / footer chrome, brand nav) so
 * the print view is a clean document at every scale — on screen for the
 * "Save as PDF" preview, and on paper. No header chrome means no CSS
 * hacks to hide it; the resulting PDF starts with the document title,
 * which is what auditors expect from a compliance pack.
 *
 * Future evolution: when the help site moves to its own subdomain
 * (`help.monitrax.com.au`), this print route can move with it. The URL
 * stays under `/print/help/...` for now to keep all printable surfaces
 * gathered under one prefix (so future Phase 33f DOCX templates can sit
 * at `/print/...` too).
 */
import type { ReactNode } from 'react';

export const metadata = {
  robots: { index: false, follow: false },
};

export default function PrintHelpLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: '#ffffff', minHeight: '100vh' }}>{children}</div>
  );
}
