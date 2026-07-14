/**
 * MON-044 — the CFO "Loan Opportunities" tile drilled through to `/dashboard/debt`,
 * which is not a route (the canonical debt route is `/dashboard/debt-planner`,
 * used by every other link in the app) → a 404 dead-end (CLAUDE.md §6.7 "no
 * dead-ends").
 *
 * Ratchet (§23.2.2, lowest ring that catches the class): every hardcoded
 * `/dashboard/<seg>` href literal in `app/dashboard/cfo/page.tsx` must resolve
 * to a real route directory `app/dashboard/<seg>/`. This fails the build if any
 * CFO tile ever points at a non-existent route again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const CFO_PAGE = resolve(ROOT, 'app/dashboard/cfo/page.tsx');

describe('MON-044 — CFO tile hrefs resolve to real routes (no dead-ends)', () => {
  const src = readFileSync(CFO_PAGE, 'utf8');
  // Capture the FIRST path segment of every /dashboard/<seg> string literal.
  const segments = [...src.matchAll(/["'`]\/dashboard\/([a-z0-9-]+)/gi)].map((m) => m[1]);

  it('at least one /dashboard/* href is present (guards against the regex silently matching nothing)', () => {
    expect(segments.length).toBeGreaterThan(0);
  });

  it('every /dashboard/<segment> href points to an existing route directory', () => {
    const missing = [...new Set(segments)].filter(
      (seg) => !existsSync(resolve(ROOT, `app/dashboard/${seg}/page.tsx`)),
    );
    expect(missing, `these CFO hrefs 404 — no app/dashboard/<seg>/page.tsx: ${missing.join(', ')}`).toEqual([]);
  });

  it('the specific dead path /dashboard/debt (not debt-planner) is absent', () => {
    expect(/["'`]\/dashboard\/debt["'`]/.test(src)).toBe(false);
  });
});
