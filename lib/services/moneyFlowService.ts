/**
 * Money Flow service — Phase 41d, extended Phase 44 Part 2d.
 *
 * Returns the per-entity flow shape consumed by the Money Flow Sankey
 * (`components/entities/MoneyFlowSankey.tsx`) on `/dashboard/entities`.
 *
 * Composition (annual, FY-bucketed):
 *
 *   Income source (Salary / Rental / Investment / Other) — BANKED (D17):
 *      the cash that reaches the account, from the ONE banked-income
 *      producer's per-row attribution (MON-131 T1-B)
 *      ↓  per-entity allocation via Income.ownerEntityId
 *   Legal entity
 *      ↓  Tax — always 0 since T1-B: the wedge is taken BEFORE pay banks,
 *         so it is not an outflow of banked cash (it lives on the tax
 *         position, §1.1). Key retained for shape stability.
 *      ↓  Essential expenses (Expense.ownerEntityId + isEssential)
 *      ↓  Discretionary expenses
 *      ↓  Loan repayments
 *      ↓  Distributions (Phase 44 Part 2d — CONFIRMED trust resolutions
 *         + company dividends sourced from this entity; declared
 *         entitlements, not necessarily cash paid)
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
 *   - Loan repayments use `minRepayment` annualised — actual interest
 *     vs. principal split lands in the entity-aware tax engine.
 *   - Distributions are the trust's `trustNetIncome` (s95) / the
 *     company's declared `totalAmount`. They represent declared
 *     entitlements — a beneficiary can be presently entitled with no
 *     cash moved (an unpaid present entitlement). Only CONFIRMED rows
 *     count; DRAFT resolutions are working notes.
 *   - The "Surplus" bucket is the arithmetic residual after the five
 *     other outflows. Negative residuals (deficit) clamp to 0 for the
 *     Sankey layout (recharts can't draw negative-width links).
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, LegalEntityRole, LegalEntityType } from '@prisma/client';
import { toAnnual } from '@/lib/utils/frequencies';
// MON-131 T2-B — the ONE loan-cost feed, used by the CANONICAL basis below.
import { resolveLoanCostsForUser } from '@/lib/services/loanCosts';
import type { CashflowLoan } from '@/lib/calculations/propertyCashflow';
import type { Frequency } from '@/lib/types/prisma-enums';
import {
  assembleBankedIncomeForUser,
  bankedMonthlyPerRow,
} from '@/lib/income/banked/assembly';

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
  | 'Distributions'
  | 'Surplus';

/**
 * Phase 44 Part 2d — a recorded inter-entity distribution: a trust's
 * `DistributionResolution` (trust → beneficiaries) or a company's
 * `DividendDistribution` (company → shareholders). These are
 * **entitlements / declared distributions**, not necessarily cash paid
 * (a beneficiary can be presently entitled with no cash moved — an
 * unpaid present entitlement; a dividend can be declared then paid in a
 * different year). PHASE_44_PART_2 §6.4 + law-review §13-F22.
 */
export interface MoneyFlowDistribution {
  fromEntityId: string;
  fromEntityName: string;
  kind: 'TRUST_DISTRIBUTION' | 'DIVIDEND';
  /** Total distributed / declared for the FY. */
  amount: number;
  recipients: Array<{ name: string; amount: number }>;
}

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
  /**
   * Phase 44 Part 2d — the recorded inter-entity distributions
   * (CONFIRMED `DistributionResolution` + `DividendDistribution`). The
   * `Distributions` outflow column is the per-entity aggregate of these;
   * this array carries the per-recipient detail (trust → which
   * beneficiary, company → which shareholder).
   */
  distributions: MoneyFlowDistribution[];
  /** True when the user has zero entities, zero income or zero expenses — the
   *  Sankey shouldn't render. The page falls back to a friendlier message. */
  isEmpty: boolean;
}

// ---------------------------------------------------------------------------
// Distribution-detail builder (Phase 44 Part 2d) — pure, exported for tests
// ---------------------------------------------------------------------------

/** Normalised resolution row for `buildDistributionDetail` (Decimal → number). */
export interface RawResolutionForFlow {
  trustEntityId: string;
  trustNetIncome: number;
  allocations: Array<{ beneficiaryEntityId: string; presentlyEntitledShare: number }>;
}

