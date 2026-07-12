/**
 * NEOAUDIT §3 DECISION TABLE — CFO recommendation rules as explicit given→then
 * rows (CLAUDE.md Part 23; NEOAUDIT.md §8 step-5).
 *
 * §3: "each recommendation rule gets explicit given→then fixture rows … Wrong
 * advice = build failure." This file locks the EMERGENCY-FUND recommendation
 * rule of `generateActions` (the CFO action engine). The rule is driven purely
 * by the `emergencyBuffer` score component we pass in — so each row is a
 * hand-verified given→then, not a golden-household run.
 *
 * NON-OVERLAP (§1.2): the REFINANCE decision rule (LVR ceiling) is already
 * fixtured as given→then rows in `tests/cfo/loanDecisionSupportGuards.test.ts`
 * (MON-019). This file does NOT re-test refinance — it covers the EF rule, which
 * had no decision-table fixtures. (Duplicating an existing rule's table would be
 * the §12.2.1 violation this contract forbids.)
 *
 * The rule (verified in source §19.2 — actionEngine.ts):
 *   findWeakAreas: a component is "weak" when score < 60.
 *   emergencyBuffer case: pushes a "Build emergency fund" action only when
 *     score < 50; severity = high when score < 30, else medium.
 *   determinePriority: high & impact>500 → do_now; medium & impact>1000 →
 *     upcoming (the EF impact.amount is 5000).
 *   prioritizeActions: do_now(0) < upcoming(1) < …; then severity; then impact.
 *
 * Coverage boundary (§20.6 / §22.2.4): this verifies the EF rule's presence,
 * severity, priority, and first-ness AS THE ENGINE COMPUTES THEM on controlled
 * score inputs with an EMPTY database (no competing optimisation/risk actions).
 * It does NOT verify the score components are themselves correct (that is the
 * scoreCalculator's own tests / MON-030), nor the rendered CFO page (R2-vis), nor
 * real data (R3). The "negative cashflow ⇒ no positive-cashflow credit" rule
 * (§3) is NOT asserted here — it is not yet located in source; see the NEOAUDIT
 * §8 step-5 decision-table queue.
 */
import { describe, it, expect, vi } from 'vitest';

// Empty DB isolates the score-driven rule: generateActions reads
// account/loan/expense/income (all findMany) to build OPTIMISATION actions —
// empty → none, so the EF action is the only output and its first-ness is
// unambiguous.
vi.mock('@/lib/db', () => {
  const empty = { findMany: async () => [] };
  const db = { account: empty, loan: empty, expense: empty, income: empty };
  return { default: db, prisma: db };
});

import { generateActions } from '@/lib/cfo/actionEngine';
import type { CFOScoreComponents } from '@/lib/cfo/types';

const HEALTHY_OTHERS: Omit<CFOScoreComponents, 'emergencyBuffer'> = {
  cashflowStrength: 80,
  debtCoverage: 80,
  investmentDiversification: 80,
  spendingControl: 80,
  savingsRate: 80,
};

const run = (emergencyBuffer: number) =>
  generateActions('golden-user', [], { ...HEALTHY_OTHERS, emergencyBuffer });

const findEF = (o: Awaited<ReturnType<typeof run>>) =>
  [...o.doNow, ...o.upcoming, ...o.considerSoon, ...o.background].find((a) => a.title === 'Build emergency fund');

describe('NeoAudit §3 decision table — CFO emergency-fund recommendation rule', () => {
  it('GIVEN emergencyBuffer 20 (<30, critical) → EF rec present, severity high, priority do_now, and FIRST', async () => {
    const out = await run(20);
    const ef = findEF(out);
    expect(ef, 'EF rec must be present when the buffer is critically low').toBeTruthy();
    expect(ef!.severity).toBe('high');
    expect(ef!.priority).toBe('do_now');
    // "present and first" (§3): with all other components healthy + no risks, the
    // EF action is the only action → it is the highest-priority action.
    expect(out.highestPriorityAction?.title).toBe('Build emergency fund');
  });

  it('GIVEN emergencyBuffer 40 (30–49, moderate) → EF rec present, severity medium, priority upcoming', async () => {
    const out = await run(40);
    const ef = findEF(out);
    expect(ef).toBeTruthy();
    expect(ef!.severity).toBe('medium');
    expect(ef!.priority).toBe('upcoming'); // medium & impact 5000 > 1000
  });

  it('GIVEN emergencyBuffer 55 (50–59) → NO EF rec (flagged weak, but the rule gates at <50)', async () => {
    const out = await run(55);
    expect(findEF(out)).toBeUndefined(); // the honest edge: "weak" ≠ "action"
  });

  it('GIVEN emergencyBuffer 70 (≥60, healthy) → NO EF rec', async () => {
    const out = await run(70);
    expect(findEF(out)).toBeUndefined();
  });

  it('monotonic urgency: the EF rec never gets LESS urgent as the buffer worsens', async () => {
    // A guard against a future edit inverting the severity thresholds.
    const rank = { none: 0, medium: 1, high: 2 } as const;
    const sev = async (b: number) => {
      const ef = findEF(await run(b));
      return ef ? (ef.severity as 'medium' | 'high') : 'none';
    };
    const worse = rank[await sev(20)];
    const mid = rank[await sev(40)];
    const ok = rank[await sev(70)];
    expect(worse).toBeGreaterThanOrEqual(mid);
    expect(mid).toBeGreaterThanOrEqual(ok);
  });
});
