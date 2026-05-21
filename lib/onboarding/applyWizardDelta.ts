/**
 * applyWizardDelta — Phase 12 Track G.4: the "describe it in your own
 * words" accelerator's delta → wizard-state merge.
 *
 * The accelerator sends the user's free-text sentence to the extraction
 * engine (`/api/onboarding/chat/extract`), which returns a
 * `WizardStateDelta`. This module turns that delta into a
 * `Partial<WizardData>` the wizard step can merge via `onUpdate`.
 *
 * SEMANTICS — append, never replace. Each delta item becomes a NEW
 * `*Input` row (fresh `temp_…` id) appended to the step's array, with
 * the delta's fields overlaid on sensible defaults for the required
 * fields the extraction does not capture. The form stays the system of
 * record: the user reviews + completes + edits the pre-filled rows. A
 * bad extraction is therefore never destructive — at worst the user
 * deletes a row.
 *
 * PURE — no fetch, no React. Unit-testable.
 *
 * See docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md §10 (G.4).
 */

import type { WizardStateDelta } from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';
import {
  type WizardData,
  type HouseholdMemberInput,
  type HouseholdPetInput,
  type PropertyInput,
  type DebtInput,
  type AccountInput,
  type InvestmentAccountInput,
  type SuperAccountInput,
  type AssetInput,
  type IncomeInput,
  type ExpenseInput,
  generateId,
} from '@/components/onboarding/wizard/types';

/**
 * Apply an extraction delta to the current wizard data, returning a
 * `Partial<WizardData>` of the arrays that gained rows. The caller
 * passes the result straight to the step's `onUpdate`.
 *
 * Returns an empty object when the delta carried nothing usable.
 */
