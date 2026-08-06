/**
 * PROD Simplification P1.9 — nav filtering tests (plan §4.2, P1.3/P1.9).
 *
 * Verifies: `filterNavByModules` drops keyed items/children unless the
 * module is confirmed ON; kept surfaces carry NO key (so a DB outage or
 * empty flag map can never hide the kept app); the §2.2 nav inventory
 * carries exactly the intended keys; and `mobileMoreItems` no longer
 * throws when an item disappears (the non-null-assertion fix).
 *
 * Coverage boundary: verifies the nav SSOT + pure filter. It does NOT
 * render the sidebar/bottom-bar components and does not verify server
 * enforcement (moduleGuards.test.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  trailNavItems,
  mobileTabBarItems,
  mobileMoreItems,
  settingsNavItem,
  filterNavByModules,
  type NavItem,
} from '@/lib/navigation/trailNav';
import type { ModuleKey } from '@/lib/featureFlags/moduleRegistry';

const byName = (name: string) => trailNavItems.find((i) => i.name === name);

describe('nav inventory carries the §2.2 module keys', () => {
  it.each([
    ['Home', 'MODULE_HOME'],
    ['My Household', 'MODULE_HOUSEHOLD'],
    ['My Budget', 'MODULE_HOUSEHOLD'],
    ['My Safety Net', 'MODULE_SAFETY_NET'],
    ['My Guide', 'MODULE_CFO'],
    ['Housekeeping', 'MODULE_HOUSEKEEPING'],
  ] as const)('%s → %s', (name, key) => {
    expect(byName(name)?.moduleKey).toBe(key);
  });

  it('kept top-level surfaces carry NO key (unconditional)', () => {
    for (const name of ['My Accounts', 'My Wealth', 'My Vault', 'Reports']) {
      expect(byName(name)?.moduleKey, name).toBeUndefined();
    }
    expect(settingsNavItem.moduleKey).toBeUndefined();
  });

  it('children: hidden ones keyed, kept ones unkeyed', () => {
    const wealth = byName('My Wealth')!;
    const childKey = (n: string) => wealth.children!.find((c) => c.name === n)?.moduleKey;
    expect(childKey('Properties')).toBeUndefined();
    expect(childKey('Assets')).toBeUndefined();
    expect(childKey('Investments')).toBe('MODULE_INVESTMENTS');
    expect(childKey('Superannuation')).toBe('MODULE_INVESTMENTS');

    const accounts = byName('My Accounts')!;
    expect(accounts.children!.find((c) => c.name === 'My Structure')?.moduleKey).toBe(
      'MODULE_ENTITIES',
    );

    const budget = byName('My Budget')!;
    expect(budget.children!.find((c) => c.name === 'Debt Freedom')?.moduleKey).toBe(
      'MODULE_DEBT_PLANNER',
    );

    const guide = byName('My Guide')!;
    expect(guide.children!.find((c) => c.name === 'Tax')?.moduleKey).toBe('MODULE_TAX');
  });
});

describe('filterNavByModules', () => {
  it('with NO modules enabled (the v1 ship state) only kept surfaces remain', () => {
    const visible = filterNavByModules(trailNavItems, {});
    expect(visible.map((i) => i.name)).toEqual(['My Accounts', 'My Wealth', 'My Vault', 'Reports']);
  });

  it('drops keyed children while keeping the unkeyed siblings', () => {
    const visible = filterNavByModules(trailNavItems, {});
    const wealth = visible.find((i) => i.name === 'My Wealth')!;
    expect(wealth.children!.map((c) => c.name)).toEqual(['Properties', 'Assets']);
    const accounts = visible.find((i) => i.name === 'My Accounts')!;
    expect(accounts.children!.map((c) => c.name)).toEqual(['Balances', 'Activity']);
  });

  it('an enabled module reappears (item + child)', () => {
    const enabled: Partial<Record<ModuleKey, boolean>> = {
      MODULE_HOME: true,
      MODULE_INVESTMENTS: true,
    };
    const visible = filterNavByModules(trailNavItems, enabled);
    expect(visible.some((i) => i.name === 'Home')).toBe(true);
    const wealth = visible.find((i) => i.name === 'My Wealth')!;
    expect(wealth.children!.map((c) => c.name)).toEqual([
      'Properties',
      'Investments',
      'Superannuation',
      'Assets',
    ]);
  });

  it('treats anything but explicit true as hidden (fail closed)', () => {
    const visible = filterNavByModules(trailNavItems, {
      MODULE_HOME: undefined,
      MODULE_SAFETY_NET: false,
    });
    expect(visible.some((i) => i.name === 'Home')).toBe(false);
    expect(visible.some((i) => i.name === 'My Safety Net')).toBe(false);
  });
});

describe('mobile tab bar', () => {
  it('carries the intended keys; Track and Invest stay unkeyed (kept)', () => {
    const key = (k: string) => mobileTabBarItems.find((t) => t.key === k)?.moduleKey;
    expect(key('home')).toBe('MODULE_HOME');
    expect(key('reduce')).toBe('MODULE_HOUSEHOLD');
    expect(key('anchor')).toBe('MODULE_SAFETY_NET');
    expect(key('guide')).toBe('MODULE_CFO');
    expect(key('track')).toBeUndefined();
    expect(key('invest')).toBeUndefined();
  });

  it('filters to Track + Invest in the v1 ship state', () => {
    const visible = filterNavByModules(mobileTabBarItems, {});
    expect(visible.map((t) => t.key)).toEqual(['track', 'invest']);
  });
});

describe('mobileMoreItems (the non-null `.find()` fix)', () => {
  it('builds without throwing and tolerates missing source items', () => {
    // The list itself must materialise even though two of its four
    // named sources are hidden modules — hiding happens at render,
    // never by removing items from trailNavItems.
    expect(Array.isArray(mobileMoreItems)).toBe(true);
    expect(mobileMoreItems[mobileMoreItems.length - 1]).toBe(settingsNavItem);
    // No entry is undefined (the pre-fix failure mode was a thrown
    // TypeError at module load — this asserts the shape stays safe).
    expect(mobileMoreItems.every((i): i is NavItem => Boolean(i))).toBe(true);
  });

  it('filters hidden entries at render time', () => {
    const visible = filterNavByModules(mobileMoreItems, {});
    expect(visible.map((i) => i.name)).toEqual(['My Vault', 'Reports', 'Settings']);
    const withHousekeeping = filterNavByModules(mobileMoreItems, {
      MODULE_HOUSEKEEPING: true,
    });
    expect(withHousekeeping.map((i) => i.name)).toEqual([
      'My Vault',
      'Reports',
      'Housekeeping',
      'Settings',
    ]);
  });
});
