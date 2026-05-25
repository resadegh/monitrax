/**
 * Phase 47 — Legal-document content loader.
 *
 * Reads markdown documents from `docs/legal/*.md` at build time, parses the
 * frontmatter (`title / slug / version / effectiveFrom / status / audience /
 * summary`), and exposes them to the public `/legal/<slug>` route + the
 * registration consent block + the in-app consent modal.
 *
 * Reuses the Phase 33a markdown renderer (`lib/help/markdown.ts`) so the
 * compliance pack and the legal documents share one trustable rendering path.
 * No new dependencies.
 *
 * Doc-sync (CLAUDE.md §16): when adding a new legal document, also register
 * its slug in `LEGAL_DOCUMENTS` below and add the matching
 * `ConsentDocumentType` enum value in `prisma/schema.prisma`.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface LegalDocumentFrontmatter {
  title: string;
  slug: string;
  version: string;
  effectiveFrom: string; // YYYY-MM-DD
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  audience: 'public' | 'internal';
  summary: string;
}

export interface LegalDocument {
  frontmatter: LegalDocumentFrontmatter;
  /** Raw markdown body (no frontmatter). */
  body: string;
}

/**
 * Canonical registry of public-facing legal documents.
 * Maps the URL slug → markdown filename in `docs/legal/`.
 *
 * The `consentDocumentType` aligns to the Prisma `ConsentDocumentType` enum
 * — used by the signup consent capture endpoint to record acceptance against
 * the right enum value.
 */
export const LEGAL_DOCUMENTS = {
  'terms-of-service': {
    file: 'terms-of-service.md',
    consentDocumentType: 'TERMS_OF_SERVICE' as const,
  },
  'privacy-policy': {
    file: 'privacy-policy.md',
    consentDocumentType: 'PRIVACY_POLICY' as const,
  },
  'afsl-credit-tax-boundary-disclosure': {
    file: 'afsl-credit-tax-boundary-disclosure.md',
    consentDocumentType: 'AFSL_BOUNDARY_DISCLOSURE' as const,
  },
} as const;

export type LegalSlug = keyof typeof LEGAL_DOCUMENTS;

const LEGAL_DIR = path.join(process.cwd(), 'docs', 'legal');

/**
 * Minimal frontmatter parser. Same shape as the help-content loader uses.
 * Accepts the YAML-ish key: value form between two `---` fences at the top.
 */
function parseFrontmatter(raw: string): { frontmatter: LegalDocumentFrontmatter; body: string } {
  const fenceRe = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const m = raw.match(fenceRe);
  if (!m) {
    throw new Error('Legal document missing frontmatter');
  }
  const fmRaw = m[1];
  const body = m[2];
  const fm: Record<string, string> = {};
  for (const line of fmRaw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    fm[k] = v;
  }
  // Light validation — we trust our own authored docs.
  return {
    frontmatter: fm as unknown as LegalDocumentFrontmatter,
    body,
  };
}

export function getLegalDocument(slug: LegalSlug): LegalDocument | null {
  const entry = LEGAL_DOCUMENTS[slug];
  if (!entry) return null;
  const filePath = path.join(LEGAL_DIR, entry.file);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return parseFrontmatter(raw);
}

export function listLegalDocuments(): Array<{ slug: LegalSlug; frontmatter: LegalDocumentFrontmatter }> {
  return (Object.keys(LEGAL_DOCUMENTS) as LegalSlug[]).map((slug) => {
    const doc = getLegalDocument(slug);
    if (!doc) throw new Error(`Missing legal document: ${slug}`);
    return { slug, frontmatter: doc.frontmatter };
  });
}

/**
 * Returns the current version string for a given consent document type,
 * read from the document's frontmatter. Used by the signup capture endpoint
 * to pin the version the user accepted.
 */
export function getCurrentDocumentVersion(
  consentDocumentType: 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'AFSL_BOUNDARY_DISCLOSURE' | 'MARKETING_COMMUNICATIONS'
): string {
  if (consentDocumentType === 'MARKETING_COMMUNICATIONS') {
    // Marketing consent isn't tied to a document; pin a date-based version
    // so revocation + re-opt-in are auditable.
    return `marketing-${new Date().toISOString().slice(0, 10)}`;
  }
  // Find the slug whose consentDocumentType matches.
  const slug = (Object.keys(LEGAL_DOCUMENTS) as LegalSlug[]).find(
    (s) => LEGAL_DOCUMENTS[s].consentDocumentType === consentDocumentType
  );
  if (!slug) throw new Error(`No legal doc for consent type: ${consentDocumentType}`);
  const doc = getLegalDocument(slug);
  if (!doc) throw new Error(`Missing legal document for: ${consentDocumentType}`);
  return doc.frontmatter.version;
}
