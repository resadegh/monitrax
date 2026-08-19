/**
 * PROD Simplification P2.3/P2.4 — source-scan locks (plan §5 P2).
 *
 * Static assertions over the two narrowed surfaces (the page/component
 * modules pull the whole dashboard shell, so scanning source keeps these
 * cheap — same pattern as tests/dashboard/entityCashflowWidget.test.ts):
 *
 *  - Reports (P2.3): the v1 kept pack (property-portfolio, tax-time)
 *    carries NO moduleKey; every other tile is keyed to a registry
 *    module; tiles render via the SAME `filterNavByModules` the nav
 *    uses; the once-hardcoded help-section list is gone.
 *  - Ownership (P2.4): the picker bails out on MODULE_ENTITIES and the
 *    correction dialog gates its write path.
 *
 * Coverage boundary: locks the wiring in source, NOT the rendered UI
 * (P2.1's smoke test) and NOT the server writer's sole→personal-entity
 * resolution (pre-existing, unchanged).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const read = (p: string) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

describe('P2.3 — reports page narrowed via the registry', () => {
  const src = read('app/dashboard/reports/page.tsx');

  it('kept pack tiles are unkeyed; hidden-family tiles carry their registry key', () => {
    const tile = (id: string) => {
      const start = src.indexOf(`id: '${id}'`);
      expect(start, `tile ${id} exists`).toBeGreaterThan(-1);
      const end = src.indexOf('},', start);
      return src.slice(start, end);
    };
    expect(tile('property-portfolio')).not.toContain('moduleKey');
    expect(tile('tax-time')).not.toContain('moduleKey');
    expect(tile('financial-overview')).toContain("moduleKey: 'MODULE_HOME'");
    expect(tile('income-expense')).toContain("moduleKey: 'MODULE_HOUSEHOLD'");
    expect(tile('loan-debt')).toContain("moduleKey: 'MODULE_DEBT_PLANNER'");
    expect(tile('investment')).toContain("moduleKey: 'MODULE_INVESTMENTS'");
  });

  it('renders through the one nav filter (no second filtering rule)', () => {
    expect(src).toContain('filterNavByModules(reportTypes, enabledModules)');
    expect(src).toContain('visibleReportTypes.map');
    // the tiles list must not be rendered unfiltered anywhere
    expect(src).not.toContain('{reportTypes.map');
  });

  it('help section derives from the same list — the hardcoded second list is gone', () => {
    expect(src).toContain('report.longDescription');
    // a phrase that only existed in the old hardcoded help block
    expect(src.match(/A comprehensive snapshot of your financial position/g) ?? []).toHaveLength(1);
  });
});

describe('P2.4 — D-6 safe default (zero writes to existing attribution)', () => {
  it('OwnershipPicker renders nothing while MODULE_ENTITIES is off', () => {
    const src = read('components/ownership/OwnershipPicker.tsx');
    expect(src).toContain("useModuleEnabled('MODULE_ENTITIES')");
    expect(src).toContain('if (!entitiesModuleEnabled) {');
  });

  it('CorrectOwnershipDialog blocks its write path while the module is off', () => {
    const src = read('components/ownership/CorrectOwnershipDialog.tsx');
    expect(src).toContain("useModuleEnabled('MODULE_ENTITIES')");
    expect(src).toContain('{!entitiesModuleEnabled ? (');
    // the form (and its submit) only renders in the enabled branch
    expect(src.indexOf('{!entitiesModuleEnabled ? (')).toBeLessThan(src.indexOf('<form onSubmit={handleSubmit}'));
  });
});
