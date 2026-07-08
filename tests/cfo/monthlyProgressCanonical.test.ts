/**
 * MON-018 — the My Guide "Monthly Progress" card must read REAL history, not a
 * placeholder (§12.2.1 / §19.4 one-source guard).
 *
 * WHAT WAS WRONG: `calculateMonthlyProgress` simulated last month's net worth as
 * `currentNetWorth × 0.98` — algebraically a constant +2.04% every month — and
 * hardcoded `savingsRateChange = 0.5` + `debtReduction = totalDebt × 0.005`, and
 * computed net worth inline (omitting investment-account cash + super). None of
 * it reflected the user's data.
 *
 * THE FIX: net-worth Δ + debt reduction now come from the stored NetWorthSnapshot
 * history via the ONE canonical reader (`getNetWorthHistory`) — the SAME source
 * as the Home Net Worth Trend tile, so the two converge — and the savings rate
 * comes from the canonical master snapshot (actuals-aware), matching the KPI.
 *
 * DB-bound surface → structural drift guard (like cashflowSurfacesUseCanonical):
 * fails the build if a placeholder returns or a surface stops using the canonical
 * reader. Not a full dataflow proof.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('MON-018: monthly-progress reads canonical history, not placeholders', () => {
  const engine = read('lib/cfo/intelligenceEngine.ts');

  it('the fabricated placeholders are gone', () => {
    // The ×0.98 "simulate last month" net-worth placeholder.
    expect(engine).not.toContain('* 0.98');
    expect(engine).not.toMatch(/Assume 2% growth/i);
    // The fabricated savings-rate improvement.
    expect(engine).not.toContain('savingsRateChange: 0.5');
    // The fabricated 0.5% debt paydown.
    expect(engine).not.toContain('totalDebt * 0.005');
  });

  it('calculateMonthlyProgress sources from the canonical reader + master snapshot', () => {
    const start = engine.indexOf('async function calculateMonthlyProgress');
    const body = engine.slice(start, start + 1600);
    expect(body).toContain('getNetWorthHistory(userId, 2)');
    expect(body).toContain('getMasterFinancialSnapshot(userId)');
    // Δ + debt come from the stored snapshots; savings rate from the snapshot KPI.
    expect(body).toContain('history.deltaAbsolute');
    expect(body).toContain('history.deltaPct');
    expect(body).toContain('totalLiabilities');
    expect(body).toContain('snapshot.quickMetrics.savingsRate');
    // Honest null (not a fabricated number) when there's no history to compare.
    expect(body).toContain('savingsRateChange: null');
  });

  it('§19.4 convergence: the Home trend tile AND the CFO card read the ONE canonical reader', () => {
    // Home Net Worth Trend tile.
    expect(read('app/api/dashboard/charts/route.ts')).toContain('getNetWorthHistory');
    // CFO Monthly Progress card (same source → they cannot diverge).
    expect(engine).toContain("from '@/lib/calculations/netWorthHistory'");
  });

  it('getNetWorthHistory remains the single canonical NetWorthSnapshot reader', () => {
    const src = read('lib/calculations/netWorthHistory.ts');
    expect(src).toContain('export async function getNetWorthHistory');
    // Honesty contract: empty trend (no fabricated curve) when <2 months.
    expect(src).toContain('rows.length < 2');
  });
});