export function applyWizardDelta(
  delta: WizardStateDelta,
  data: WizardData,
): Partial<WizardData> {
  switch (delta.topic) {
    case 'household': {
      const f = delta.fields;
      const updates: Partial<WizardData> = {};
      if (f.householdMembers && f.householdMembers.length > 0) {
        updates.householdMembers = [
          ...data.householdMembers,
          ...f.householdMembers.map(
            (m): HouseholdMemberInput => ({
              id: generateId(),
              name: m.name,
              relationship: m.relationship,
              isIncomeEarner: m.isIncomeEarner,
            }),
          ),
        ];
      }
      if (f.householdPets && f.householdPets.length > 0) {
        updates.householdPets = [
          ...data.householdPets,
          ...f.householdPets.map(
            (p): HouseholdPetInput => ({
              id: generateId(),
              name: p.name,
              type: p.type,
            }),
          ),
        ];
      }
      if (typeof f.carsCount === 'number') {
        updates.carsCount = f.carsCount;
      }
      return updates;
    }

    case 'properties': {
      const items = delta.fields.properties ?? [];
      if (items.length === 0) return {};
      return {
        properties: [
          ...data.properties,
          ...items.map(
            (p): PropertyInput => ({
              id: generateId(),
              name: p.name,
              address: '',
              type: p.type ?? 'INVESTMENT',
              purchasePrice: 0,
              currentValue: p.currentValue ?? 0,
              hasLoan: p.hasLoan ?? false,
              expenses: [],
            }),
          ),
        ],
      };
    }

    case 'debts': {
      const items = delta.fields.debts ?? [];
      if (items.length === 0) return {};
      return {
        debts: [
          ...data.debts,
          ...items.map(
            (d): DebtInput => ({
              id: generateId(),
              name: d.name,
              type: d.type ?? 'PERSONAL',
              principal: d.principal ?? 0,
              interestRateAnnual: 0,
              minRepayment: 0,
              repaymentFrequency: 'MONTHLY',
              isHecsHelp: d.isHecsHelp ?? false,
            }),
          ),
        ],
      };
    }

    case 'accounts': {
      const items = delta.fields.accounts ?? [];
      if (items.length === 0) return {};
      return {
        accounts: [
          ...data.accounts,
          ...items.map(
            (a): AccountInput => ({
              id: generateId(),
              name: a.name,
              type: a.type ?? 'SAVINGS',
              currentBalance: a.currentBalance ?? 0,
              source: 'MANUAL',
            }),
          ),
        ],
      };
    }

    case 'investments': {
      const items = delta.fields.investments ?? [];
      if (items.length === 0) return {};
      return {
        investments: [
          ...data.investments,
          ...items.map(
            (inv): InvestmentAccountInput => ({
              id: generateId(),
              name: inv.name,
              type: inv.type ?? 'BROKERAGE',
              // The delta carries a single `totalValue`; seed it as the
              // cash balance — the user splits it into holdings if they
              // wish. Keeps the figure visible, never invents holdings.
              cashBalance: inv.totalValue ?? 0,
              holdings: [],
            }),
          ),
        ],
      };
    }

    case 'super': {
      const items = delta.fields.superAccounts ?? [];
      if (items.length === 0) return {};
      return {
        superAccounts: [
          ...data.superAccounts,
          ...items.map(
            (s): SuperAccountInput => ({
              id: generateId(),
              name: s.fundName,
              fundName: s.fundName,
              currentBalance: s.currentBalance ?? 0,
            }),
          ),
        ],
      };
    }

    case 'assets': {
      const items = delta.fields.assets ?? [];
      if (items.length === 0) return {};
      return {
        assets: [
          ...data.assets,
          ...items.map(
            (a): AssetInput => ({
              id: generateId(),
              name: a.name,
              type: a.type ?? 'OTHER',
              purchasePrice: 0,
              currentValue: a.currentValue ?? 0,
              expenses: [],
            }),
          ),
        ],
      };
    }

    case 'income-expenses': {
      const f = delta.fields;
      const updates: Partial<WizardData> = {};
      if (f.incomes && f.incomes.length > 0) {
        updates.income = [
          ...data.income,
          ...f.incomes.map(
            (inc): IncomeInput => ({
              id: generateId(),
              name: inc.name,
              type: inc.type ?? 'OTHER',
              amount: inc.amount ?? 0,
              frequency: inc.frequency ?? 'ANNUAL',
              ...(inc.salaryType ? { salaryType: inc.salaryType } : {}),
            }),
          ),
        ];
      }
      if (f.expenses && f.expenses.length > 0) {
        updates.expenses = [
          ...data.expenses,
          ...f.expenses.map(
            (exp): ExpenseInput => ({
              id: generateId(),
              name: exp.name,
              category: exp.category ?? 'PERSONAL',
              amount: exp.amount ?? 0,
              frequency: exp.frequency ?? 'MONTHLY',
            }),
          ),
        ];
      }
      return updates;
    }

    default:
      return {};
  }
}

/**
 * How many rows the delta itself carries — for the accelerator's result
 * message ("Added 3 properties"). Counts the SOURCE delta items, not the
 * merged arrays.
 */
export function countDeltaItems(delta: WizardStateDelta): number {
  switch (delta.topic) {
    case 'household': {
      const f = delta.fields;
      return (
        (f.householdMembers?.length ?? 0) +
        (f.householdPets?.length ?? 0) +
        (typeof f.carsCount === 'number' ? 1 : 0)
      );
    }
    case 'properties':
      return delta.fields.properties?.length ?? 0;
    case 'debts':
      return delta.fields.debts?.length ?? 0;
    case 'accounts':
      return delta.fields.accounts?.length ?? 0;
    case 'investments':
      return delta.fields.investments?.length ?? 0;
    case 'super':
      return delta.fields.superAccounts?.length ?? 0;
    case 'assets':
      return delta.fields.assets?.length ?? 0;
    case 'income-expenses':
      return (
        (delta.fields.incomes?.length ?? 0) +
        (delta.fields.expenses?.length ?? 0)
      );
    default:
      return 0;
  }
}
