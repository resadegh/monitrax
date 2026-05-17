/**
 * Income-Expenses topic conversation script (Phase 12 §E.3, eighth +
 * FINAL chat topic). Two collections in one topic + two-phase state
 * machine:
 *
 *   Phase 1: INCOMES  — INTRO → ASKING_INCOME_OWNERSHIP → per-incomplete
 *                       income TYPE → AMOUNT → FREQUENCY → SALARY_TYPE
 *                       (SALARY only) → ASKING_INCOME_MORE
 *   Phase 2: EXPENSES — TRANSITIONING → ASKING_EXPENSE_OWNERSHIP →
 *                       per-incomplete expense CATEGORY → AMOUNT →
 *                       FREQUENCY → ASKING_EXPENSE_MORE
 *   RECAP             — single recap card with both sections
 *
 * The LLM may extract BOTH incomes and expenses in a single user reply
 * (positional-merge). The state machine's job is to ask the right
 * follow-up question for missing fields in the active sub-collection.
 *
 * Defaults applied on handoff (chat → WizardData):
 *   - Income.salaryType: GROSS (when type=SALARY and chat didn't get it)
 *   - Income.frequency: ANNUAL (when missing — covered by force-advance)
 *   - Expense.frequency: MONTHLY (when missing — covered by force-advance)
 *   - Expense.category: OTHER (when missing — covered by force-advance)
 */

