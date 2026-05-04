/**
 * Money Flow service — Phase 41d.
 *
 * Returns the per-entity flow shape consumed by the Money Flow Sankey
 * (`components/entities/MoneyFlowSankey.tsx`) on `/dashboard/entities`.
 *
 * Composition (annual, FY-bucketed):
 *
 *   Income source (Salary / Rental / Investment / Other)
 *      ↓  per-entity allocation via Income.ownerEntityId
 *   Legal entity
 *      ↓  Tax (PAYG withholding allocated to this entity's income)
 *      ↓  Essential expenses (Expense.ownerEntityId + isEssential)
 *      ↓  Discretionary expenses
 *      ↓  Loan repayments
 *      ↓  Surplus (the residual — what's actually left)
 *
 * SSOT discipline:
 *   - Reads raw rows directly so per-entity attribution stays accurate
 *     (the master snapshot's `incomeBreakdown` aggregates across
 *     entities; we need finer granularity here).
 *   - Reuses the canonical `toAnnual` from `lib/utils/frequencies.ts`.
 *   - Income type labels mirror the consumer-facing copy (Salary / Rental
 *     / Investment / Other) — not the raw IncomeType enum, to keep the
 *     visual readable.
 *
 * v1 heuristics (Phase 41e will tighten these):
 *   - PAYG withholding is allocated proportionally to each entity's
 *     share of taxable income. Real per-entity tax requires Div 6/6E
 *     trust distribution math (Phase 41e.1 / 41e.4); v1 uses the
 *     proportional approximation so the visual is correct in
 *     aggregate.
 *   - Loan repayments use `minRepayment` annualised — actual interest
 *     vs. principal split lands in the entity-aware tax engine.
 *   - The "Surplus" bucket is the arithmetic residual after the four
 *     other outflows. Negative residuals (deficit) clamp to 0 for the
 *     Sankey layout (recharts can't draw negative-width links).
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, LegalEntityRole, LegalEntityType } from '@prisma/client';
import { toAnnual } from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Public types — consumed by the Sankey component
// ---------------------------------------------------------------------------

export type MoneyFlowSourceLabel = 'Salary' | 'Rental' | 'Investment' | 'Other';

export type MoneyFlowOutflowLabel =
  | 'Tax'
  | 'Essential expenses'
  | 'Discretionary'
  | 'Loan repayments'
  | 'Surplus';

export interface MoneyFlowSource {
  label: MoneyFlowSourceLabel;
  amount: number;
}

export interface MoneyFlowEntity {
  id: string;
  name: string;
  type: LegalEntityType;
  role: LegalEntityRole;
  incomeIn: number;
  outflows: Record<MoneyFlowOutflowLabel, number>;
}

export interface MoneyFlowOutflow {
  label: MoneyFlowOutflowLabel;
  amount: number;
}

export interface MoneyFlowEdge {
  // `source` and `target` are stable identifiers used to join the
  // node arrays into a Sankey graph. Convention:
  //   - 'src:Salary' / 'src:Rental' / 'src:Investment' / 'src:Other'
  //   - 'ent:<entityId>'
  //   - 'out:Tax' / 'out:Essential expenses' / etc.
  source: string;
  target: string;
  amount: number;
}

export interface MoneyFlowResult {
  /** Reference period — for v1 always 'annual'. */
  period: 'annual';
  /** Total income flowing into the graph (sum of `incomeSources[*].amount`). */
  totalIncome: number;
  /** Sum of all outflows including surplus — should equal totalIncome by construction. */
  totalOutflow: number;
  incomeSources: MoneyFlowSource[];
  entities: MoneyFlowEntity[];
  outflows: MoneyFlowOutflow[];
  edges: MoneyFlowEdge[];
  /** True when the user has zero entities, zero income or zero expenses — the
   *  Sankey shouldn't render. The page falls back to a friendlier message. */
  isEmpty: boolean;
}

// ---------------------------------------------------------------------------
// Source-label classifier
// ---------------------------------------------------------------------------

