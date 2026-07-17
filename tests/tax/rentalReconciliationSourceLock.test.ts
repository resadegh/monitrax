/**
 * Phase 59 — R1: the build-gate SOURCE-LOCK for the agent-cost deduction
 * (PHASE_59_MANAGED_RENTAL_INCOME.md §7 R1; the §12.2.1 ratchet).
 *
 * Enforces, at CI time, that `number.rental.agentCostDeduction` has exactly
 * ONE producer — `reconcileManagedRental()` in
 * lib/calculations/rentalReconciliation.ts — and that every production file
 * persisting a derived PROPERTY_MANAGEMENT expense routes through it:
 *   1. The engine (Float + Decimal twin) is DECLARED exactly once, in the
 *      canonical file. A second declaration anywhere fails CI.
 *   2. Every production file that references the PROPERTY_MANAGEMENT category
 *      AND creates Expense rows is a locked producer that imports the engine.
 *   3. No production file outside the engine re-derives the gap formula
 *      (a `grossPerDisbursementPeriod`-style minus against a net
 *      disbursement) — the derived-expense payloads are built ONLY by
 *      buildDerivedAgentCostExpense / buildAnomalyExcessExpense.
 *
 * Same mechanism as tests/intake/intakeSourceLock.test.ts (MON-078): the
 * whack-a-mole bug families all began as producer-local re-implementations;
 * this gate makes that class a CI failure, not a review catch.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const ENGINE_FILE = 'lib/calculations/rentalReconciliation.ts';

/** Production files allowed to PERSIST derived agent-cost expenses. Each must
 *  import the ONE engine. Adding a new persist site = wire it + list it. */
const LOCKED_PRODUCERS = [
  'app/api/rental-reconciliation/route.ts',
];

/** Files allowed to REFERENCE the engine/category without persisting rows. */
const REFERENCE_ALLOWLIST = new Set([
  ENGINE_FILE,
  'lib/calc-audit/engines/rental-reconciliation.ts', // R0 fixtures
  'lib/intake/detectors.ts', // D4 rent-gap detector (flags, never writes)
  'lib/neobrain/rentalStatement.ts', // statement parser (feeds the engine)
]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name)) acc.push(p);
  }
  return acc;
}

describe('Phase 59 · R1 agent-cost deduction source-lock', () => {
  const sources = [...walk(resolve(ROOT, 'app')), ...walk(resolve(ROOT, 'lib'))].map((p) => ({
    path: relative(ROOT, p).replace(/\\/g, '/'),
    src: readFileSync(p, 'utf-8'),
  }));

  it('the engine is declared exactly once, in the canonical file', () => {
    const declarations = sources.filter((f) =>
      /export function reconcileManagedRental(Decimal)?\(/.test(f.src),
    );
    expect(declarations.map((f) => f.path)).toEqual([ENGINE_FILE]);
    // Both paths (Float + Decimal twin) live in that one file.
    const engine = sources.find((f) => f.path === ENGINE_FILE)!;
    expect(engine.src).toMatch(/export function reconcileManagedRental\(/);
    expect(engine.src).toMatch(/export function reconcileManagedRentalDecimal\(/);
  });

  it('CENSUS: every file touching PROPERTY_MANAGEMENT + expense.create is a locked producer', () => {
    const persisters = sources
      .filter(
        (f) =>
          f.src.includes('PROPERTY_MANAGEMENT') &&
          /prisma\.expense\.create/.test(f.src),
      )
      .map((f) => f.path);
    const unknown = persisters.filter((p) => !LOCKED_PRODUCERS.includes(p));
    expect(
      unknown,
      `NEW derived agent-cost producer(s) outside the lock: ${unknown.join(', ')} — route through reconcileManagedRental + buildDerivedAgentCostExpense and add to LOCKED_PRODUCERS`,
    ).toEqual([]);
  });

  it('every locked producer imports the ONE engine (never re-derives the gap)', () => {
    for (const p of LOCKED_PRODUCERS) {
      const f = sources.find((s) => s.path === p);
      expect(f, `locked producer missing (moved?): ${p}`).toBeTruthy();
      expect(f!.src, `${p} must import the canonical engine`).toMatch(
        /from '@\/lib\/calculations\/rentalReconciliation'/,
      );
    }
  });

  it('MON-080 wiring lock: the retroactive + gross-gate paths stay wired to the ONE engine', () => {
    // D1: the income PUT must run the retroactive reconcile on the MANAGED
    // transition, and the reconciliation route must expose the chip's GET.
    const incomePut = sources.find((s) => s.path === 'app/api/income/[id]/route.ts')!;
    expect(incomePut.src).toMatch(/buildRetroactiveManagedRentalSuggestion/);
    // D2: the gross-integrity gate judges via the ONE engine, never a local formula.
    expect(incomePut.src).toMatch(/reconcileManagedRental\(/);
    expect(incomePut.src).toMatch(/GROSS_REQUIRED/);
    const reconRoute = sources.find((s) => s.path === 'app/api/rental-reconciliation/route.ts')!;
    expect(reconRoute.src).toMatch(/export const GET/);
    expect(reconRoute.src).toMatch(/buildRetroactiveManagedRentalSuggestion/);
    // The service's retroactive builder delegates to the ONE suggestion path.
    const service = sources.find((s) => s.path === 'lib/services/managedRentalService.ts')!;
    expect(service.src).toMatch(/export async function buildRetroactiveManagedRentalSuggestion/);
  });

  it('no production file outside the engine/allowlist re-derives the gap payload', () => {
    // The derived-expense payload markers (derivedSource RECONCILIATION +
    // derivedFromIncomeId) may be BUILT only inside the engine; producers
    // persist what the engine built.
    const offenders = sources
      .filter((f) => !REFERENCE_ALLOWLIST.has(f.path) && !LOCKED_PRODUCERS.includes(f.path))
      .filter((f) => /derivedSource:\s*'RECONCILIATION'/.test(f.src))
      .map((f) => f.path);
    expect(
      offenders,
      `derived agent-cost payload built outside the engine: ${offenders.join(', ')} — use buildDerivedAgentCostExpense`,
    ).toEqual([]);
  });
});
