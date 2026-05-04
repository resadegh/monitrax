/**
 * Help Center — frontmatter parser (zero-dep).
 *
 * Parses YAML-ish frontmatter from markdown files. Supports the subset
 * of YAML we actually use in `docs/help/<audience>/<topic>.md`:
 *   - Quoted and unquoted scalar strings
 *   - ISO date strings (returned as strings; parsed at consumer)
 *   - Single-line arrays in `[a, b, c]` form
 *
 * NOT supported (we don't need them in v1):
 *   - Nested objects
 *   - Multi-line arrays
 *   - YAML anchors / merge keys
 *
 * If we ever need richer YAML (e.g. trust-deed ingestion via Phase 41f),
 * promote to `gray-matter` then. For docs/help/* this is sufficient.
 */

export interface ArticleFrontmatter {
  title: string;
  audience: 'consumer' | 'org-admin' | 'org-professional' | 'org-client' | 'monitrax-internal' | 'compliance';
  category?: string;
  slug: string;
  routeContext?: string;
  lastReviewed: string;
  complianceClass?: 'general' | 'cdr' | 'afsl' | 'tpb' | 'privacy';
  summary?: string;
  order?: number;
  tags?: string[];
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

const parseScalar = (raw: string): string | number | string[] => {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  // Quoted string
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  // Single-line array `[a, b, c]`
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((p) => p.trim())
      .map((p) => (p.startsWith('"') || p.startsWith("'") ? p.slice(1, -1) : p))
      .filter(Boolean);
  }
  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  // Bare scalar
  return trimmed;
};

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function parseMarkdown(source: string): ParsedMarkdown {
  const match = source.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: source };
  }
  const [, yaml, body] = match;
  const frontmatter: Record<string, unknown> = {};
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, ''); // strip trailing comments
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1);
    if (!key) continue;
    frontmatter[key] = parseScalar(value);
  }
  return { frontmatter, body: body ?? '' };
}

const REQUIRED_FIELDS: Array<keyof ArticleFrontmatter> = [
  'title',
  'audience',
  'slug',
  'lastReviewed',
];

export function validateArticleFrontmatter(
  fm: Record<string, unknown>,
  filepath: string,
): ArticleFrontmatter {
  for (const field of REQUIRED_FIELDS) {
    if (fm[field] === undefined || fm[field] === '') {
      throw new Error(
        `Help article missing required frontmatter field "${field}" in ${filepath}`,
      );
    }
  }
  return fm as unknown as ArticleFrontmatter;
}
