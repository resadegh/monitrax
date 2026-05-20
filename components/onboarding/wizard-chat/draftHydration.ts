/**
 * Draft hydration for chat-mode onboarding (Phase 12 Track E).
 *
 * The onboarding wizard has two modes — form (`/onboarding?mode=form`)
 * and chat (`/onboarding?mode=chat`) — and both write to the SAME
 * `UserPreference.onboardingDraft` (`WizardData`) record. The chat's
 * WRITE path (ConversationalSetup.handleConfirm) is already SSOT-
 * correct: it merges each topic's staged slice into the existing
 * draft.
 *
 * The READ path was the gap. Before this module, the chat's eight
 * topic state machines all initialised blank — so a user who entered
 * household members + pets in form mode, then switched to chat, was
 * asked "who shares finances with you?" as if nothing existed.
 *
 * This module is the missing READ layer. For each of the eight chat
 * topics it provides ONE pure function that:
 *   1. maps the relevant `WizardData` slice → that topic's `*Fields`
 *      staged shape (the same shape `advanceScript` consumes), and
 *   2. builds a warm, plain-English acknowledgement sentence listing
 *      what the draft already contains.
 *
 * The acknowledgement copy follows the existing per-script AGENT_COPY
 * style — warm-words rule (CLAUDE.md §14), no emojis, no "AI" framing.
 *
 * AFSL boundary: the acknowledgement is DESCRIPTIVE ONLY ("I can see
 * you've already added X") — never advice, never commentary on the
 * user's financial position. These scripts are extraction-only.
 *
 * Pure module — no React, no Anthropic, no fetch. Symmetry across the
 * eight topics is deliberate (CLAUDE.md §12.8): adding a topic later
 * means duplicating one block here, same as the script files.
 */

