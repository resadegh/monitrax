/**
 * MON-163 — repo-wide dead-link guard (M2 §D; MONITRAX_V1_MASTER_PLAN.md §5).
 *
 * The P2.1 sweep proved hidden routes hide; nobody checked that KEPT
 * surfaces stopped POINTING at them — a v1 user on the core property
 * page could click into a 404 (found live in PROD 2026-08-19). This
 * guard makes that class of defect a build failure, permanently.
 *
 * THE RULE: a KEPT-REACHABLE file may not contain a link (href /
 * router.push / redirect target) into a hidden module's `routePrefixes`
 * unless the file is module-aware for that key — it mentions the key
 * literally, which the `useModuleEnabled('MODULE_X')` gating pattern
 * (and registry-driven files like trailNav) satisfy by construction.
 *
 * KEPT-REACHABLE = in the import graph walked from every app/ file that
 * is not inside a gated route tree (an ancestor layout.tsx carrying
 * `moduleKey="…"`). Two deliberate boundaries:
 *   - Traversal does not continue OUT of a server gate wrapper (a file
 *     using `<ModuleGateBoundary` or `resolveModuleRouting(`): such a
 *     file renders its imports only when its module is ON, so what it
 *     imports (e.g. HomeClient) is not v1-reachable through it.
 *   - Files never reached (hidden-only pages and their components) are
 *     exempt TODAY because a v1 user cannot render them. This exemption
 *     is registry-driven: when a module returns at its R-stage and its
 *     registry entry is dropped, its tree joins the walk automatically
 *     and any stale cross-links fail CI at that moment — the R-stage
 *     gate review runs this test.
 *
 * The awareness check is a string-level heuristic, not an AST proof —
 * it verifies the file KNOWS about the module it links into, which is
 * the invariant MON-163 violated. A file mentioning the key without
 * actually gating one specific link would still pass; accepted and
 * documented (the alternative is full JSX flow analysis).
 *
 * MODULE_HOME is exempt as a link target: its behaviour is `redirect`
 * (never a 404), so linking to /dashboard is always safe.
 *
 * Coverage boundary: static string content only (literal hrefs and the
 * static prefix of template literals). A href assembled from variables
 * that only becomes a hidden route at runtime is not detectable here.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MODULE_REGISTRY } from '@/lib/featureFlags/moduleRegistry';

const ROOT = process.cwd();
const EXTENSIONS = ['.tsx', '.ts'];

/** Hidden-module URL prefixes → owning key (MODULE_HOME exempt: redirect). */
const GUARDED: { key: string; prefix: string; regex: RegExp }[] = MODULE_REGISTRY.filter(
  (m) => m.behaviour !== 'redirect',
).flatMap((m) =>
  m.routePrefixes.map((prefix) => ({
    key: m.key,
    prefix,
    // `[id]` segments match any single path segment. A guarded prefix hits
    // when the target equals it or continues it with `/`, `?` or `#`.
    regex: new RegExp(
      `^${prefix.replace(/[.*+^${}()|\\]/g, '\\$&').replace(/\[[^\]]+\]/g, '[^/?#]+')}($|[/?#])`,
    ),
  })),
);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/** True when an ancestor layout.tsx module-gates this file's route tree. */
function insideGatedTree(file: string): boolean {
  let dir = path.dirname(file);
  const stop = path.join(ROOT, 'app');
  while (dir.length >= stop.length && dir.startsWith(stop)) {
    const layout = path.join(dir, 'layout.tsx');
    if (
      fs.existsSync(layout) &&
      /moduleKey="MODULE_[A-Z_]+"/.test(fs.readFileSync(layout, 'utf8'))
    ) {
      return true;
    }
    dir = path.dirname(dir);
  }
  return false;
}

/** Server gate wrappers render their imports only when the module is ON. */
function isGateWrapper(content: string): boolean {
  return content.includes('<ModuleGateBoundary') || content.includes('resolveModuleRouting(');
}

