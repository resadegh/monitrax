/**
 * Neomatrix Layer-0 — the architectural axis for the structural view.
 *
 * Shared by the admin API (`app/api/admin/neomatrix/structural/route.ts`) and
 * the explorer client (`components/admin/neomatrix/NeomatrixExplorer.tsx`) so
 * server and browser group and colour the codebase on ONE definition. It lives
 * here rather than in the route because a Next.js route module may only export
 * handlers and route config.
 *
 * Documentation/model only — path classification and string handling. No
 * financial logic, no numbers.
 */

/**
 * The architectural layer of a source path.
 *
 * The first five values are the SAME axis the semantic schema uses
 * (`db → engine → service → route → ui`, see
 * `docs/financial-logic/graph/schema/financial-graph.schema.md`), so the
 * structural view and the semantic view finally read on one dimension instead
 * of the structural view's directory-name hash. The last three (`types`,
 * `test`, `tooling`) are non-runtime code the semantic graph deliberately does
 * not model but Layer 0 does map — naming them is what keeps them visible
 * instead of dumped into an "other" bucket.
 *
 * Verified against the committed Layer 0 on 2026-07-29: all 16,149 nodes
 * classify; none fall through to `other`. `other` exists for a path outside the
 * known roots (only reachable if `roots.mjs` grows and this file does not) — it
 * is a visible "unclassified", never a silent default.
 */
export type StructuralLayer =
  | 'db'
  | 'engine'
  | 'service'
  | 'route'
  | 'ui'
  | 'types'
  | 'test'
  | 'tooling'
  | 'other';

/** Ordered DB → UI, then the non-runtime layers. Drives legend + filter order. */
export const STRUCTURAL_LAYERS: readonly StructuralLayer[] = [
  'db',
  'engine',
  'service',
  'route',
  'ui',
  'types',
  'test',
  'tooling',
] as const;

/** One colour per layer — the structural palette (see §18.7.2 dark-cosmos vocabulary). */
export const LAYER_COLORS: Record<StructuralLayer, string> = {
  db: '#A78BFA', // violet — Prisma schema
  engine: '#0EA5E9', // sky — lib/ calculation + domain code
  service: '#22D3EE', // cyan — lib/services orchestration
  route: '#F59E0B', // amber — app/api handlers
  ui: '#34D399', // emerald — app pages, components, hooks, contexts, mobile
  types: '#94A3B8', // slate — shared type declarations
  test: '#F472B6', // pink — tests
  tooling: '#64748B', // muted slate — scripts
  other: '#475569', // unclassified (should be empty — see the type doc)
};

/** What each layer covers, shown on the legend so the mapping is never guessed. */
export const LAYER_SCOPE: Record<StructuralLayer, string> = {
  db: 'prisma/ — the schema: models, fields, enums',
  engine: 'lib/ — calculation engines and domain logic',
  service: 'lib/services/ — orchestration between engines and data',
  route: 'app/api/ — HTTP handlers',
  ui: 'app/ pages, components/, hooks/, contexts/, mobile-app/',
  types: 'types/ — shared declarations',
  test: 'tests/ — the suite',
  tooling: 'scripts/ — build + audit tooling',
  other: 'outside the known roots — unclassified',
};

export function layerOf(file: string | null | undefined): StructuralLayer {
  if (!file) return 'other';
  if (file.startsWith('prisma/')) return 'db';
  if (file.startsWith('lib/services/')) return 'service';
  if (file.startsWith('lib/')) return 'engine';
  if (file.startsWith('app/api/')) return 'route';
  if (file.startsWith('app/')) return 'ui'; // pages + layouts
  if (file.startsWith('components/') || file.startsWith('mobile-app/')) return 'ui';
  if (file.startsWith('hooks/') || file.startsWith('contexts/')) return 'ui'; // client state IS the UI layer
  if (file.startsWith('types/')) return 'types';
  if (file.startsWith('tests/')) return 'test';
  if (file.startsWith('scripts/')) return 'tooling';
  return 'other';
}

/**
 * The cluster a file belongs to: its DIRECTORY, at most two segments deep.
 *
 * This used to be `file.split('/').slice(0, 2)` — the first two path segments of
 * the FILE. For `lib/cfo/x.ts` that happens to give the directory, which is why
 * it survived while Layer 0 covered only `lib/` + `app/`. For a file sitting
 * directly under a root it gives the file itself, so `hooks/useAccounts.ts`
 * became a one-symbol "directory" and `prisma/schema.prisma` a cluster named
 * after a file. Measured on the committed Layer 0: 57 of the 250 clusters the
 * old rule produced were file paths, not directories — the overview was
 * shattering the newly-added roots into confetti at exactly the moment they
 * were meant to become visible. Taking the dirname first yields 202 real
 * directories.
 */
export function dirOf(file: string | null | undefined): string {
  if (!file) return '(none)';
  const parts = file.split('/');
  if (parts.length < 2) return '(root)';
  return parts.slice(0, Math.min(2, parts.length - 1)).join('/');
}
