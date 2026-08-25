/**
 * MON-186 guard (M3 punch list §D, §23.2.2 Ratchet Ring 1) — report-tile and
 * legacy-API module keys are pinned to an EXPLICIT expected map.
 *
 * Why: a module key's MEANING can change at a flip. MODULE_HOME flipped
 * 2026-08-22 from "the R4 wealth-OS Home family" to "the live v1 scoreboard",
 * which silently resurfaced the legacy Financial Overview report tile keyed
 * to it (and left the unkeyed Tax-Time tile always visible). This guard makes
 * any re-key or key-meaning drift a RED TEST instead of a silent resurface:
 * changing a tile's gate now requires editing the expected map here, in the
 * same PR, on purpose.
 *
 * Source-scan (not an import) so the client page module never loads in vitest;
 * the same style as tests/bookkeeping/mon168PropertyStampGuard.test.ts.
 *
 * Coverage: proves the static key wiring at HEAD. Does NOT prove runtime
 * visibility (the page's isModuleEnabled filter — covered by the module-gate
 * suites) or live rendering (Ring-3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** THE expected map — edit only deliberately, with the module-family reason. */
const EXPECTED_REPORT_TILE_KEYS: Record<string, string | null> = {
  // Legacy whole-position overview → the wealth-OS story family (R4). MON-186.
  'financial-overview': 'MODULE_CFO',
  // Income/expense list-page family (R3).
  'income-expense': 'MODULE_HOUSEHOLD',
  // Debt-planning family (R3); loan DATA stays live on kept pages.
  'loan-debt': 'MODULE_DEBT_PLANNER',
  // The v1 KEPT report — deliberately unkeyed, always visible.
  'property-portfolio': null,
  // Investments family (R5).
  'investment': 'MODULE_INVESTMENTS',
  // Legacy calendar-YTD tax report (condemned generator) → tax family (R2). MON-186.
  'tax-time': 'MODULE_TAX',
};

function extractTileKeys(src: string): Record<string, string | null> {
  // Each tile literal starts `id: '<tile>'` and ends at the next `id:` or the
  // array close; a `moduleKey: 'MODULE_X'` inside that window is its gate.
  const out: Record<string, string | null> = {};
  const idRe = /id:\s*'([a-z-]+)'/g;
  const matches = [...src.matchAll(idRe)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : src.length;
    const window = src.slice(start, end);
    const key = window.match(/moduleKey:\s*'(MODULE_[A-Z_]+)'/);
    out[matches[i][1]] = key ? key[1] : null;
  }
  return out;
}

describe('MON-186 — report tiles + legacy money-flow API pin their module keys', () => {
  it('reports-page tile keys match the expected map exactly', () => {
    const src = readFileSync('app/dashboard/reports/page.tsx', 'utf8');
    const arrayBlock = src.slice(
      src.indexOf('const reportTypes'),
      src.indexOf('const variantStyles')
    );
    expect(extractTileKeys(arrayBlock)).toEqual(EXPECTED_REPORT_TILE_KEYS);
  });

  it('no report tile keys on MODULE_HOME (its meaning is now the v1 scoreboard)', () => {
    const src = readFileSync('app/dashboard/reports/page.tsx', 'utf8');
    expect(src).not.toContain("moduleKey: 'MODULE_HOME'");
  });

  it('/api/money-flow is gated MODULE_ENTITIES (its content family), not MODULE_HOME', () => {
    const src = readFileSync('app/api/money-flow/route.ts', 'utf8');
    expect(src).toContain("moduleApiGuard('MODULE_ENTITIES'");
    expect(src).not.toContain("moduleApiGuard('MODULE_HOME'");
  });
});