/** Normalised dividend row for `buildDistributionDetail` (Decimal → number). */
export interface RawDividendForFlow {
  companyEntityId: string;
  totalAmount: number;
  payments: Array<{ shareholderEntityId: string; amount: number }>;
}

/**
 * Build the per-recipient distribution detail from CONFIRMED trust
 * resolutions + company dividends. Pure — no I/O. A trust distribution's
 * recipient amount is the beneficiary's `presentlyEntitledShare`
 * (a fraction 0..1) applied to `trustNetIncome` — the Bamford
 * proportionate model.
 */
export function buildDistributionDetail(
  resolutions: readonly RawResolutionForFlow[],
  dividends: readonly RawDividendForFlow[],
  nameById: ReadonlyMap<string, string>,
): MoneyFlowDistribution[] {
  const out: MoneyFlowDistribution[] = [];

  for (const r of resolutions) {
    if (r.trustNetIncome <= 0) continue;
    out.push({
      fromEntityId: r.trustEntityId,
      fromEntityName: nameById.get(r.trustEntityId) ?? r.trustEntityId,
      kind: 'TRUST_DISTRIBUTION',
      amount: r.trustNetIncome,
      recipients: r.allocations.map((a) => ({
        name: nameById.get(a.beneficiaryEntityId) ?? a.beneficiaryEntityId,
        amount: a.presentlyEntitledShare * r.trustNetIncome,
      })),
    });
  }

  for (const d of dividends) {
    if (d.totalAmount <= 0) continue;
    out.push({
      fromEntityId: d.companyEntityId,
      fromEntityName: nameById.get(d.companyEntityId) ?? d.companyEntityId,
      kind: 'DIVIDEND',
      amount: d.totalAmount,
      recipients: d.payments.map((p) => ({
        name: nameById.get(p.shareholderEntityId) ?? p.shareholderEntityId,
        amount: p.amount,
      })),
    });
  }

  return out;
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

/**
 * MON-131 T2-B — which producer the LOAN leg reads.
 *
 * `'DECLARED'` is today's behaviour, kept as the default so this parameter
 * moves NO number on its own: the raw declared-repayment field converted to
 * annual, and any loan without one skipped outright. That skip is the defect —
 * both interest-only loans and HECS contribute $0 to the entity flow,
 * understating it by **$3,792.92/mo**, measured by the T2 relay at `915704f0`.
 *
 * (The field is named in prose rather than as an identifier on purpose: the
 * producer census matches raw text and a JSDoc line's leading asterisk reads
 * as arithmetic, which books this file's PRECEDING function as a phantom
 * loan-cost producer. Same trap recorded at the T2 migration site.)
 *
 * `'CANONICAL'` reads `resolveLoanCostsForUser` — actuals-first, every loan, no
 * filter — and the resolver fetches its own transactions and offsets, so a
 * caller cannot starve it (the MON-140 shape).
 *
 * WHY A SEAM RATHER THAN A REPLICA IN THE RELAY. The T2-B compare relay has to
 * measure what the migration will actually produce. `getMoneyFlow` is not a
 * pure engine taking injectable legs — it fetches its own three-column loan
 * rows and does the per-entity aggregation, surplus flooring and edge building
 * inline. A relay that re-implemented that aggregation would be measuring a
 * second implementation, which is precisely the MON-035 parity failure (a
 * resolver that shares a source with the thing it checks cannot see them
 * diverge). Putting the basis switch INSIDE the producer means both arms of
 * the comparison run the real engine, and the migration is then a one-word
 * default flip whose effect the capture has already measured.
 *
 * This is the T1-A scaffold pattern: ship the seam, prove it moves nothing,
 * measure through it, declare, then flip.
 */
export type LoanCostBasis = 'DECLARED' | 'CANONICAL';

export async function getMoneyFlow(
  userId: string,
  client: PrismaTxOrClient = prisma,
  options: { loanCostBasis?: LoanCostBasis } = {},
): Promise<MoneyFlowResult> {
  const loanCostBasis: LoanCostBasis = options.loanCostBasis ?? 'DECLARED';
  // Load everything we need in parallel. Income rows + their banked values
  // come from the ONE banked-income assembler (MON-131 T1-B) — never a local
  // re-derivation of the income run-rate.
  const [entities, assembled, expenses, loans, resolutions, dividends] = await Promise.all([
    client.legalEntity.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, type: true, role: true },
    }),
    assembleBankedIncomeForUser(userId),
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
        // `id`, `principal`, `interestRateAnnual` are selected unconditionally
        // so the CANONICAL basis has a row the resolver can work with. Under
        // DECLARED they are simply unread, so the default path is unchanged.
        id: true,
        principal: true,
        interestRateAnnual: true,
        ownerEntityId: true,
        minRepayment: true,
        repaymentFrequency: true,
      },
    }),
    // Phase 44 Part 2d — recorded inter-entity distributions. Only
    // CONFIRMED rows feed the visual; DRAFT resolutions/dividends are
    // working notes, not declared entitlements.
    client.distributionResolution.findMany({
      where: { userId, status: 'CONFIRMED' },
      select: {
        trustEntityId: true,
        trustNetIncome: true,
        allocations: {
          select: { beneficiaryEntityId: true, presentlyEntitledShare: true },
        },
      },
    }),
    client.dividendDistribution.findMany({
      where: { userId, status: 'CONFIRMED' },
      select: {
        companyEntityId: true,
        totalAmount: true,
        payments: { select: { shareholderEntityId: true, amount: true } },
      },
    }),
  ]);

  const incomes = assembled.raw.income;
  const perRowBankedMonthly = bankedMonthlyPerRow(assembled.banked, incomes);

  if (entities.length === 0 || (incomes.length === 0 && expenses.length === 0)) {
    return {
      period: 'annual',
      totalIncome: 0,
      totalOutflow: 0,
      incomeSources: [],
      entities: [],
      outflows: [],
      edges: [],
      distributions: [],
      isEmpty: true,
    };
  }

  // ---------------------------------------------------------------------
  // Distributions (Phase 44 Part 2d) — recorded trust resolutions +
  // company dividends. The per-recipient detail is built once here; the
  // per-entity aggregate feeds the `Distributions` outflow column below.
  // ---------------------------------------------------------------------
  const nameById = new Map(entities.map((e) => [e.id, e.name]));
  const distributions = buildDistributionDetail(
    resolutions.map((r) => ({
      trustEntityId: r.trustEntityId,
      trustNetIncome: Number(r.trustNetIncome),
      allocations: r.allocations.map((a) => ({
        beneficiaryEntityId: a.beneficiaryEntityId,
        presentlyEntitledShare: Number(a.presentlyEntitledShare),
      })),
    })),
    dividends.map((d) => ({
      companyEntityId: d.companyEntityId,
      totalAmount: Number(d.totalAmount),
      payments: d.payments.map((p) => ({
        shareholderEntityId: p.shareholderEntityId,
        amount: Number(p.amount),
      })),
    })),
    nameById,
  );

  const distributionsByEntity: Record<string, number> = {};
  for (const dist of distributions) {
    distributionsByEntity[dist.fromEntityId] =
      (distributionsByEntity[dist.fromEntityId] ?? 0) + dist.amount;
  }

  // ---------------------------------------------------------------------
  // Aggregate income by (entity × source label) — BANKED (D17): the cash
  // that actually reaches the entity's accounts, from the ONE producer's
  // per-row attribution. The old declared toAnnual sum (gross ≡ net, one-off
  // rows annualised — the MON-137 class) is deleted, not wrapped.
  // ---------------------------------------------------------------------
  type SourcePerEntity = Record<string, Record<MoneyFlowSourceLabel, number>>;
  const incomeByEntity: SourcePerEntity = {};

  for (const inc of incomes as Array<(typeof incomes)[number] & { sourceType?: string | null }>) {
    const annual = (inc.id ? (perRowBankedMonthly.get(inc.id) ?? 0) : 0) * 12;
    if (annual <= 0) continue;
    const label = classifyIncome(inc.type, inc.sourceType);
    if (!incomeByEntity[inc.ownerEntityId ?? '']) {
      incomeByEntity[inc.ownerEntityId ?? ''] = {
        Salary: 0,
        Rental: 0,
        Investment: 0,
        Other: 0,
      };
    }
    incomeByEntity[inc.ownerEntityId ?? ''][label] += annual;
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

  // MON-131 T2-B — the loan leg, on whichever basis was asked for.
  const loanRepaymentsByEntity: Record<string, number> = {};
  if (loanCostBasis === 'CANONICAL') {
    // Every loan, no filter. The resolver fetches its own linked repayments and
    // offset balances, so the three columns this service selects cannot starve
    // it. Annualised from the UNROUNDED monthly — round at the leaf, never at
    // the input (the T2 feed contract; rounding per loan first cost a cent that
    // cascaded through four downstream leaves).
    const resolved = await resolveLoanCostsForUser(
      userId,
      loans as unknown as CashflowLoan[],
    );
    for (const loan of loans) {
      const annual = (resolved.get(loan.id)?.monthly ?? 0) * 12;
      if (annual === 0) continue;
      loanRepaymentsByEntity[loan.ownerEntityId] =
        (loanRepaymentsByEntity[loan.ownerEntityId] ?? 0) + annual;
    }
  } else {
    for (const loan of loans) {
      // THE DEFECT, kept deliberately intact until the T2-B capture declares
      // what removing it moves: a loan with no declared repayment is skipped
      // outright, so both interest-only loans and HECS contribute $0 while
      // interest is charged on them every month.
      if (!loan.minRepayment || loan.minRepayment <= 0) continue;
      const annual = toAnnual(loan.minRepayment, loan.repaymentFrequency as Frequency);
      loanRepaymentsByEntity[loan.ownerEntityId] =
        (loanRepaymentsByEntity[loan.ownerEntityId] ?? 0) + annual;
    }
  }

  // ---------------------------------------------------------------------
  // Tax outflow — REMOVED with the banked basis (MON-131 T1-B). Income now
  // enters the flow as BANKED cash: the withholding wedge is taken BEFORE
  // pay reaches the account, so carving a Tax outflow out of banked income
  // again would double-count it. The wedge lives on the tax position
  // (`getUserTaxPosition().taxPosition.paygWithheld` — the §1.1 derived
  // credit), not in this Sankey. The old proportional allocation of the
  // stored per-row sum is deleted, not wrapped.
  // ---------------------------------------------------------------------
  const taxByEntity: Record<string, number> = {};

  // ---------------------------------------------------------------------
  // Build the per-entity flow rows
  // ---------------------------------------------------------------------
  const flowEntities: MoneyFlowEntity[] = [];
  let totalIncome = 0;
  let totalEssential = 0;
  let totalDiscretionary = 0;
  let totalLoans = 0;
  let totalTax = 0;
  let totalDistributions = 0;
  let totalSurplus = 0;

  for (const e of entities) {
    const perSource = incomeByEntity[e.id] ?? { Salary: 0, Rental: 0, Investment: 0, Other: 0 };
    const incomeIn = perSource.Salary + perSource.Rental + perSource.Investment + perSource.Other;
    const tax = taxByEntity[e.id] ?? 0;
    const essential = essentialByEntity[e.id] ?? 0;
    const discretionary = discretionaryByEntity[e.id] ?? 0;
    const loanRep = loanRepaymentsByEntity[e.id] ?? 0;
    const distributed = distributionsByEntity[e.id] ?? 0;
    const surplus = Math.max(
      0,
      incomeIn - tax - essential - discretionary - loanRep - distributed,
    );

    // Skip entities with zero everything — they'd render as empty hairlines.
    // A recorded distribution alone keeps the row: a trust/company that
    // declared a distribution belongs in the picture even if its income
    // isn't captured as Income rows (warn-not-reject — CLAUDE.md §6.1).
    if (
      incomeIn === 0 &&
      essential === 0 &&
      discretionary === 0 &&
      loanRep === 0 &&
      distributed === 0
    ) {
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
        Distributions: distributed,
        Surplus: surplus,
      },
    });

    totalIncome += incomeIn;
    totalTax += tax;
    totalEssential += essential;
    totalDiscretionary += discretionary;
    totalLoans += loanRep;
    totalDistributions += distributed;
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
      'Distributions',
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
                : l === 'Distributions'
                  ? totalDistributions
                  : totalSurplus;
      return { label: l, amount: total };
    })
    .filter((o) => o.amount > 0);

  const totalOutflow =
    totalTax +
    totalEssential +
    totalDiscretionary +
    totalLoans +
    totalDistributions +
    totalSurplus;

  return {
    period: 'annual',
    totalIncome,
    totalOutflow,
    incomeSources,
    entities: flowEntities,
    outflows,
    edges,
    distributions,
    isEmpty: flowEntities.length === 0 || incomeSources.length === 0,
  };
}
