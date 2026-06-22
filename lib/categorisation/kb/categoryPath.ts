/**
 * Phase 52 — canonical category-path codec (build increment 52.2b/52.1c).
 *
 * The KB stores a single `category` string per vote, but Monitrax categories are
 * a 3-level hierarchy (level1 > level2 > subcategory). This encodes the levels
 * into one stable path string on the WRITE side (`recordContribution`) and
 * decodes it back on the READ side (`categoriseTransaction`), so the round-trip
 * is lossless without a registry-id dependency.
 *
 * See docs/blueprint/PHASE_52_SHARED_CATEGORISATION_KB.md.
 */

const SEP = '>';

export function encodeCategoryPath(
  level1: string | null | undefined,
  level2?: string | null,
  subcategory?: string | null
): string {
  return [level1 ?? '', level2 ?? '', subcategory ?? ''].join(SEP);
}

export function decodeCategoryPath(path: string): {
  level1: string;
  level2: string | null;
  subcategory: string | null;
} {
  const [l1 = '', l2 = '', sub = ''] = path.split(SEP);
  return {
    level1: l1 || 'Other',
    level2: l2 || null,
    subcategory: sub || null,
  };
}
