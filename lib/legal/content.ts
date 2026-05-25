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
 * Two categories:
 *   - `mandatory` — the 3 documents the user MUST tick at signup
 *     (Terms / Privacy / AFSL). Each has a `consentDocumentType` mapped
 *     to the Prisma `ConsentDocumentType` enum so signup capture +
 *     migration-modal version-comparison work.
 *   - `supporting` — additional policies that exist to be readable +
 *     linkable but are NOT consent-captured at signup. The Terms of
 *     Service incorporates them by reference ("These Terms should be
 *     read together with our: Privacy Policy; AFSL...; CDR Policy;
 *     any subscription, trial, pricing, or plan terms"). Some of them
 *     attach to situational moments (CDR Policy → bank-connect flow;
 *     Subscription & Billing Terms → checkout; Marketplace Terms →
 *     marketplace use; AI Use Disclosure → AI advisor surface). Linking
 *     them just-in-time from those surfaces is the right pattern;
 *     bundling 13 ticks at signup is a conversion + UX failure.
 *
 * Adding a NEW supporting doc:
 *   1. Drop the markdown file under `docs/legal/`.
 *   2. Add an entry below with `category: 'supporting'` and `consentDocumentType: null`.
 *   3. The `/legal/<slug>` route auto-generates; the `/legal` index page
 *      auto-lists it under "Other policies".
 *
 * Adding a NEW mandatory doc (rare — changes consent UX):
 *   1. Add a new Prisma `ConsentDocumentType` enum value + migration.
 *   2. Add an entry below with the matching `consentDocumentType` +
 *      `category: 'mandatory'`.
 *   3. Update the register page + ConsentMigrationModal copy to include
 *      the new doc in the bundled tick label.
 *   4. Update `app/api/auth/consent/route.ts` to write a row for the
 *      new type + emit a matching audit event.
 */

export const LEGAL_DOCUMENTS = {
  // ── Mandatory (consent-captured at signup) ──────────────────────────
  'terms-of-service': {
    file: 'terms-of-service.md',
    consentDocumentType: 'TERMS_OF_SERVICE' as const,
    category: 'mandatory' as const,
  },
  'privacy-policy': {
    file: 'privacy-policy.md',
    consentDocumentType: 'PRIVACY_POLICY' as const,
    category: 'mandatory' as const,
  },
  'afsl-credit-tax-boundary-disclosure': {
    file: 'afsl-credit-tax-boundary-disclosure.md',
    consentDocumentType: 'AFSL_BOUNDARY_DISCLOSURE' as const,
    category: 'mandatory' as const,
  },

  // ── Supporting (public + readable; not consent-captured) ────────────
  'cdr-policy': {
    file: '04_cdr_policy.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'cdr-consent-collection-notice-template': {
    file: '05_cdr_consent_notice_template.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'subscription-and-billing-terms': {
    file: '06_subscription_and_billing_terms.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'ai-use-disclosure': {
    file: '07_ai_use_disclosure.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'cookie-notice': {
    file: '08_cookie_notice.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'complaints-policy': {
    file: '09_complaints_policy.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'professional-marketplace-terms': {
    file: '10_professional_marketplace_terms.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'data-retention-and-deletion-schedule': {
    file: '11_data_retention_and_deletion_schedule.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'security-statement': {
    file: '12_security_statement.md',
    consentDocumentType: null,
    category: 'supporting' as const,
  },
  'acceptable-use-policy': {
    file: '13_website_acceptable_use_policy.md',
    consentDocumentType: null,
    category: 'supporting' as const,
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
 * Returns the documents grouped into `mandatory` (the 3 signup-tick docs)
 * and `supporting` (the rest). Used by the `/legal` index page and the
 * Settings → Legal "Other policies" section.
 */
export function listLegalDocumentsByCategory(): {
  mandatory: Array<{ slug: LegalSlug; frontmatter: LegalDocumentFrontmatter }>;
  supporting: Array<{ slug: LegalSlug; frontmatter: LegalDocumentFrontmatter }>;
} {
  const all = listLegalDocuments();
  return {
    mandatory: all.filter((d) => LEGAL_DOCUMENTS[d.slug].category === 'mandatory'),
    supporting: all.filter((d) => LEGAL_DOCUMENTS[d.slug].category === 'supporting'),
  };
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
