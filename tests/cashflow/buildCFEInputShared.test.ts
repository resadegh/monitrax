/**
 * MON-027 — the CFE input builder is ONE shared service, and stress-test forecasts
 * on the SAME (correct) basis as the main cashflow forecast (§12.2.1 / §19.1 / §19.4).
 *
 * WHAT WAS WRONG:
 *   `buildCFEInput` was copy-pasted in `app/api/cashflow/route.ts` and
 *   `app/api/cashflow/stress-test/route.ts`, and the copies had DRIFTED: the
 *   stress-test copy counted internal transfers as cashflow and used PRE-tax income
 *   (`normalizeToMonthly`), while the cashflow copy excluded transfers and used
 *   AFTER-tax income (`normalizeIncomeStream`) — so stress-test projections ran on a
 *   different, wrong basis than the main forecast.
 *
 * THE FIX: one `lib/cashflow/buildCFEInput.ts` (after-tax income + transfers
 * excluded); both routes import it, so every forecast surface assembles the same
 * input.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-027: the shared CFE input builder has the correct basis', () => {
  const src = read('lib/cashflow/buildCFEInput.ts');

  it('excludes transfers (§19.1 — transfers are not cashflow)', () => {
    expect(src).toContain('isTransfer: { not: true }');
  });
  it('uses AFTER-tax income (normalizeIncomeStream), not a raw pre-tax normaliser', () => {
    expect(src).toContain('normalizeIncomeStream(');
    expect(src).toContain('normalized.netMonthlyAmount');
    expect(src).not.toContain('normalizeToMonthly');
  });
  it('exports the single builder', () => {
    expect(src).toMatch(/export async function buildCFEInput\(/);
  });
});

describe('MON-027: both routes use the ONE shared builder (§19.4 lock)', () => {
  it('the cashflow route imports the shared builder and has no local copy', () => {
    const src = read('app/api/cashflow/route.ts');
    expect(src).toContain("from '@/lib/cashflow/buildCFEInput'");
    expect(src).not.toMatch(/async function buildCFEInput\(/); // no local re-implementation
  });
  it('the stress-test route imports the shared builder, no local copy, no pre-tax normaliser', () => {
    const src = read('app/api/cashflow/stress-test/route.ts');
    expect(src).toContain("from '@/lib/cashflow/buildCFEInput'");
    expect(src).not.toMatch(/async function buildCFEInput\(/);
    // the drifted copy's PRE-tax helper is gone → stress-test now forecasts after-tax
    expect(src).not.toContain('normalizeToMonthly');
  });
});
