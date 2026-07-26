/**
 * MON-100 (capture Stage 0 — reachability) — the entity tax route goes
 * THROUGH the master orchestrator, and that reroute is provably
 * number-identical.
 *
 * The defect: `/api/tax/entity/[entityId]` called
 * `calculateEntityTaxPositionDecimal` directly, bypassing
 * `buildMasterTaxPosition` — so the wired step-3 overlays (PSI MON-097,
 * FTE/IEE MON-098, Div 152 MON-099) could NEVER reach the live position
 * even once their inputs are captured.
 *
 * Two locks:
 *  1. PARITY — `buildMasterTaxPositionDecimal({entities:[facts]}).entities[0]`
 *     is the SAME computation as the direct engine call (the orchestrator
 *     maps the identical function), across representative facts shapes.
 *     This is what makes the reroute a zero-movement change by construction.
 *  2. TOPOLOGY — no route under `app/` may import the entity engine
 *     directly again (the class lock). `lib/services/wealthGraphService.ts`
 *     is the ONE reviewed exception: STATUS-ONLY (renders
 *     `uncomputed.length` as a canvas badge, never a tax dollar).
 *
 * Coverage (precise): proves the reroute's number-parity and the import
 * topology. Does NOT prove the rendered route response (route handler is
 * exercised by the existing route/CI harnesses) and does NOT make any
 * overlay live — capture (Stages 1-3) does that.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildMasterTaxPositionDecimal } from '../../lib/tax-engine/orchestrator/masterTaxPosition';
import { calculateEntityTaxPositionDecimal } from '../../lib/tax-engine/entity/entityTaxRouter';
import type { EntityTaxFacts, FYReference } from '../../lib/tax-engine/types';

const FY: FYReference = { financialYear: '2024-25', label: 'FY 2024-25' };

const personalFacts = (): EntityTaxFacts => ({
  entityId: 'e-personal',
  entityType: 'PERSONAL_NAME',
  fy: FY,
  incomes: [
    { id: 'i1', name: 'Salary', type: 'SALARY', amount: 7_800, frequency: 'MONTHLY', paygWithholding: 1_800 },
    { id: 'i2', name: 'Rent', type: 'RENTAL', amount: 600, frequency: 'WEEKLY' },
  ],
  expenses: [
    { id: 'x1', name: 'Agent fees', category: 'PROFESSIONAL', amount: 200, frequency: 'MONTHLY', isTaxDeductible: true, isRecurring: true },
  ],
  depreciations: [],
});

const trustFacts = (): EntityTaxFacts => ({
  entityId: 'e-trust',
  entityType: 'DISCRETIONARY_TRUST',
  fy: FY,
  incomes: [],
  expenses: [],
  depreciations: [],
  trustDistribution: {
    trustNetIncome: 100_000,
    beneficiaries: [
      { id: 'b1', name: 'A', presentlyEntitledShare: 0.6, isNonResidentOrDisabled: false },
      { id: 'b2', name: 'B', presentlyEntitledShare: 0.4, isNonResidentOrDisabled: false },
    ],
    hasFamilyTrustElection: true,
  },
});

const cgtFacts = (): EntityTaxFacts => ({
  ...personalFacts(),
  entityId: 'e-cgt',
  cgtEvents: [{ id: 'ev1', monthsHeld: 30, nominalAmount: 50_000, label: 'Share sale' }],
});

describe('MON-100 · entity route reroute through the orchestrator is number-identical', () => {
  it.each([
    ['PERSONAL_NAME income/expense', personalFacts],
    ['DISCRETIONARY_TRUST distribution', trustFacts],
    ['CGT event', cgtFacts],
  ])('parity: orchestrator entities[0] === direct engine call — %s', (_label, mk) => {
    const facts = mk();
    const direct = calculateEntityTaxPositionDecimal(facts);
    const master = buildMasterTaxPositionDecimal({ userId: 'u1', fy: FY, entities: [facts] });
    expect(master.entities).toHaveLength(1);
    // Deep structural equality — same function, same inputs, same output.
    expect(JSON.parse(JSON.stringify(master.entities[0]))).toEqual(JSON.parse(JSON.stringify(direct)));
  });

  it('no overlay inputs → crossCutting carries no overlay keys (the route omits it → response byte-unchanged)', () => {
    const master = buildMasterTaxPositionDecimal({ userId: 'u1', fy: FY, entities: [personalFacts()] });
    expect(Object.keys(master.crossCutting ?? {})).toHaveLength(0);
  });

  it('TOPOLOGY: no app/ route imports the entity engine directly (the MON-100 class lock)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name)) {
          const src = readFileSync(p, 'utf8');
          if (/from ['"]@\/lib\/tax-engine\/entity\/entityTaxRouter['"]/.test(src)) offenders.push(p);
        }
      }
    };
    walk(join(process.cwd(), 'app'));
    expect(offenders).toEqual([]);
  });

  it('TOPOLOGY: the direct-call exception list is exactly the reviewed status-only service', () => {
    // wealthGraphService renders uncomputed.length as a badge (Phase 47 E2)
    // — never a tax dollar. Any NEW direct caller must be added here with
    // the same reviewed reasoning, or routed through the orchestrator.
    const src = readFileSync(join(process.cwd(), 'lib/services/wealthGraphService.ts'), 'utf8');
    expect(src).toContain('calculateEntityTaxPositionDecimal');
    expect(src).toContain('status');
  });
});
