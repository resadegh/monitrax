/**
 * Neomatrix Layer 0 — the SINGLE SOURCE OF TRUTH for scan scope.
 *
 * Every Layer-0 producer and consumer imports ROOTS from here:
 *   - `graphify-layer0.mjs`        (the generator)
 *   - `check-layer0-coverage.mjs`  (the completeness gate)
 *   - `check-binding-coverage.mjs` (the semantic→structural binding gate)
 *
 * WHY THIS FILE EXISTS. Until 2026-07-29 each of those three declared its own
 * private `ROOTS = ['lib','app']`. The gate therefore measured completeness
 * against the SAME narrowed scope the generator used, so it reported
 * "✓ Layer 0 complete — every source file is represented" while `components/`
 * (351 files — the entire visual surface of Monitrax), `hooks/`, `contexts/`,
 * `types/`, `tests/` and `mobile-app/` were not scanned at all. A gate that
 * defines its own scope cannot detect that its scope is wrong. One shared
 * constant removes that whole class of failure (audit finding F3 / MON-114).
 *
 * SCOPE RULE. A directory belongs in ROOTS if it contains first-party source
 * that is part of Monitrax. Everything under a root is scanned; there is no
 * per-directory opt-out. Files graphify genuinely cannot extract go on the
 * reviewed `structural/coverage-allowlist.json` WITH A REASON — never here.
 *
 * `prisma/` is NOT in ROOTS: graphify 0.8.45 ships no `.prisma` grammar (it
 * sees only the seed `.ts` files). The data model is extracted instead by the
 * deterministic pure-node pass in `prisma-layer0.mjs` and merged into the same
 * artifact under its own generator provenance — see `_meta.generators`.
 */

/** Directories scanned by graphify for the Layer-0 structural skeleton. */
export const ROOTS = [
  'lib',
  'app',
  'components',
  'hooks',
  'contexts',
  'types',
  'tests',
  'scripts',
  'mobile-app',
];

/**
 * Directory names never walked when reconciling disk-vs-graph.
 * `graphify-out` is graphify's own output; `__tests__` is excluded because
 * graphify skips it (kept identical to the generator's walk so the gate and
 * the generator can never disagree about what "on disk" means).
 */
export const SKIP_DIRS = new Set(['node_modules', 'graphify-out', '__tests__', '.next', 'dist', 'build']);

/** The Prisma schema — modelled by the pure-node pass, not by graphify. */
export const PRISMA_SCHEMA = 'prisma/schema.prisma';

/** True for a first-party source file the completeness contract covers. */
export const isSourceFile = (name) => /\.tsx?$/.test(name) && !name.endsWith('.d.ts');
