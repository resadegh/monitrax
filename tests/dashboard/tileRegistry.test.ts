/**
 * D-19 — the tile-registry visibility law (M3.4 §C-6).
 *
 * Locks THE iron rule: `visible = (requires === null || isModuleEnabled)
 * && !suppressed(id)` — a toggle can only SUPPRESS, never force-show a tile
 * whose module is off; unreadable module state fails CLOSED; the admin rows
 * derive from the registry, never a second list.
 */
import { describe, it, expect } from 'vitest';
import {
  TILE_REGISTRY,
  isTileVisible,
  tileAdminState,
  tileSuppressFlagKey,
} from '@/lib/dashboard/tileRegistry';
import { MODULE_KEYS } from '@/lib/featureFlags/moduleRegistry';

const tile = (id: string) => {
  const t = TILE_REGISTRY.find((x) => x.id === id);
  if (!t) throw new Error(`tile ${id} not in registry`);
  return t;
};

describe('D-19 tile visibility law', () => {
  it('module OFF ⇒ hidden, regardless of any toggle state (never force-show)', () => {
    const taxTile = tile('tax-position');
    // Module off, not suppressed → hidden.
    expect(isTileVisible(taxTile, {}, new Set())).toBe(false);
    expect(isTileVisible(taxTile, { MODULE_TAX: false }, new Set())).toBe(false);
    // There is no input that shows it while the module is off: even an
    // empty suppression set (the only "show" direction a toggle has)
    // cannot override the module gate.
    expect(isTileVisible(taxTile, {}, new Set<string>())).toBe(false);
  });

  it('module ON ⇒ visible; suppressing hides it (suppress-only)', () => {
    const taxTile = tile('tax-position');
    expect(isTileVisible(taxTile, { MODULE_TAX: true }, new Set())).toBe(true);
    expect(isTileVisible(taxTile, { MODULE_TAX: true }, new Set(['tax-position']))).toBe(false);
  });

  it('fail-closed: an unreadable/absent module state reads as OFF', () => {
    for (const t of TILE_REGISTRY.filter((x) => x.requires !== null)) {
      expect(isTileVisible(t, {}, new Set())).toBe(false);
      // Anything other than literal true is OFF.
      expect(
        isTileVisible(t, { [t.requires!]: undefined } as never, new Set())
      ).toBe(false);
    }
  });

  it('v1 core tiles (requires: null) are visible with an empty module map', () => {
    for (const t of TILE_REGISTRY.filter((x) => x.requires === null)) {
      expect(isTileVisible(t, {}, new Set())).toBe(true);
      expect(isTileVisible(t, {}, new Set([t.id]))).toBe(false); // still suppressible
    }
  });

  it('every gated tile references a real ModuleKey; stage matches the ladder', () => {
    const keys = new Set<string>(MODULE_KEYS);
    for (const t of TILE_REGISTRY) {
      if (t.requires !== null) {
        expect(keys.has(t.requires), `${t.id} requires unknown module ${t.requires}`).toBe(true);
        expect(t.stage).not.toBe('v1');
      } else {
        expect(t.stage).toBe('v1');
      }
    }
  });

  it('admin state derives from the same law (registry-driven rows)', () => {
    const taxTile = tile('tax-position');
    expect(tileAdminState(taxTile, {}, new Set())).toBe('HIDDEN — module off');
    expect(tileAdminState(taxTile, { MODULE_TAX: true }, new Set(['tax-position']))).toBe('SUPPRESSED');
    expect(tileAdminState(taxTile, { MODULE_TAX: true }, new Set())).toBe('LIVE');
    // Module-off outranks suppression in the display (the module gate is
    // the reason the tile is dark, not the cosmetic toggle).
    expect(tileAdminState(taxTile, {}, new Set(['tax-position']))).toBe('HIDDEN — module off');
  });

  it('suppress flag keys are UPPER_SNAKE and unique', () => {
    const keys = TILE_REGISTRY.map((t) => tileSuppressFlagKey(t.id));
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^TILE_SUPPRESS_[A-Z0-9_]+$/);
  });

  it('v1 tile hrefs target KEPT routes only (MON-163 law)', () => {
    // Kept = not under any gated module's routePrefixes. Cheap static form:
    // the five v1 tiles must point at the known kept surfaces.
    const keptTargets = new Set([
      '/dashboard/properties',
      '/dashboard/reports',
      '/dashboard/documents',
      '/dashboard/activity',
    ]);
    for (const t of TILE_REGISTRY.filter((x) => x.requires === null)) {
      expect(keptTargets.has(t.href), `${t.id} href ${t.href} is not a kept route`).toBe(true);
    }
  });
});
