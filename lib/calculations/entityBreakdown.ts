/**
 * Entity breakdown — Phase 47 Stage C1 (Entity Ownership Fabric).
 *
 * Pure calculator: partitions the user's raw financial rows by
 * `ownerEntityId` and computes a per-entity position by REUSING the
 * canonical engines (`calculateNetWorth` per partition, `toMonthly` for
 * streams) — never re-implementing their math (§12.2/§12.3).
 *
 * ADDITIVE guarantee (the phase's non-breaking contract): this function
 * only ever ADDS the `byEntity` view beside the flat household numbers.
 * The flat totals are computed exactly as before, by the same engines,
 * over the same un-partitioned arrays — and the additivity invariant
 * (Σ per-entity == household) is pinned by
 * `tests/ownership/entityBreakdown.test.ts`.
 *
 * Ownership semantics:
 *   - Rows carry `ownerEntityId` (NOT NULL for core types since Phase
 *     41a; nullable for super — null rows attribute to the fallback
 *     "unattributed" bucket rather than being dropped, so the sums
 *     always reconcile).
 *   - Holdings derive ownership from their investment account (§4B D3).
 *   - Joint/shared stake SPLITTING is deliberately NOT applied here yet:
 *     the legal-title holder carries the full value at Stage C (matching
 *     what the flat dashboard shows today). Per-stake attribution lands
 *     with Stage D's facts assembly, where the tax engine needs it —
 *     splitting display values before tax splits would make the universe
 *     and the dashboard disagree.
 */

import { calculateNetWorth, type NetWorthResult } from '@/lib/calculations/netWorthCalculator';
import { toMonthly } from '@/lib/utils/frequencies';

export interface EntityRef {
  id: string;
  name: string;
  type: string;
}

interface OwnedRow {
  ownerEntityId?: string | null;
}

export interface EntityBreakdownInput {
  entities: EntityRef[];
  properties: Array<OwnedRow & { currentValue: number }>;
  accounts: Array<OwnedRow & { currentBalance: number; type: string }>;
  investmentHoldings: Array<{
    investmentAccount?: { ownerEntityId: string | null } | null;
    units: number;
    currentPrice?: number | null;
    averagePrice: number;
  }>;
  loans: Array<OwnedRow & { principal: number; type: string; propertyId?: string | null }>;
  superannuation: Array<OwnedRow & { currentBalance: number; fundType?: string }>;
  assets: Array<OwnedRow & { currentValue: number }>;
  income: Array<OwnedRow & { amount: number; frequency: string }>;
  expenses: Array<OwnedRow & { amount: number; frequency: string }>;
}

export interface EntityPosition {
  entityId: string;
  entityName: string;
  entityType: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyCashflow: number;
  counts: { holdings: number };
}

/** Sentinel bucket for rows whose owner can't be resolved (defensive). */
export const UNATTRIBUTED_ENTITY_ID = '__unattributed__';

function ownerOf(row: OwnedRow): string {
  return row.ownerEntityId ?? UNATTRIBUTED_ENTITY_ID;
}

/**
 * Partition raw rows by owning entity and compute each entity's
 * position via the canonical engines. Entities with no holdings are
 * omitted (an empty trust shouldn't render a $0 row — the universe
 * already shows its structural presence).
 */
export function buildEntityBreakdown(input: EntityBreakdownInput): EntityPosition[] {
  const nameById = new Map(input.entities.map(e => [e.id, e]));

  type Bucket = {
    properties: EntityBreakdownInput['properties'];
    accounts: EntityBreakdownInput['accounts'];
    holdings: EntityBreakdownInput['investmentHoldings'];
    loans: EntityBreakdownInput['loans'];
    superannuation: EntityBreakdownInput['superannuation'];
    assets: EntityBreakdownInput['assets'];
    income: EntityBreakdownInput['income'];
    expenses: EntityBreakdownInput['expenses'];
  };
  const buckets = new Map<string, Bucket>();
  const bucket = (id: string): Bucket => {
    let b = buckets.get(id);
    if (!b) {
      b = {
        properties: [],
        accounts: [],
        holdings: [],
        loans: [],
        superannuation: [],
        assets: [],
        income: [],
        expenses: [],
      };
      buckets.set(id, b);
    }
    return b;
  };

  for (const p of input.properties) bucket(ownerOf(p)).properties.push(p);
  for (const a of input.accounts) bucket(ownerOf(a)).accounts.push(a);
  for (const h of input.investmentHoldings) {
    bucket(h.investmentAccount?.ownerEntityId ?? UNATTRIBUTED_ENTITY_ID).holdings.push(h);
  }
  for (const l of input.loans) bucket(ownerOf(l)).loans.push(l);
  for (const s of input.superannuation) bucket(ownerOf(s)).superannuation.push(s);
  for (const a of input.assets) bucket(ownerOf(a)).assets.push(a);
  for (const i of input.income) bucket(ownerOf(i)).income.push(i);
  for (const e of input.expenses) bucket(ownerOf(e)).expenses.push(e);

  const positions: EntityPosition[] = [];
  for (const [entityId, b] of buckets) {
    const entity = nameById.get(entityId);
    // Canonical engine per partition — identical math to the household
    // flat numbers, just on the entity's slice.
    const nw: NetWorthResult = calculateNetWorth(
      b.properties.map(p => ({ currentValue: p.currentValue })),
      b.accounts.map(a => ({ currentBalance: a.currentBalance, type: a.type })),
      b.holdings.map(h => ({
        units: h.units,
        currentPrice: h.currentPrice || undefined,
        averagePrice: h.averagePrice,
      })),
      b.loans.map(l => ({ principal: l.principal, type: l.type, propertyId: l.propertyId })),
      b.superannuation.map(s => ({
        balance: s.currentBalance,
        fundType: s.fundType as 'INDUSTRY' | 'RETAIL' | 'SMSF' | undefined,
      })),
      b.assets.map(a => ({ currentValue: a.currentValue })),
    );
    const monthlyIncome = b.income.reduce(
      (sum, i) => sum + toMonthly(i.amount, i.frequency as Parameters<typeof toMonthly>[1]),
      0,
    );
    const monthlyExpenses = b.expenses.reduce(
      (sum, e) => sum + toMonthly(e.amount, e.frequency as Parameters<typeof toMonthly>[1]),
      0,
    );
    positions.push({
      entityId,
      entityName:
        entity?.name ?? (entityId === UNATTRIBUTED_ENTITY_ID ? 'Unattributed' : 'Unknown entity'),
      entityType: entity?.type ?? 'UNKNOWN',
      netWorth: nw.netWorth,
      assets: nw.assets.total,
      liabilities: nw.liabilities.total,
      monthlyIncome,
      monthlyExpenses,
      monthlyCashflow: monthlyIncome - monthlyExpenses,
      counts: {
        holdings:
          b.properties.length +
          b.accounts.length +
          b.holdings.length +
          b.loans.length +
          b.superannuation.length +
          b.assets.length,
      },
    });
  }

  // Stable order: largest net position first; unattributed last.
  positions.sort((a, b) => {
    if (a.entityId === UNATTRIBUTED_ENTITY_ID) return 1;
    if (b.entityId === UNATTRIBUTED_ENTITY_ID) return -1;
    return b.netWorth - a.netWorth;
  });
  return positions;
}
