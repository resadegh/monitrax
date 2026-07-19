/**
 * MON-076 Part A Ratchet — per-person tax attribution (household income).
 *
 * AU income tax is assessed PER INDIVIDUAL: a household member's salary must
 * produce THEIR taxable income + tax owing, not inflate the primary's. This
 * runs the REAL `getUserTaxPosition` on a two-earner household (Reza-like
 * primary + Newsha-like spouse marked income earner, her salary attributed to
 * her INDIVIDUAL entity) and locks:
 *   • member B's salary lands in B's partition, NOT A's;
 *   • the household roll-up still contains everything (back-compat, zero
 *     number change for existing consumers);
 *   • each partition is produced by the SAME engine over partitioned inputs
 *     (attribution, no new tax math).
 *
 * The DB mock is purpose-scoped (visible scalar-where semantics — the shared
 * golden factory's findUnique is id-only and can't serve the members
 * relation).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const USER = 'household-user';

vi.mock('@/lib/db', () => {
  const rows: Record<string, any[]> = {
    income: [
      {
        id: 'i-reza-sal', userId: 'household-user', ownerEntityId: 'le-reza',
        name: 'Reza Salary', type: 'SALARY', amount: 11_300, frequency: 'MONTHLY',
        isRecurring: true, isTaxable: true, propertyId: null, investmentAccountId: null,
        grossAmount: null, paygWithholding: null, frankingPercentage: null, frankingCredits: null,
      },
      {
        id: 'i-newsha-sal', userId: 'household-user', ownerEntityId: 'le-newsha',
        name: 'Ingeus Australia', type: 'SALARY', amount: 4_159, frequency: 'MONTHLY',
        isRecurring: true, isTaxable: true, propertyId: null, investmentAccountId: null,
        grossAmount: null, paygWithholding: null, frankingPercentage: null, frankingCredits: null,
      },
    ],
    expense: [],
    depreciationSchedule: [],
    superannuationAccount: [],
    investmentHolding: [],
    property: [],
  };
  const list = (name: string) => ({
    findMany: async () => structuredClone(rows[name] ?? []),
  });
  const db = {
    income: list('income'),
    expense: list('expense'),
    depreciationSchedule: list('depreciationSchedule'),
    superannuationAccount: list('superannuationAccount'),
    investmentHolding: list('investmentHolding'),
    property: list('property'),
    loanTransaction: { groupBy: async () => [] },
    householdProfile: {
      findUnique: async () => ({
        members: [
          { id: 'm-reza', name: 'Reza', relationship: 'SELF' },
          { id: 'm-newsha', name: 'Newsha', relationship: 'SPOUSE' },
        ],
      }),
    },
    legalEntity: {
      findFirst: async ({ where }: any) =>
        where?.householdMemberId === 'm-newsha'
          ? { id: 'le-newsha' }
          : where?.type === 'PERSONAL_NAME'
            ? { id: 'le-reza' }
            : null,
      create: async () => {
        throw new Error('entities pre-exist in this fixture — create must not run');
      },
    },
  };
  return { default: db, prisma: db };
});

import { getUserTaxPosition } from '@/lib/tax-engine/position/userTaxPosition';

let bundle: Awaited<ReturnType<typeof getUserTaxPosition>>;

beforeAll(async () => {
  bundle = await getUserTaxPosition(USER);
});

describe('MON-076 Part A — per-person tax positions', () => {
  it('two earners → two partitions, salaries attributed to their OWN member', () => {
    expect(bundle.perMember).toHaveLength(2);
    const reza = bundle.perMember.find((m) => m.memberName === 'Reza')!;
    const newsha = bundle.perMember.find((m) => m.memberName === 'Newsha')!;
    expect(reza.isPrimary).toBe(true);
    expect(reza.engineInputs.incomes.map((i) => i.id)).toEqual(['i-reza-sal']);
    expect(newsha.engineInputs.incomes.map((i) => i.id)).toEqual(['i-newsha-sal']);
  });

  it("member B's salary produces B's taxable income — and leaves A's untouched", () => {
    const reza = bundle.perMember.find((m) => m.memberName === 'Reza')!;
    const newsha = bundle.perMember.find((m) => m.memberName === 'Newsha')!;
    // Annualised: Reza 11,300×12 = 135,600 · Newsha 4,159×12 = 49,908.
    expect(reza.taxPosition.income.salary).toBeCloseTo(135_600, 0);
    expect(newsha.taxPosition.income.salary).toBeCloseTo(49_908, 0);
    expect(newsha.taxPosition.tax.netTax).toBeGreaterThan(0);
    // A's position must NOT contain B's salary (the whole point).
    expect(reza.taxPosition.income.salary + newsha.taxPosition.income.salary)
      .toBeCloseTo(bundle.taxPosition.income.salary, 0);
  });

  it('the household roll-up is unchanged — all rows, same engine (back-compat)', () => {
    expect(bundle.taxPosition.income.salary).toBeCloseTo(135_600 + 49_908, 0);
    expect(bundle.engineInputs.incomes).toHaveLength(2);
  });
});
