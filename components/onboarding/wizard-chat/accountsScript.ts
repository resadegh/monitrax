/**
 * Accounts-topic conversation script (Phase 12 §E.3, fourth chat topic).
 *
 * What we capture per account:
 *   - name, type (OFFSET/SAVINGS/TRANSACTIONAL/CREDIT_CARD), currentBalance
 *
 * Credit card sign convention: balance is SIGNED. Negative = debt
 * owed to the issuer (user says "I owe $2k" → -2000). The system
 * prompt instructs the LLM to emit credit-card debt as negative.
 *
 * Deferred to form mode:
 *   - institution, interestRate, linkedLoanId (offset wiring), source
 *     (defaults to MANUAL for chat-entered accounts).
 *
 * State machine: same shape as Debts.
 */

import type {
  AccountsFields,
  AccountDelta,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';

export type AccountsScriptStep =
  | 'INTRO'
  | 'ASKING_OWNERSHIP'
  | 'ASKING_ACCOUNT_TYPE'
  | 'ASKING_ACCOUNT_BALANCE'
  | 'ASKING_MORE'
  | 'RECAP'
  | 'CHANGING';

export interface AccountsScriptState {
  step: AccountsScriptStep;
  staged: AccountsFields;
  retriesOnCurrentStep: number;
}

export const initialAccountsScriptState: AccountsScriptState = {
  step: 'INTRO',
  staged: { accounts: [] },
  retriesOnCurrentStep: 0,
};

const MAX_RETRIES_PER_STEP = 2;

// ============================================================================
// Agent copy
// ============================================================================

export const ACCOUNTS_AGENT_COPY = {
  intro:
    "Let's add your bank accounts — your everyday transaction account, savings, any offset, plus credit cards if you have them.",
  introRetry:
    'Quick yes or no — do you have any bank accounts you\'d like to add now? (You can always add them later.)',
  askType: (name: string) =>
    `For ${quote(name)} — is that a transaction account, savings account, offset, or credit card?`,
  askBalance: (name: string, type?: AccountDelta['type']) =>
    type === 'CREDIT_CARD'
      ? `Roughly how much is owing on ${quote(name)} right now?`
      : `Roughly how much is in ${quote(name)} right now? A ballpark is fine.`,
  askMore: 'Any other accounts, or is that all of them?',
  askMoreRetry: 'Just to confirm — anything else, or are those all your accounts?',
  recapHeader: 'Quick recap of your accounts',
  recapNoAccounts: "Just to confirm — no accounts to add now. We'll skip ahead.",
  changingPrompt: "What would you like to change?",
} as const;

function quote(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'that account';
  return `"${trimmed}"`;
}

// ============================================================================
// Recap formatting
// ============================================================================

const ACCOUNT_TYPE_LABEL: Record<NonNullable<AccountDelta['type']>, string> = {
  OFFSET: 'Offset',
  SAVINGS: 'Savings',
  TRANSACTIONAL: 'Transactional',
  CREDIT_CARD: 'Credit card',
};

export function formatAccountBalance(v: number | undefined, type?: AccountDelta['type']): string {
  if (typeof v !== 'number') return '(not set)';
  const formatted = Math.abs(v).toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
  // Credit-card debt is signed negative; render with "owing" word so
  // the user reads the sign correctly.
  if (type === 'CREDIT_CARD' && v < 0) return `${formatted} owing`;
  return formatted;
}

export function summariseSingleAccount(a: AccountDelta): string {
  const typeLabel = a.type ? ACCOUNT_TYPE_LABEL[a.type] : 'Account';
  const balPart =
    a.currentBalance !== undefined
      ? ` — ${formatAccountBalance(a.currentBalance, a.type)}`
      : '';
  return `${a.name.trim()} (${typeLabel})${balPart}`;
}

export function summariseAccounts(fields: AccountsFields): string {
  if (fields.hasAccounts === false) return 'No accounts';
  if (!fields.accounts || fields.accounts.length === 0) return '(nothing yet)';
  return fields.accounts.map(summariseSingleAccount).join('; ');
}

// ============================================================================
// State-machine logic
// ============================================================================

function firstIncompleteIndex(accounts: AccountDelta[]): number {
  for (let i = 0; i < accounts.length; i++) {
    const a = accounts[i];
    if (a.type === undefined || a.currentBalance === undefined) {
      return i;
    }
  }
  return -1;
}

function nextMissingField(a: AccountDelta): 'type' | 'balance' | null {
  if (a.type === undefined) return 'type';
  if (a.currentBalance === undefined) return 'balance';
  return null;
}

interface AdvanceInput {
  state: AccountsScriptState;
  newFields: AccountsFields;
  llmCouldNotExtract: boolean;
}

interface AdvanceOutput {
  state: AccountsScriptState;
  agentNextMessage: string | null;
  showRecap: boolean;
}

function mergeStaged(staged: AccountsFields, incoming: AccountsFields): AccountsFields {
  return {
    hasAccounts:
      incoming.hasAccounts !== undefined ? incoming.hasAccounts : staged.hasAccounts,
    accounts:
      incoming.accounts !== undefined
        ? incoming.accounts.slice(0, 15)
        : staged.accounts,
  };
}

export function advanceAccountsScript({
  state,
  newFields,
  llmCouldNotExtract,
}: AdvanceInput): AdvanceOutput {
  const merged = mergeStaged(state.staged, newFields);
  const hasAccounts = merged.hasAccounts;
  const accounts = merged.accounts ?? [];

  const extractedAnything =
    newFields.hasAccounts !== undefined || newFields.accounts !== undefined;
  const retriesIfSameStep =
    !extractedAnything && llmCouldNotExtract
      ? state.retriesOnCurrentStep + 1
      : 0;
  const forceAdvance = retriesIfSameStep > MAX_RETRIES_PER_STEP;

  if (hasAccounts === false) {
    return {
      state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
      agentNextMessage: null,
      showRecap: true,
    };
  }

  if (hasAccounts === undefined) {
    if (forceAdvance) {
      return {
        state: {
          step: 'RECAP',
          staged: { ...merged, hasAccounts: false, accounts: [] },
          retriesOnCurrentStep: 0,
        },
        agentNextMessage: null,
        showRecap: true,
      };
    }
    return {
      state: {
        step: 'ASKING_OWNERSHIP',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: ACCOUNTS_AGENT_COPY.introRetry,
      showRecap: false,
    };
  }

  if (accounts.length === 0) {
    return {
      state: {
        step: 'ASKING_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage:
        "Tell me about your first account — something like \"CommBank everyday, about $3k in it\" or \"ING savings, around 25k\".",
      showRecap: false,
    };
  }

  const incompleteIdx = firstIncompleteIndex(accounts);
  if (incompleteIdx === -1) {
    if (state.step === 'ASKING_MORE' && newFields.accounts === undefined) {
      return {
        state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
        agentNextMessage: null,
        showRecap: true,
      };
    }
    return {
      state: {
        step: 'ASKING_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: ACCOUNTS_AGENT_COPY.askMore,
      showRecap: false,
    };
  }

  const target = accounts[incompleteIdx];
  const missing = nextMissingField(target);

  if (forceAdvance && missing) {
    const patched = [...accounts];
    if (missing === 'type') patched[incompleteIdx] = { ...target, type: 'TRANSACTIONAL' };
    if (missing === 'balance') patched[incompleteIdx] = { ...target, currentBalance: 0 };
    return advanceAccountsScript({
      state: {
        step: state.step,
        staged: { ...merged, accounts: patched },
        retriesOnCurrentStep: 0,
      },
      newFields: {},
      llmCouldNotExtract: false,
    });
  }

  if (missing === 'type') {
    return {
      state: {
        step: 'ASKING_ACCOUNT_TYPE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: ACCOUNTS_AGENT_COPY.askType(target.name),
      showRecap: false,
    };
  }
  if (missing === 'balance') {
    return {
      state: {
        step: 'ASKING_ACCOUNT_BALANCE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: ACCOUNTS_AGENT_COPY.askBalance(target.name, target.type),
      showRecap: false,
    };
  }

  return {
    state: { step: 'ASKING_MORE', staged: merged, retriesOnCurrentStep: 0 },
    agentNextMessage: ACCOUNTS_AGENT_COPY.askMore,
    showRecap: false,
  };
}

export function bootstrapAccountsConversation(): {
  agentMessages: string[];
  nextState: AccountsScriptState;
} {
  return {
    agentMessages: [ACCOUNTS_AGENT_COPY.intro],
    nextState: {
      step: 'ASKING_OWNERSHIP',
      staged: { accounts: [] },
      retriesOnCurrentStep: 0,
    },
  };
}
