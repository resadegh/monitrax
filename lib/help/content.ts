/**
 * Help Center — content discovery + retrieval.
 *
 * Reads help articles from `docs/help/<audience>/<topic>.md` at build time
 * (server-only — uses `fs`). Articles are listed by audience for the index
 * page; individual articles fetched by slug for detail pages.
 *
 * NOT cached at module level — Next.js handles caching at the route level
 * via React's request memoisation + `revalidate`. Each call walks the file
 * tree fresh; for our scale (10s of articles) this is fine.
 *
 * Future evolution: when help content moves to a CMS or grows beyond ~100
 * articles, swap this for an indexed lookup (e.g. JSON manifest built at
 * `next build`, or move to a headless CMS).
 */
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseMarkdown,
  validateArticleFrontmatter,
  type ArticleFrontmatter,
} from './frontmatter';
import { renderMarkdown } from './markdown';

const HELP_ROOT = path.join(process.cwd(), 'docs', 'help');

export type HelpAudience = ArticleFrontmatter['audience'];

export const AUDIENCE_LABEL: Record<HelpAudience, string> = {
  consumer: 'For everyone',
  'org-admin': 'For org admins',
  'org-professional': 'For advisers / brokers / accountants',
  'org-client': 'For org-attached users',
  'monitrax-internal': 'For Monitrax support',
  compliance: 'Compliance & regulators',
};

export const AUDIENCE_DESCRIPTION: Record<HelpAudience, string> = {
  consumer:
    'How Monitrax works for an individual user — your dashboard, AI Guide, and how to get the most from the TRAIL framework.',
  'org-admin':
    'Setting up and running your firm on Monitrax — invitations, billing, plan tiers, marketplace participation.',
  'org-professional':
    'Day-to-day for advisers, brokers, and accountants — the Practice surface, alert stream, drill-in, AFSL boundary.',
  'org-client':
    'You\'re a Monitrax user whose adviser uses Monitrax too — how that link works, what they see, how to control it.',
  'monitrax-internal':
    'Operational runbooks for the Monitrax support team — org provisioning, billing overrides, marketplace approvals.',
  compliance:
    'For your compliance team or auditor — CDR consent walkthrough, data retention, incident response, architecture overview.',
};

export interface HelpArticle {
  frontmatter: ArticleFrontmatter;
  bodyHtml: string;
  bodyMarkdown: string;
  filepath: string;
}

export interface HelpArticleSummary {
  frontmatter: ArticleFrontmatter;
  filepath: string;
}

const isMarkdownFile = (name: string) => name.endsWith('.md') && !name.startsWith('_') && !name.startsWith('.');

const walkAudience = (audience: HelpAudience): string[] => {
  const dir = path.join(HELP_ROOT, audience);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(isMarkdownFile)
    .map((f) => path.join(dir, f));
};

const readAndValidate = (filepath: string): HelpArticleSummary | null => {
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    const parsed = parseMarkdown(raw);
    const fm = validateArticleFrontmatter(parsed.frontmatter, filepath);
    return { frontmatter: fm, filepath };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[help] Skipping malformed article ${filepath}:`, err);
    return null;
  }
};

export function listArticlesByAudience(audience: HelpAudience): HelpArticleSummary[] {
  return walkAudience(audience)
    .map(readAndValidate)
    .filter((a): a is HelpArticleSummary => a !== null)
    .sort((a, b) => {
      const orderA = a.frontmatter.order ?? 100;
      const orderB = b.frontmatter.order ?? 100;
      if (orderA !== orderB) return orderA - orderB;
      return a.frontmatter.title.localeCompare(b.frontmatter.title);
    });
}

export function listAllArticles(): HelpArticleSummary[] {
  const audiences: HelpAudience[] = [
    'consumer',
    'org-admin',
    'org-professional',
    'org-client',
    'compliance',
  ];
  return audiences.flatMap((a) => listArticlesByAudience(a));
}

export function getArticle(audience: HelpAudience, slug: string): HelpArticle | null {
  const summaries = listArticlesByAudience(audience);
  const match = summaries.find((s) => s.frontmatter.slug === slug);
  if (!match) return null;
  const raw = fs.readFileSync(match.filepath, 'utf8');
  const parsed = parseMarkdown(raw);
  return {
    frontmatter: match.frontmatter,
    bodyMarkdown: parsed.body,
    bodyHtml: renderMarkdown(parsed.body),
    filepath: match.filepath,
  };
}

/**
 * For Next.js generateStaticParams — emit every article slug under
 * `/help/<audience>/<slug>`.
 */
export function getAllArticleParams(): Array<{ slug: string[] }> {
  return listAllArticles().map((article) => ({
    slug: [article.frontmatter.audience, article.frontmatter.slug],
  }));
}
