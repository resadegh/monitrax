/**
 * MON-094 relocation ratchet — the VR-021 principal-mismatch class stays shut.
 *
 * VR-021 failed because a personal-data review tool shipped on the STAFF
 * admin portal, which authenticates as a different principal than the
 * consumer account owning the data — the user-scoped query ran empty.
 * Reza's standing ruling (2026-07-21): personal-data review/write tools
 * live in the Monitrax app, session-scoped to the owner.
 *
 * Locks:
 *  1. The two personal-data pages exist under /dashboard/housekeeping and
 *     consume the user-permissioned APIs.
 *  2. NO app/admin page renders either tool (the deleted pages stay dead;
 *     no admin file references the two API paths).
 *  3. AFSL guard: the Housekeeping pages never emit a licence-number claim
 *     (Monitrax holds no AFSL — the Stitch mock fabricated "AFSL 123456";
 *     this asserts it can never ship).
 *  4. The nav SSOT carries the Housekeeping section with both sub-tabs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(__dirname, '../..');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

describe('MON-094 · Housekeeping relocation topology', () => {
  it('the two personal-data pages live under /dashboard/housekeeping and call the user APIs', () => {
    const tax = readFileSync(resolve(ROOT, 'app/dashboard/housekeeping/tax/page.tsx'), 'utf8');
    const dup = readFileSync(resolve(ROOT, 'app/dashboard/housekeeping/duplicates/page.tsx'), 'utf8');
    expect(tax).toMatch(/\/api\/tax\/non-assessable-review/);
    expect(dup).toMatch(/\/api\/intake\/duplicates/);
    // User-session auth — the pages use the user's own token, never an
    // admin interceptor (the VR-021 defect).
    expect(tax).toMatch(/useAuth/);
    expect(dup).toMatch(/useAuth/);
    expect(tax).not.toMatch(/safeAdminFetch/);
    expect(dup).not.toMatch(/safeAdminFetch/);
  });

  it('the deleted admin pages stay dead and no admin file reaches the two APIs', () => {
    expect(existsSync(resolve(ROOT, 'app/admin/tax-review'))).toBe(false);
    expect(existsSync(resolve(ROOT, 'app/admin/intake-duplicates'))).toBe(false);
    const adminFiles = [...walk(resolve(ROOT, 'app/admin')), ...walk(resolve(ROOT, 'components/admin'))]
      .filter((f) => /\.(ts|tsx)$/.test(f));
    for (const f of adminFiles) {
      const src = readFileSync(f, 'utf8');
      expect(src, `${f} must not reference the personal-data APIs`).not.toMatch(
        /non-assessable-review|api\/intake\/duplicates/,
      );
    }
  });

  it('AFSL guard: no licence-number claim anywhere in the Housekeeping page tree', () => {
    const files = walk(resolve(ROOT, 'app/dashboard/housekeeping')).filter((f) =>
      /\.(ts|tsx)$/.test(f),
    );
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), `${f} must not claim an AFSL number`).not.toMatch(/AFSL\s*\d/);
    }
  });

  it('the nav SSOT carries the Housekeeping section with both sub-tabs', () => {
    const nav = readFileSync(resolve(ROOT, 'lib/navigation/trailNav.tsx'), 'utf8');
    expect(nav).toMatch(/name: 'Housekeeping'/);
    expect(nav).toMatch(/\/dashboard\/housekeeping\/tax/);
    expect(nav).toMatch(/\/dashboard\/housekeeping\/duplicates/);
  });
});