function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // package import
  const candidates = [
    base,
    ...EXTENSIONS.map((e) => base + e),
    ...EXTENSIONS.map((e) => path.join(base, 'index' + e)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/g;

/** BFS the import graph from kept app/ entries → the v1-reachable file set. */
function keptReachable(): Set<string> {
  const contentCache = new Map<string, string>();
  const read = (f: string) => {
    let c = contentCache.get(f);
    if (c === undefined) {
      c = fs.readFileSync(f, 'utf8');
      contentCache.set(f, c);
    }
    return c;
  };

  // Entries are Next.js ROUTE files only — colocated components under
  // app/ (e.g. HomeClient.tsx) are not routes; they join the walk via
  // imports, so a gate wrapper between them and the router exempts them.
  const ROUTE_FILES = /^(page|layout|template|error|not-found|loading|default|route)\.tsx?$/;
  const queue = walk(path.join(ROOT, 'app')).filter(
    (f) => ROUTE_FILES.test(path.basename(f)) && !insideGatedTree(f),
  );
  const seen = new Set<string>(queue);
  while (queue.length) {
    const file = queue.pop()!;
    const content = read(file);
    if (isGateWrapper(content)) continue; // renders imports only when its module is ON
    IMPORT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = IMPORT_RE.exec(content)) !== null) {
      const resolved = resolveImport(file, m[1] ?? m[2]);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return seen;
}

/**
 * Link-target extraction: JSX href attributes, object-literal href
 * fields, router.push/replace, next redirect(), and our fallbackHref —
 * string literals and the static prefix of template literals.
 */
const LINK_PATTERNS = [
  /\bhref\s*=\s*["'`]([^"'`$]+)/g, // href="..." (attr, incl. template prefix)
  /\bhref\s*=\s*\{\s*["'`]([^"'`$]+)/g, // href={'...'} / href={`...`}
  /\bhref\s*:\s*["'`]([^"'`$]+)/g, // { href: '...' }
  /\bfallbackHref\s*=\s*["'`]([^"'`$]+)/g,
  /\brouter\.(?:push|replace)\(\s*["'`]([^"'`$]+)/g,
  /\bredirect\(\s*["'`]([^"'`$]+)/g,
];

function extractTargets(line: string): string[] {
  const targets: string[] = [];
  for (const pattern of LINK_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(line)) !== null) {
      if (m[1].startsWith('/')) targets.push(m[1]);
    }
  }
  return targets;
}

describe('MON-163 — no kept surface links into a hidden module', () => {
  it('every kept-reachable link into a hidden routePrefix comes from a module-aware file', () => {
    const violations: string[] = [];
    for (const file of keptReachable()) {
      const rel = path.relative(ROOT, file);
      if (rel.startsWith(path.join('lib', 'featureFlags'))) continue; // the registry itself
      const content = fs.readFileSync(file, 'utf8');
      content.split('\n').forEach((line, i) => {
        for (const target of extractTargets(line)) {
          for (const g of GUARDED) {
            if (g.regex.test(target) && !content.includes(g.key)) {
              violations.push(`${rel}:${i + 1} → ${target} (${g.key} hidden; file is not module-aware)`);
            }
          }
        }
      });
    }
    expect(
      violations.sort(),
      `Links from kept surfaces into hidden modules (gate each with useModuleEnabled — see MON-163):\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('the guard itself sees the known link sites (self-test: extraction is not silently broken)', () => {
    // The property-detail page carries gated links into MODULE_CFO/TAX/
    // HOUSEHOLD territory. If extraction, prefix-matching or reachability
    // regressed to matching nothing, these canaries fail before the guard
    // silently passes an actually-broken repo.
    const detailPath = path.join(ROOT, 'app', 'dashboard', 'properties', '[id]', 'page.tsx');
    const detail = fs.readFileSync(detailPath, 'utf8');
    expect(detail).toContain("useModuleEnabled('MODULE_CFO')");
    expect(detail).toContain("useModuleEnabled('MODULE_TAX')");
    expect(detail).toContain("useModuleEnabled('MODULE_HOUSEHOLD')");
    const targets = detail.split('\n').flatMap(extractTargets);
    expect(targets.some((t) => t.startsWith('/dashboard/cfo/'))).toBe(true);

    const reachable = keptReachable();
    expect(reachable.has(detailPath)).toBe(true); // kept pages are in the walk
    expect(reachable.has(path.join(ROOT, 'app', 'dashboard', 'cfo', 'page.tsx'))).toBe(false); // gated trees are not
  });
});