import type { WizardData } from '@/components/onboarding/wizard/types';
import type {
  HouseholdFields,
  PropertiesFields,
  DebtsFields,
  AccountsFields,
  SuperFields,
  AssetsFields,
  InvestmentsFields,
  IncomeExpensesFields,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';
import {
  summariseMembers,
  summarisePets,
  summariseCars,
} from './householdScript';
import { summariseSingleProperty } from './propertiesScript';
import { summariseSingleDebt } from './debtsScript';
import { summariseSingleAccount } from './accountsScript';
import { summariseSingleSuper } from './superScript';
import { summariseSingleAsset } from './assetsScript';
import { summariseSingleInvestment } from './investmentsScript';
import {
  summariseSingleIncome,
  summariseSingleExpense,
} from './incomeExpensesScript';

// ============================================================================
// Shared shape — every hydration function returns this.
// ============================================================================

export interface TopicHydration<TFields> {
  /** The topic's staged slice, mapped from the existing draft. */
  staged: TFields;
  /** True if the draft already had anything for this topic. */
  hasExistingData: boolean;
  /** Warm sentence listing what's already there, or null when empty. */
  acknowledgement: string | null;
}

/**
 * Joins a list of phrases into a natural-language run:
 *   ['a']            → 'a'
 *   ['a', 'b']       → 'a and b'
 *   ['a', 'b', 'c']  → 'a, b and c'
 */
function naturalList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ============================================================================
// HOUSEHOLD
// ============================================================================

export function hydrateHouseholdFromDraft(
  draft: Partial<WizardData> | null | undefined,
): TopicHydration<HouseholdFields> {
  const members = draft?.householdMembers ?? [];
  const pets = draft?.householdPets ?? [];
  const cars = draft?.carsCount ?? 0;

  // Members other than the user themselves — the chat asks "who shares
  // finances with you?", so the acknowledgement focuses on co-members.
  const others = members.filter((m) => m.relationship !== 'SELF');

  const staged: HouseholdFields = {};
  if (members.length > 0) {
    staged.householdMembers = members.map((m) => ({
      name: m.name,
      relationship: m.relationship,
      isIncomeEarner: m.isIncomeEarner,
    }));
  }
  if (pets.length > 0) {
    staged.householdPets = pets.map((p) => ({ name: p.name, type: p.type }));
  }
  if (cars > 0) {
    staged.carsCount = cars;
  }

  const hasExistingData = others.length > 0 || pets.length > 0 || cars > 0;
  if (!hasExistingData) {
    return { staged, hasExistingData: false, acknowledgement: null };
  }

  const parts: string[] = [];
  if (others.length > 0) {
    parts.push(`${summariseMembers(staged.householdMembers?.filter((m) => m.relationship !== 'SELF'))} in your household`);
  }
  if (pets.length > 0) {
    const petWord = pets.length === 1 ? 'pet' : 'pets';
    parts.push(`${pets.length} ${petWord} — ${summarisePets(staged.householdPets)}`);
  }
  if (cars > 0) {
    parts.push(summariseCars(cars).toLowerCase());
  }

  const acknowledgement = `I can see you've already added ${naturalList(parts)}. Want to add anyone or anything else, or shall we move on?`;
  return { staged, hasExistingData: true, acknowledgement };
}

// ============================================================================
// PROPERTIES
// ============================================================================

export function hydratePropertiesFromDraft(
  draft: Partial<WizardData> | null | undefined,
): TopicHydration<PropertiesFields> {
  const properties = draft?.properties ?? [];

  if (properties.length === 0) {
    return {
      staged: { properties: [] },
      hasExistingData: false,
      acknowledgement: null,
    };
  }

  const staged: PropertiesFields = {
    ownsProperty: true,
    properties: properties.slice(0, 10).map((p) => ({
      name: p.name,
      type: p.type,
      currentValue: p.currentValue > 0 ? Math.round(p.currentValue) : undefined,
      hasLoan: p.hasLoan,
    })),
  };

  const list = naturalList(staged.properties!.map(summariseSingleProperty));
  const propWord = properties.length === 1 ? 'property' : 'properties';
  const acknowledgement = `I can see you've already added ${properties.length} ${propWord} — ${list}. Want to add another, or shall we move on?`;
  return { staged, hasExistingData: true, acknowledgement };
}

// ============================================================================
// DEBTS
// ============================================================================

export function hydrateDebtsFromDraft(
  draft: Partial<WizardData> | null | undefined,
): TopicHydration<DebtsFields> {
  const debts = draft?.debts ?? [];

  if (debts.length === 0) {
    return {
      staged: { debts: [] },
      hasExistingData: false,
      acknowledgement: null,
    };
  }

  const staged: DebtsFields = {
    hasDebts: true,
    debts: debts.slice(0, 15).map((d) => ({
      name: d.name,
      type: d.type,
      principal: d.principal > 0 ? Math.round(d.principal) : undefined,
      isHecsHelp: d.isHecsHelp ?? d.type === 'STUDENT',
    })),
  };

  const list = naturalList(staged.debts!.map(summariseSingleDebt));
  const debtWord = debts.length === 1 ? 'debt' : 'debts';
  const acknowledgement = `I can see you've already added ${debts.length} ${debtWord} — ${list}. Want to add another, or shall we move on?`;
  return { staged, hasExistingData: true, acknowledgement };
}

// ============================================================================
// ACCOUNTS
// ============================================================================

export function hydrateAccountsFromDraft(
  draft: Partial<WizardData> | null | undefined,
): TopicHydration<AccountsFields> {
  const accounts = draft?.accounts ?? [];

  if (accounts.length === 0) {
    return {
      staged: { accounts: [] },
      hasExistingData: false,
      acknowledgement: null,
    };
  }

  const staged: AccountsFields = {
    hasAccounts: true,
    accounts: accounts.slice(0, 15).map((a) => ({
      name: a.name,
      type: a.type,
      // Balance 0 is a legitimate value here (unlike value fields
      // elsewhere where 0 is a "not set" sentinel) — keep it as-is.
      currentBalance: Math.round(a.currentBalance),
    })),
  };

  const list = naturalList(staged.accounts!.map(summariseSingleAccount));
  const acctWord = accounts.length === 1 ? 'account' : 'accounts';
  const acknowledgement = `I can see you've already added ${accounts.length} ${acctWord} — ${list}. Want to add another, or shall we move on?`;
  return { staged, hasExistingData: true, acknowledgement };
}

// ============================================================================
// SUPER
// ============================================================================

export function hydrateSuperFromDraft(
  draft: Partial<WizardData> | null | undefined,
): TopicHydration<SuperFields> {
  const superAccounts = draft?.superAccounts ?? [];

  if (superAccounts.length === 0) {
    return {
      staged: { superAccounts: [] },
      hasExistingData: false,
      acknowledgement: null,
    };
  }

  const staged: SuperFields = {
    hasSuper: true,
    // The chat super delta carries `fundName` only; WizardData's
    // SuperAccountInput has both `name` + `fundName`. Map from
    // `fundName` (the canonical fund identity) so the recap shows a
    // sensible value.
    superAccounts: superAccounts.slice(0, 10).map((s) => ({
      fundName: s.fundName || s.name,
      currentBalance: s.currentBalance >= 0 ? Math.round(s.currentBalance) : undefined,
    })),
  };

  const list = naturalList(staged.superAccounts!.map(summariseSingleSuper));
  const superWord = superAccounts.length === 1 ? 'super account' : 'super accounts';
  const acknowledgement = `I can see you've already added ${superAccounts.length} ${superWord} — ${list}. Want to add another, or shall we move on?`;
  return { staged, hasExistingData: true, acknowledgement };
}

// ============================================================================
// ASSETS
// ============================================================================

export function hydrateAssetsFromDraft(
  draft: Partial<WizardData> | null | undefined,
): TopicHydration<AssetsFields> {
  const assets = draft?.assets ?? [];

  if (assets.length === 0) {
    return {
      staged: { assets: [] },
      hasExistingData: false,
      acknowledgement: null,
    };
  }

  const staged: AssetsFields = {
    hasAssets: true,
    assets: assets.slice(0, 15).map((a) => ({
      name: a.name,
      type: a.type,
      currentValue: a.currentValue > 0 ? Math.round(a.currentValue) : undefined,
    })),
  };

  const list = naturalList(staged.assets!.map(summariseSingleAsset));
  const assetWord = assets.length === 1 ? 'asset' : 'assets';
  const acknowledgement = `I can see you've already added ${assets.length} personal ${assetWord} — ${list}. Want to add another, or shall we move on?`;
  return { staged, hasExistingData: true, acknowledgement };
}

// ============================================================================
// INVESTMENTS
// ============================================================================

export function hydrateInvestmentsFromDraft(
  draft: Partial<WizardData> | null | undefined,
): TopicHydration<InvestmentsFields> {
  const investments = draft?.investments ?? [];

  if (investments.length === 0) {
    return {
      staged: { investments: [] },
      hasExistingData: false,
      acknowledgement: null,
    };
  }

  // WizardData's InvestmentAccountInput stores value as
  // `cashBalance` + per-holding `holdings`. The chat delta carries a
  // single `totalValue`. Reconstruct totalValue = cashBalance + the
  // sum of (units × averagePrice) across holdings — the inverse of the
  // handoff mapping in ConversationalSetup.handleConfirm.
  const staged: InvestmentsFields = {
    hasInvestments: true,
    investments: investments.slice(0, 10).map((inv) => {
      const holdingsValue = inv.holdings.reduce(
        (sum, h) => sum + h.units * h.averagePrice,
        0,
      );
      const total = inv.cashBalance + holdingsValue;
      return {
        name: inv.name,
        // WizardData allows a SUPERS investment type that the chat
        // schema does not (super has its own topic). Drop it so the
        // delta stays schema-valid; form mode keeps the real type.
        type: inv.type === 'SUPERS' ? undefined : inv.type,
        totalValue: total > 0 ? Math.round(total) : undefined,
      };
    }),
  };

  const list = naturalList(staged.investments!.map(summariseSingleInvestment));
  const invWord = investments.length === 1 ? 'investment' : 'investments';
  const acknowledgement = `I can see you've already added ${investments.length} ${invWord} — ${list}. Want to add another, or shall we move on?`;
  return { staged, hasExistingData: true, acknowledgement };
}

// ============================================================================
// INCOME-EXPENSES (two collections in one topic)
// ============================================================================

export function hydrateIncomeExpensesFromDraft(
  draft: Partial<WizardData> | null | undefined,
): TopicHydration<IncomeExpensesFields> {
  // WizardData calls the income collection `income`; the chat delta
  // calls it `incomes`. Map across the name difference.
  const incomes = draft?.income ?? [];
  const expenses = draft?.expenses ?? [];

  const staged: IncomeExpensesFields = { incomes: [], expenses: [] };
  if (incomes.length > 0) {
    staged.hasIncome = true;
    staged.incomes = incomes.slice(0, 15).map((inc) => ({
      name: inc.name,
      type: inc.type,
      amount: inc.amount > 0 ? Math.round(inc.amount) : undefined,
      frequency: inc.frequency,
      ...(inc.type === 'SALARY' && inc.salaryType
        ? { salaryType: inc.salaryType }
        : {}),
    }));
  }
  if (expenses.length > 0) {
    staged.hasExpenses = true;
    staged.expenses = expenses.slice(0, 30).map((exp) => ({
      name: exp.name,
      category: exp.category,
      amount: exp.amount > 0 ? Math.round(exp.amount) : undefined,
      frequency: exp.frequency,
    }));
  }

  const hasExistingData = incomes.length > 0 || expenses.length > 0;
  if (!hasExistingData) {
    return { staged, hasExistingData: false, acknowledgement: null };
  }

  const parts: string[] = [];
  if (incomes.length > 0) {
    parts.push(`${naturalList(staged.incomes!.map(summariseSingleIncome))} coming in`);
  }
  if (expenses.length > 0) {
    parts.push(`${naturalList(staged.expenses!.map(summariseSingleExpense))} going out`);
  }

  const acknowledgement = `I can see you've already added ${naturalList(parts)}. Want to add anything else, or shall we move on?`;
  return { staged, hasExistingData: true, acknowledgement };
}