function classifyIncome(type: string, sourceType?: string | null): MoneyFlowSourceLabel {
  if (type === 'SALARY') return 'Salary';
  if (type === 'RENTAL' || type === 'RENT') return 'Rental';
  if (type === 'INVESTMENT' || sourceType === 'INVESTMENT') return 'Investment';
  return 'Other';
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function getMoneyFlow(
  userId: string,
  client: PrismaTxOrClient = prisma,
): Promise<MoneyFlowResult> {
  // Load everything we need in parallel.
  const [entities, incomes, expenses, loans] = await Promise.all([
    client.legalEntity.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, type: true, role: true },
    }),
    client.income.findMany({
      where: { userId },
      select: {
        ownerEntityId: true,
        type: true,
        sourceType: true,
        amount: true,
        frequency: true,
        paygWithholding: true,
      },
    }),
    client.expense.findMany({
      where: { userId },
      select: {
        ownerEntityId: true,
        amount: true,
        frequency: true,
        isEssential: true,
      },
    }),
    client.loan.findMany({
      where: { userId },
      select: {
        ownerEntityId: true,
        minRepayment: true,
        repaymentFrequency: true,
      },
    }),
  ]);

  if (entities.length === 0 || (incomes.length === 0 && expenses.length === 0)) {
    return {
      period: 'annual',
      totalIncome: 0,
      totalOutflow: 0,
      incomeSources: [],
      entities: [],
      outflows: [],
      edges: [],
      isEmpty: true,
    };
  }

  // ---------------------------------------------------------------------
  // Aggregate income by (entity × source label)
  // ---------------------------------------------------------------------
  type SourcePerEntity = Record<string, Record<MoneyFlowSourceLabel, number>>;
  const incomeByEntity: SourcePerEntity = {};
  let totalPayg = 0;

  for (const inc of incomes) {
    const annual = toAnnual(inc.amount, inc.frequency as Frequency);
    if (annual <= 0) continue;
    const label = classifyIncome(inc.type, inc.sourceType);
    if (!incomeByEntity[inc.ownerEntityId]) {
      incomeByEntity[inc.ownerEntityId] = {
        Salary: 0,
        Rental: 0,
        Investment: 0,
        Other: 0,
      };
    }
    incomeByEntity[inc.ownerEntityId][label] += annual;
    if (inc.paygWithholding != null && inc.paygWithholding > 0) {
      totalPayg += inc.paygWithholding;
    }
  }

  // Source totals (left column nodes)
  const sourceTotals: Record<MoneyFlowSourceLabel, number> = {
    Salary: 0,
    Rental: 0,
    Investment: 0,
    Other: 0,
  };
  for (const perEntity of Object.values(incomeByEntity)) {
    sourceTotals.Salary += perEntity.Salary;
    sourceTotals.Rental += perEntity.Rental;
    sourceTotals.Investment += perEntity.Investment;
    sourceTotals.Other += perEntity.Other;
  }

  // ---------------------------------------------------------------------
  // Aggregate expenses + loans by entity
  // ---------------------------------------------------------------------
  const essentialByEntity: Record<string, number> = {};
  const discretionaryByEntity: Record<string, number> = {};
  for (const exp of expenses) {
    const annual = toAnnual(exp.amount, exp.frequency as Frequency);
    if (annual <= 0) continue;
    if (exp.isEssential) {
      essentialByEntity[exp.ownerEntityId] =
        (essentialByEntity[exp.ownerEntityId] ?? 0) + annual;
    } else {
      discretionaryByEntity[exp.ownerEntityId] =
        (discretionaryByEntity[exp.ownerEntityId] ?? 0) + annual;
    }
  }

  const loanRepaymentsByEntity: Record<string, number> = {};
  for (const loan of loans) {
    if (!loan.minRepayment || loan.minRepayment <= 0) continue;
    const annual = toAnnual(loan.minRepayment, loan.repaymentFrequency as Frequency);
    loanRepaymentsByEntity[loan.ownerEntityId] =
      (loanRepaymentsByEntity[loan.ownerEntityId] ?? 0) + annual;
  }

  // ---------------------------------------------------------------------
  // Tax allocation — proportional to taxable-income share
  // ---------------------------------------------------------------------
  const taxableByEntity: Record<string, number> = {};
  let totalTaxable = 0;
  for (const [entityId, perSource] of Object.entries(incomeByEntity)) {
    const taxable =
      perSource.Salary + perSource.Rental + perSource.Investment + perSource.Other;
    taxableByEntity[entityId] = taxable;
    totalTaxable += taxable;
  }
  const taxByEntity: Record<string, number> = {};
  if (totalTaxable > 0 && totalPayg > 0) {
    for (const [entityId, taxable] of Object.entries(taxableByEntity)) {
      taxByEntity[entityId] = (taxable / totalTaxable) * totalPayg;
    }
  }

  // ---------------------------------------------------------------------
  // Build the per-entity flow rows
  // ---------------------------------------------------------------------
  const flowEntities: MoneyFlowEntity[] = [];
  let totalIncome = 0;
  let totalEssential = 0;
  let totalDiscretionary = 0;
  let totalLoans = 0;
  let totalTax = 0;
  let totalSurplus = 0;

  for (const e of entities) {
    const perSource = incomeByEntity[e.id] ?? { Salary: 0, Rental: 0, Investment: 0, Other: 0 };
    const incomeIn = perSource.Salary + perSource.Rental + perSource.Investment + perSource.Other;
    const tax = taxByEntity[e.id] ?? 0;
    const essential = essentialByEntity[e.id] ?? 0;
    const discretionary = discretionaryByEntity[e.id] ?? 0;
    const loanRep = loanRepaymentsByEntity[e.id] ?? 0;
    const surplus = Math.max(0, incomeIn - tax - essential - discretionary - loanRep);

    // Skip entities with zero everything — they'd render as empty hairlines.
    if (incomeIn === 0 && essential === 0 && discretionary === 0 && loanRep === 0) {
      continue;
    }

    flowEntities.push({
      id: e.id,
      name: e.name,
      type: e.type,
      role: e.role,
      incomeIn,
      outflows: {
        Tax: tax,
        'Essential expenses': essential,
        Discretionary: discretionary,
        'Loan repayments': loanRep,
        Surplus: surplus,
      },
    });

    totalIncome += incomeIn;
    totalTax += tax;
    totalEssential += essential;
    totalDiscretionary += discretionary;
    totalLoans += loanRep;
    totalSurplus += surplus;
  }

  // ---------------------------------------------------------------------
  // Build the Sankey edges
  // ---------------------------------------------------------------------
  const edges: MoneyFlowEdge[] = [];

  // Income source → Entity edges
  for (const entity of flowEntities) {
    const perSource = incomeByEntity[entity.id];
    if (!perSource) continue;
    (Object.keys(perSource) as MoneyFlowSourceLabel[]).forEach((label) => {
      const amount = perSource[label];
      if (amount > 0) {
        edges.push({ source: `src:${label}`, target: `ent:${entity.id}`, amount });
      }
    });
  }

  // Entity → Outflow edges
  for (const entity of flowEntities) {
    (Object.entries(entity.outflows) as Array<[MoneyFlowOutflowLabel, number]>).forEach(
      ([label, amount]) => {
        if (amount > 0) {
          edges.push({ source: `ent:${entity.id}`, target: `out:${label}`, amount });
        }
      },
    );
  }

  // Filter empty source / outflow nodes so the Sankey doesn't render
  // ghost columns.
  const incomeSources: MoneyFlowSource[] = (
    ['Salary', 'Rental', 'Investment', 'Other'] as MoneyFlowSourceLabel[]
  )
    .filter((l) => sourceTotals[l] > 0)
    .map((l) => ({ label: l, amount: sourceTotals[l] }));

  const outflows: MoneyFlowOutflow[] = (
    [
      'Tax',
      'Essential expenses',
      'Discretionary',
      'Loan repayments',
      'Surplus',
    ] as MoneyFlowOutflowLabel[]
  )
    .map((l) => {
      const total =
        l === 'Tax'
          ? totalTax
          : l === 'Essential expenses'
            ? totalEssential
            : l === 'Discretionary'
              ? totalDiscretionary
              : l === 'Loan repayments'
                ? totalLoans
                : totalSurplus;
      return { label: l, amount: total };
    })
    .filter((o) => o.amount > 0);

  const totalOutflow = totalTax + totalEssential + totalDiscretionary + totalLoans + totalSurplus;

  return {
    period: 'annual',
    totalIncome,
    totalOutflow,
    incomeSources,
    entities: flowEntities,
    outflows,
    edges,
    isEmpty: flowEntities.length === 0 || incomeSources.length === 0,
  };
}