import type {
  IncomeExpensesFields,
  IncomeDelta,
  ExpenseDelta,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';

export type IncomeExpensesScriptStep =
  | 'INTRO'
  // Phase 1 — incomes
  | 'ASKING_INCOME_OWNERSHIP'
  | 'ASKING_INCOME_TYPE'
  | 'ASKING_INCOME_AMOUNT'
  | 'ASKING_INCOME_FREQUENCY'
  | 'ASKING_INCOME_MORE'
  // Phase 2 — expenses
  | 'TRANSITIONING_TO_EXPENSES'
  | 'ASKING_EXPENSE_OWNERSHIP'
  | 'ASKING_EXPENSE_CATEGORY'
  | 'ASKING_EXPENSE_AMOUNT'
  | 'ASKING_EXPENSE_FREQUENCY'
  | 'ASKING_EXPENSE_MORE'
  // Terminal
  | 'RECAP'
  | 'CHANGING';

export interface IncomeExpensesScriptState {
  step: IncomeExpensesScriptStep;
  staged: IncomeExpensesFields;
  retriesOnCurrentStep: number;
}

export const initialIncomeExpensesScriptState: IncomeExpensesScriptState = {
  step: 'INTRO',
  staged: { incomes: [], expenses: [] },
  retriesOnCurrentStep: 0,
};

const MAX_RETRIES_PER_STEP = 2;

// ============================================================================
// Agent copy
// ============================================================================

export const INCOME_EXPENSES_AGENT_COPY = {
  intro:
    "Last topic — let's cover income and regular expenses. First up, your income: what's coming in? Salary, rental income, dividends, side hustles?",
  introRetry:
    'Quick check — what income do you receive? Salary, rental income, side hustle, or government payments? Or say no if nothing regular.',

  askIncomeType: (name: string) =>
    `For ${quote(name)} — is that salary, rental income, investment income (dividends/interest), or something else?`,
  askIncomeAmount: (name: string) =>
    `How much do you receive from ${quote(name)}? A figure plus how often (weekly, fortnightly, monthly, annual) is great.`,
  askIncomeFrequency: (name: string, amount?: number) =>
    `For ${quote(name)}${amount !== undefined ? ` (${formatAud(amount)})` : ''} — is that weekly, fortnightly, monthly, quarterly, or annual?`,

  askIncomeMore: 'Any other income to add, or is that everything?',

  transitioning: 'Got your income. Now your regular expenses — things like rent, groceries, utilities, subscriptions. What do you spend regularly?',
  transitioningRetry:
    'Just a quick check — any regular expenses to list? Or say no and we\'ll wrap up.',

  askExpenseCategory: (name: string) =>
    `For ${quote(name)} — what category does that fit best? Housing, rent, utilities, groceries, transport, subscriptions, health, education, or something else?`,
  askExpenseAmount: (name: string) =>
    `How much does ${quote(name)} cost? A figure plus frequency (weekly / fortnightly / monthly / annual) is ideal.`,
  askExpenseFrequency: (name: string, amount?: number) =>
    `For ${quote(name)}${amount !== undefined ? ` (${formatAud(amount)})` : ''} — is that weekly, fortnightly, monthly, quarterly, or annual?`,

  askExpenseMore: 'Any other regular expenses, or are those all of them?',

  recapHeader: 'Quick recap of your cashflow',
  recapNoIncome: "Just to confirm — no regular income to record. We'll skip ahead.",
  recapNoExpenses: "Just to confirm — no regular expenses to record. We'll wrap up.",

  changingPrompt: "What would you like to change?",
} as const;

function quote(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'that one';
  const lower = trimmed.toLowerCase();
  if (lower === 'salary' || lower === 'wages') return `your ${lower}`;
  return `"${trimmed}"`;
}

function formatAud(v: number): string {
  return v.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

// ============================================================================
// Recap formatting
// ============================================================================

const INCOME_TYPE_LABEL: Record<NonNullable<IncomeDelta['type']>, string> = {
  SALARY: 'Salary',
  RENT: 'Rental income',
  RENTAL: 'Rental income',
  INVESTMENT: 'Investment income',
  OTHER: 'Other income',
};

const FREQUENCY_LABEL: Record<NonNullable<IncomeDelta['frequency']>, string> = {
  WEEKLY: '/week',
  FORTNIGHTLY: '/fortnight',
  MONTHLY: '/month',
  QUARTERLY: '/quarter',
  ANNUAL: '/year',
};

const EXPENSE_CATEGORY_LABEL: Record<NonNullable<ExpenseDelta['category']>, string> = {
  HOUSING: 'Housing',
  RENT: 'Rent',
  RATES: 'Council rates',
  INSURANCE: 'Insurance',
  MAINTENANCE: 'Maintenance',
  PERSONAL: 'Personal',
  UTILITIES: 'Utilities',
  FOOD: 'Food & dining',
  GROCERIES: 'Groceries',
  TRANSPORT: 'Transport',
  ENTERTAINMENT: 'Entertainment',
  SUBSCRIPTION: 'Subscriptions',
  STRATA: 'Strata',
  LAND_TAX: 'Land tax',
  LOAN_INTEREST: 'Loan interest',
  REGISTRATION: 'Registration',
  MODIFICATIONS: 'Modifications',
  HEALTH: 'Health',
  EDUCATION: 'Education',
  OTHER: 'Other',
};

export function summariseSingleIncome(i: IncomeDelta): string {
  const typeLabel = i.type ? INCOME_TYPE_LABEL[i.type] : 'Income';
  const amountPart =
    i.amount !== undefined ? ` — ${formatAud(i.amount)}${i.frequency ? FREQUENCY_LABEL[i.frequency] : ''}` : '';
  const salaryTag =
    i.type === 'SALARY' && i.salaryType ? ` (${i.salaryType.toLowerCase()})` : '';
  return `${i.name.trim()} (${typeLabel})${salaryTag}${amountPart}`;
}

export function summariseSingleExpense(e: ExpenseDelta): string {
  const catLabel = e.category ? EXPENSE_CATEGORY_LABEL[e.category] : 'Expense';
  const amountPart =
    e.amount !== undefined ? ` — ${formatAud(e.amount)}${e.frequency ? FREQUENCY_LABEL[e.frequency] : ''}` : '';
  return `${e.name.trim()} (${catLabel})${amountPart}`;
}

// ============================================================================
// State-machine logic
// ============================================================================

function firstIncompleteIncomeIndex(incomes: IncomeDelta[]): number {
  for (let i = 0; i < incomes.length; i++) {
    const inc = incomes[i];
    if (inc.type === undefined || inc.amount === undefined || inc.frequency === undefined) {
      return i;
    }
  }
  return -1;
}

function nextMissingIncomeField(i: IncomeDelta): 'type' | 'amount' | 'frequency' | null {
  if (i.type === undefined) return 'type';
  if (i.amount === undefined) return 'amount';
  if (i.frequency === undefined) return 'frequency';
  return null;
}

function firstIncompleteExpenseIndex(expenses: ExpenseDelta[]): number {
  for (let i = 0; i < expenses.length; i++) {
    const exp = expenses[i];
    if (exp.category === undefined || exp.amount === undefined || exp.frequency === undefined) {
      return i;
    }
  }
  return -1;
}

function nextMissingExpenseField(
  e: ExpenseDelta,
): 'category' | 'amount' | 'frequency' | null {
  if (e.category === undefined) return 'category';
  if (e.amount === undefined) return 'amount';
  if (e.frequency === undefined) return 'frequency';
  return null;
}

interface AdvanceInput {
  state: IncomeExpensesScriptState;
  newFields: IncomeExpensesFields;
  llmCouldNotExtract: boolean;
}

interface AdvanceOutput {
  state: IncomeExpensesScriptState;
  agentNextMessage: string | null;
  showRecap: boolean;
}

function mergeStaged(
  staged: IncomeExpensesFields,
  incoming: IncomeExpensesFields,
): IncomeExpensesFields {
  return {
    hasIncome: incoming.hasIncome !== undefined ? incoming.hasIncome : staged.hasIncome,
    incomes:
      incoming.incomes !== undefined ? incoming.incomes.slice(0, 15) : staged.incomes,
    hasExpenses:
      incoming.hasExpenses !== undefined ? incoming.hasExpenses : staged.hasExpenses,
    expenses:
      incoming.expenses !== undefined ? incoming.expenses.slice(0, 30) : staged.expenses,
  };
}

function isInIncomePhase(step: IncomeExpensesScriptStep): boolean {
  return (
    step === 'INTRO' ||
    step === 'ASKING_INCOME_OWNERSHIP' ||
    step === 'ASKING_INCOME_TYPE' ||
    step === 'ASKING_INCOME_AMOUNT' ||
    step === 'ASKING_INCOME_FREQUENCY' ||
    step === 'ASKING_INCOME_MORE'
  );
}

export function advanceIncomeExpensesScript({
  state,
  newFields,
  llmCouldNotExtract,
}: AdvanceInput): AdvanceOutput {
  const merged = mergeStaged(state.staged, newFields);
  const inIncomePhase = isInIncomePhase(state.step);

  const extractedAnything =
    newFields.hasIncome !== undefined ||
    newFields.incomes !== undefined ||
    newFields.hasExpenses !== undefined ||
    newFields.expenses !== undefined;
  const retriesIfSameStep =
    !extractedAnything && llmCouldNotExtract
      ? state.retriesOnCurrentStep + 1
      : 0;
  const forceAdvance = retriesIfSameStep > MAX_RETRIES_PER_STEP;

  if (inIncomePhase) {
    return advanceIncomePhase(merged, state, forceAdvance, retriesIfSameStep, newFields);
  }
  return advanceExpensePhase(merged, state, forceAdvance, retriesIfSameStep, newFields);
}

function advanceIncomePhase(
  merged: IncomeExpensesFields,
  state: IncomeExpensesScriptState,
  forceAdvance: boolean,
  retriesIfSameStep: number,
  newFields: IncomeExpensesFields,
): AdvanceOutput {
  const hasIncome = merged.hasIncome;
  const incomes = merged.incomes ?? [];

  // Sentinel: no income → transition to expenses.
  if (hasIncome === false) {
    return {
      state: {
        step: 'ASKING_EXPENSE_OWNERSHIP',
        staged: merged,
        retriesOnCurrentStep: 0,
      },
      agentNextMessage: INCOME_EXPENSES_AGENT_COPY.transitioning,
      showRecap: false,
    };
  }

  if (hasIncome === undefined) {
    if (forceAdvance) {
      // Could not establish income presence — assume none, move on.
      return {
        state: {
          step: 'ASKING_EXPENSE_OWNERSHIP',
          staged: { ...merged, hasIncome: false, incomes: [] },
          retriesOnCurrentStep: 0,
        },
        agentNextMessage: INCOME_EXPENSES_AGENT_COPY.transitioning,
        showRecap: false,
      };
    }
    return {
      state: {
        step: 'ASKING_INCOME_OWNERSHIP',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: INCOME_EXPENSES_AGENT_COPY.introRetry,
      showRecap: false,
    };
  }

  // hasIncome === true
  if (incomes.length === 0) {
    return {
      state: {
        step: 'ASKING_INCOME_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage:
        "Got it — tell me about your first one. Something like \"salary 80k a year\" or \"rental 600 a week\".",
      showRecap: false,
    };
  }

  const incompleteIdx = firstIncompleteIncomeIndex(incomes);
  if (incompleteIdx === -1) {
    // All staged incomes complete — ask if more, or move to expenses.
    if (state.step === 'ASKING_INCOME_MORE' && newFields.incomes === undefined) {
      // User said "no more" → move to expenses phase.
      return {
        state: {
          step: 'ASKING_EXPENSE_OWNERSHIP',
          staged: merged,
          retriesOnCurrentStep: 0,
        },
        agentNextMessage: INCOME_EXPENSES_AGENT_COPY.transitioning,
        showRecap: false,
      };
    }
    return {
      state: {
        step: 'ASKING_INCOME_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: INCOME_EXPENSES_AGENT_COPY.askIncomeMore,
      showRecap: false,
    };
  }

  const target = incomes[incompleteIdx];
  const missing = nextMissingIncomeField(target);

  if (forceAdvance && missing) {
    const patched = [...incomes];
    if (missing === 'type') patched[incompleteIdx] = { ...target, type: 'OTHER' };
    if (missing === 'amount') patched[incompleteIdx] = { ...target, amount: 0 };
    if (missing === 'frequency') patched[incompleteIdx] = { ...target, frequency: 'ANNUAL' };
    return advanceIncomeExpensesScript({
      state: {
        step: state.step,
        staged: { ...merged, incomes: patched },
        retriesOnCurrentStep: 0,
      },
      newFields: {},
      llmCouldNotExtract: false,
    });
  }

  const messageByField: Record<'type' | 'amount' | 'frequency', { step: IncomeExpensesScriptStep; msg: string }> = {
    type: {
      step: 'ASKING_INCOME_TYPE',
      msg: INCOME_EXPENSES_AGENT_COPY.askIncomeType(target.name),
    },
    amount: {
      step: 'ASKING_INCOME_AMOUNT',
      msg: INCOME_EXPENSES_AGENT_COPY.askIncomeAmount(target.name),
    },
    frequency: {
      step: 'ASKING_INCOME_FREQUENCY',
      msg: INCOME_EXPENSES_AGENT_COPY.askIncomeFrequency(target.name, target.amount),
    },
  };

  const choice = missing ? messageByField[missing] : null;
  return {
    state: {
      step: choice?.step ?? 'ASKING_INCOME_MORE',
      staged: merged,
      retriesOnCurrentStep: retriesIfSameStep,
    },
    agentNextMessage: choice?.msg ?? INCOME_EXPENSES_AGENT_COPY.askIncomeMore,
    showRecap: false,
  };
}

function advanceExpensePhase(
  merged: IncomeExpensesFields,
  state: IncomeExpensesScriptState,
  forceAdvance: boolean,
  retriesIfSameStep: number,
  newFields: IncomeExpensesFields,
): AdvanceOutput {
  const hasExpenses = merged.hasExpenses;
  const expenses = merged.expenses ?? [];

  if (hasExpenses === false) {
    return {
      state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
      agentNextMessage: null,
      showRecap: true,
    };
  }

  if (hasExpenses === undefined) {
    if (forceAdvance) {
      return {
        state: {
          step: 'RECAP',
          staged: { ...merged, hasExpenses: false, expenses: [] },
          retriesOnCurrentStep: 0,
        },
        agentNextMessage: null,
        showRecap: true,
      };
    }
    return {
      state: {
        step: 'ASKING_EXPENSE_OWNERSHIP',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: INCOME_EXPENSES_AGENT_COPY.transitioningRetry,
      showRecap: false,
    };
  }

  // hasExpenses === true
  if (expenses.length === 0) {
    return {
      state: {
        step: 'ASKING_EXPENSE_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage:
        "Tell me about your first regular expense — for example, \"rent 600 a week\" or \"groceries 250 a week\".",
      showRecap: false,
    };
  }

  const incompleteIdx = firstIncompleteExpenseIndex(expenses);
  if (incompleteIdx === -1) {
    if (state.step === 'ASKING_EXPENSE_MORE' && newFields.expenses === undefined) {
      return {
        state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
        agentNextMessage: null,
        showRecap: true,
      };
    }
    return {
      state: {
        step: 'ASKING_EXPENSE_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: INCOME_EXPENSES_AGENT_COPY.askExpenseMore,
      showRecap: false,
    };
  }

  const target = expenses[incompleteIdx];
  const missing = nextMissingExpenseField(target);

  if (forceAdvance && missing) {
    const patched = [...expenses];
    if (missing === 'category') patched[incompleteIdx] = { ...target, category: 'OTHER' };
    if (missing === 'amount') patched[incompleteIdx] = { ...target, amount: 0 };
    if (missing === 'frequency') patched[incompleteIdx] = { ...target, frequency: 'MONTHLY' };
    return advanceIncomeExpensesScript({
      state: {
        step: state.step,
        staged: { ...merged, expenses: patched },
        retriesOnCurrentStep: 0,
      },
      newFields: {},
      llmCouldNotExtract: false,
    });
  }

  const messageByField: Record<'category' | 'amount' | 'frequency', { step: IncomeExpensesScriptStep; msg: string }> = {
    category: {
      step: 'ASKING_EXPENSE_CATEGORY',
      msg: INCOME_EXPENSES_AGENT_COPY.askExpenseCategory(target.name),
    },
    amount: {
      step: 'ASKING_EXPENSE_AMOUNT',
      msg: INCOME_EXPENSES_AGENT_COPY.askExpenseAmount(target.name),
    },
    frequency: {
      step: 'ASKING_EXPENSE_FREQUENCY',
      msg: INCOME_EXPENSES_AGENT_COPY.askExpenseFrequency(target.name, target.amount),
    },
  };

  const choice = missing ? messageByField[missing] : null;
  return {
    state: {
      step: choice?.step ?? 'ASKING_EXPENSE_MORE',
      staged: merged,
      retriesOnCurrentStep: retriesIfSameStep,
    },
    agentNextMessage: choice?.msg ?? INCOME_EXPENSES_AGENT_COPY.askExpenseMore,
    showRecap: false,
  };
}

export function bootstrapIncomeExpensesConversation(): {
  agentMessages: string[];
  nextState: IncomeExpensesScriptState;
} {
  return {
    agentMessages: [INCOME_EXPENSES_AGENT_COPY.intro],
    nextState: {
      step: 'ASKING_INCOME_OWNERSHIP',
      staged: { incomes: [], expenses: [] },
      retriesOnCurrentStep: 0,
    },
  };
}
