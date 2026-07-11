/**
 * MON-028 — the property DETAIL page must be actuals-first, identical to the
 * LIST tile and Home tile (§19.1 / §19.4 cross-surface convergence).
 *
 * Root cause: `/api/properties/[id]` enriched the property with reconciled
 * actuals but DROPPED `linkedTransactions` from its JSON response, so the detail
 * page called `computePropertyCashflow` with `transactions: undefined` and fell
 * back to DECLARED numbers — drifting from the list + Home surfaces (which
 * return the full enriched object and get actuals). E.g. a property showed
 * $50,281/yr declared on the detail page vs ~$15,879/yr actual everywhere else.
 *
 * These guards lock the convergence: the detail route must return
 * `linkedTransactions`, and all three surfaces must feed it to the engine, so a
 * future edit can't re-drop it and silently reintroduce the drift.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-028: the detail API returns linkedTransactions (actuals reach the engine)', () => {
  const route = read('app/api/properties/[id]/route.ts');

  it('serializes linkedTransactions from the enriched property', () => {
    expect(route).toContain('linkedTransactions: enriched.linkedTransactions');
  });
});

describe('MON-028: all three property surfaces feed actuals to the canonical engine', () => {
  it('detail page passes transactions: p.linkedTransactions', () => {
    const detail = read('app/dashboard/properties/[id]/page.tsx');
    expect(detail).toContain('computePropertyCashflow');
    expect(detail).toContain('transactions: p.linkedTransactions');
  });

  it('list page passes transactions: property.linkedTransactions', () => {
    const list = read('app/dashboard/properties/page.tsx');
    expect(list).toContain('computePropertyCashflow');
    expect(list).toContain('transactions: property.linkedTransactions');
  });

  it('Home/master surface passes reconciled transactions to the engine', () => {
    const master = read('lib/services/masterFinancialService.ts');
    expect(master).toContain('computePropertyCashflow');
    expect(master).toContain('transactions:');
  });
});
