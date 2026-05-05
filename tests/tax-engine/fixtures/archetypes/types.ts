/**
 * Archetype fixture types — Phase 41e.−1 cleanup PR D.
 *
 * Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §9.1,
 * the three archetype fixtures (Sarah Kim / David+Emma / Olivia) are
 * shared between snapshot tests and pitch seeding (IMPLEMENTATION_PLAN.md
 * Up Next #33). One fixture identity, two consumers.
 *
 * These types are deliberately a subset of the real Prisma rows — only
 * the fields the tax engine reads. Fixtures stay small, reviewable, and
 * easy to extend per sub-PR (41e.1 adds CGT events, 41e.4 adds trust
 * distributions, etc.).
 */

import type {
  IncomeItem,
  ExpenseItem,
  DepreciationItem,
} from '@/lib/tax-engine/position/taxPositionCalculator';

export interface ArchetypeFixture {
  /** Stable identifier for snapshot file naming. */
  id: string;
  /** Display name used in test descriptions. */
  name: string;
  /** Brief persona — kept short so test output stays scannable. */
  persona: string;
  /** Financial year these inputs apply to. */
  financialYear: '2023-24' | '2024-25' | '2025-26';
  /** Tax-engine inputs (already shaped for `calculateTaxPosition`). */
  taxInputs: {
    incomes: IncomeItem[];
    expenses: ExpenseItem[];
    depreciations: DepreciationItem[];
    superContributions?: {
      concessional: number;
      nonConcessional: number;
    };
  };
}
