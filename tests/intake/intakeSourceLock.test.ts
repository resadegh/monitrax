/**
 * MON-078 — R1: the build-gate INTAKE SOURCE-LOCK (the keystone ratchet of the
 * Intake-Integrity Wall — docs/architecture/INTAKE_INTEGRITY_GUARDRAIL.md §4).
 *
 * Enforces, at CI time, that classification of Income/Expense rows cannot
 * bypass the ONE canonical classifier:
 *   1. Every production file that creates an Income/Expense row imports AND
 *      calls `classifyIntake` — the producer set is LOCKED (adding a new
 *      producer file fails this test until it is wired + listed here).
 *   2. No producer file carries a silent `'MONTHLY'` frequency literal or a
 *      `|| 'MONTHLY'` / `?? 'MONTHLY'` fallback — the legacy default lives
 *      ONLY in classifyIntake (named LEGACY_FALLBACK_FREQUENCY), where C1
 *      will remove it.
 *
 * This extends MON-053's annualisation source-lock to the intake layer: the
 * MON-001 / MON-023→037→053 / MON-076 bug families all began as producer-local
 * defaults; this gate makes that class a CI failure, not a review catch.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const ROOT = resolve(__dirname, '../..');

/** The LOCKED producer set — every production file that creates Income/Expense
 *  rows. A new create site = wire it through classifyIntake + add it here. */
const PRODUCER_FILES = [
  'app/api/income/route.ts',
  'app/api/expenses/route.ts',
  'app/api/expenses/bulk/route.ts',
  'app/api/transactions/[id]/link/route.ts',
  'app/api/documents/analyze/confirm/route.ts',
  'app/api/onboarding/complete/route.ts',
  'app/api/recurring-payments/[id]/link/route.ts',
  'lib/bank/recurringExpenseDetection.ts',
  'app/api/rental-reconciliation/route.ts', // Phase 59: derived agent-cost rows
];

/** Files allowed to create Income/Expense WITHOUT the classifier — each with a
 *  reviewed reason. Anything else creating rows fails the census below. */
const ALLOWLIST: Record<string, string> = {
  'lib/db/tenant.ts':
    'generic tenant-scoped CRUD pass-through — decides nothing (no defaults); currently has zero callers',
  'lib/testing/loader.ts': 'test-fixture loader — synthetic data, not user intake',
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name)) acc.push(p);
  }
  return acc;
}

const CREATE_RE = /prisma\.(income|expense)\.create\(/;

describe('MON-078 · R1 intake source-lock', () => {
  const sources = [...walk(resolve(ROOT, 'app')), ...walk(resolve(ROOT, 'lib'))];

  it('CENSUS: every file creating Income/Expense rows is a locked producer or allowlisted', () => {
    const creators = sources
      .filter((p) => CREATE_RE.test(readFileSync(p, 'utf-8')))
      .map((p) => relative(ROOT, p).replace(/\\/g, '/'));
    const known = new Set([...PRODUCER_FILES, ...Object.keys(ALLOWLIST)]);
    const unknown = creators.filter((f) => !known.has(f));
    expect(
      unknown,
      `NEW Income/Expense producer(s) outside the wall: ${unknown.join(', ')} — route through classifyIntake and add to PRODUCER_FILES`,
    ).toEqual([]);
    // The locked set must also still exist (a moved/renamed producer must
    // re-lock, not silently vanish from coverage).
    for (const f of PRODUCER_FILES) {
      expect(creators.includes(f), `locked producer no longer creates rows (moved?): ${f}`).toBe(true);
    }
  });

  it('every locked producer imports AND calls classifyIntake', () => {
    for (const f of PRODUCER_FILES) {
      const src = readFileSync(resolve(ROOT, f), 'utf-8');
      expect(src, `${f} must import the canonical classifier`).toMatch(
        /from '@\/lib\/intake\/classifyIntake'/,
      );
      expect(src, `${f} must call classifyIntake`).toMatch(/classifyIntake\(/);
    }
  });

  it("no producer carries a silent 'MONTHLY' frequency literal or fallback", () => {
    // `frequency: 'MONTHLY'` and `|| 'MONTHLY'` / `?? 'MONTHLY'` — the legacy
    // default may exist ONLY inside classifyIntake. Non-Income/Expense cadence
    // fields (loan repaymentFrequency, investment-contribution frequency) are
    // outside the wall's scope and exempt.
    const silentMonthly = /(?<![A-Za-z])frequency:\s*'MONTHLY'|(\|\||\?\?)\s*'MONTHLY'/;
    const exempt = /repaymentFrequency|investmentFrequency/;
    for (const f of PRODUCER_FILES) {
      const src = readFileSync(resolve(ROOT, f), 'utf-8');
      const hit = src.split('\n').findIndex((l) => silentMonthly.test(l) && !exempt.test(l));
      expect(hit, `${f}:${hit + 1} carries a silent 'MONTHLY' — route it through classifyIntake`).toBe(-1);
    }
  });

  it('the legacy fallback lives exactly once, named, in the classifier', () => {
    const src = readFileSync(resolve(ROOT, 'lib/intake/classifyIntake.ts'), 'utf-8');
    expect(src).toMatch(/LEGACY_FALLBACK_FREQUENCY: Frequency = 'MONTHLY'/);
  });
});
