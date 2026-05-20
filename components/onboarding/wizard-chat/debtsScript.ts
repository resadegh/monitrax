/**
 * Debts-topic conversation script (Phase 12 §E.3, third chat topic).
 *
 * Pure state machine + copy bank — no React, no Anthropic, no fetch.
 *
 * What we capture per debt (the bare-minimum useful handoff):
 *   - name, type (CAR/PERSONAL/STUDENT/BUSINESS), principal, isHecsHelp
 *
 * Out of scope (deferred to form mode):
 *   - interestRateAnnual, minRepayment, repaymentFrequency — most
 *     users don't know these without checking a statement; the form
 *     has the precision (number input + frequency picker).
 *   - lender, termMonthsRemaining, linkedAssetId.
 *
 * Scope boundary (CRITICAL):
 *   - Property mortgages live on the Properties topic (the chat
 *     captures the hasLoan flag there; loan details land in the form).
 *   - Credit card balances live on the Accounts topic (NEXT topic).
 *     The Debts system prompt explicitly redirects credit-card mentions.
 *
 * State machine: same shape as Properties.
 */

import type {
  DebtsFields,
  DebtDelta,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';
import type { WizardData } from '@/components/onboarding/wizard/types';
import { hydrateDebtsFromDraft } from './draftHydration';

export type DebtsScriptStep =
  | 'INTRO'
  | 'ASKING_OWNERSHIP'
  | 'ASKING_DEBT_TYPE'
  | 'ASKING_DEBT_PRINCIPAL'
  | 'ASKING_MORE'
  // Hydration entry — the draft already had debts, so the agent
  // acknowledged them and is asking whether to add more or move on.
  | 'REVIEWING_HYDRATED'
  | 'RECAP'
  | 'CHANGING';

export interface DebtsScriptState {
  step: DebtsScriptStep;
  staged: DebtsFields;
  retriesOnCurrentStep: number;
}

export const initialDebtsScriptState: DebtsScriptState = {
  step: 'INTRO',
  staged: { debts: [] },
  retriesOnCurrentStep: 0,
};

const MAX_RETRIES_PER_STEP = 2;

// ============================================================================
// Agent copy
// ============================================================================

export const DEBTS_AGENT_COPY = {
  intro:
    "Now let's talk about other debts — things like a car loan, student loan, personal loan or business loan. (We've already covered any home or investment mortgage in Properties; credit cards come next.)",
  introRetry:
    "Just a yes or no — do you have any non-mortgage debts? Car finance, HECS / HELP, personal loans, business loans?",
  askType: (name: string) =>
    `For ${quote(name)} — is that a car loan, student loan, personal loan, or business loan?`,
  askPrincipal: (name: string) =>
    `Roughly how much is still owing on ${quote(name)}? A ballpark is fine.`,
  askMore: 'Any other debts, or is that everything?',
  askMoreRetry: 'Just to confirm — anything else, or are those all your debts?',
  recapHeader: 'Quick recap of your debts',
  recapNoDebts: "Just to confirm — no other debts beyond what we've already covered. We'll skip ahead.",
  changingPrompt: "What would you like to change?",
} as const;

function quote(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'that debt';
  const lower = trimmed.toLowerCase();
  if (lower === 'hecs' || lower === 'help' || lower === 'hecs/help') return 'your HECS';
  return `"${trimmed}"`;
}

// ============================================================================
// Recap formatting
// ============================================================================

const DEBT_TYPE_LABEL: Record<NonNullable<DebtDelta['type']>, string> = {
  CAR: 'Car loan',
  PERSONAL: 'Personal loan',
  STUDENT: 'Student loan',
  BUSINESS: 'Business loan',
};

export function formatDebtPrincipal(v: number | undefined): string {
  if (typeof v !== 'number') return '(not set)';
  return v.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

export function summariseSingleDebt(d: DebtDelta): string {
  const typeLabel = d.type ? DEBT_TYPE_LABEL[d.type] : 'Debt';
  const principalPart = d.principal !== undefined ? ` — ${formatDebtPrincipal(d.principal)} owing` : '';
  const hecsTag = d.isHecsHelp === true ? ' (HECS/HELP)' : '';
  return `${d.name.trim()} (${typeLabel})${hecsTag}${principalPart}`;
}

export function summariseDebts(fields: DebtsFields): string {
  if (fields.hasDebts === false) return 'No debts';
  if (!fields.debts || fields.debts.length === 0) return '(nothing yet)';
  return fields.debts.map(summariseSingleDebt).join('; ');
}

// ============================================================================
// State-machine logic
// ============================================================================

function firstIncompleteIndex(debts: DebtDelta[]): number {
  for (let i = 0; i < debts.length; i++) {
    const d = debts[i];
    if (d.type === undefined || d.principal === undefined) {
      return i;
    }
  }
  return -1;
}

function nextMissingField(d: DebtDelta): 'type' | 'principal' | null {
  if (d.type === undefined) return 'type';
  if (d.principal === undefined) return 'principal';
  return null;
}

interface AdvanceInput {
  state: DebtsScriptState;
  newFields: DebtsFields;
  llmCouldNotExtract: boolean;
}

interface AdvanceOutput {
  state: DebtsScriptState;
  agentNextMessage: string | null;
  showRecap: boolean;
}

function mergeStaged(staged: DebtsFields, incoming: DebtsFields): DebtsFields {
  return {
    hasDebts: incoming.hasDebts !== undefined ? incoming.hasDebts : staged.hasDebts,
    debts:
      incoming.debts !== undefined
        ? incoming.debts.slice(0, 15)
        : staged.debts,
  };
}

export function advanceDebtsScript({
  state,
  newFields,
  llmCouldNotExtract,
}: AdvanceInput): AdvanceOutput {
  const merged = mergeStaged(state.staged, newFields);
  const hasDebts = merged.hasDebts;
  const debts = merged.debts ?? [];

  const extractedAnything =
    newFields.hasDebts !== undefined || newFields.debts !== undefined;
  const retriesIfSameStep =
    !extractedAnything && llmCouldNotExtract
      ? state.retriesOnCurrentStep + 1
      : 0;
  const forceAdvance = retriesIfSameStep > MAX_RETRIES_PER_STEP;

  if (hasDebts === false) {
    return {
      state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
      agentNextMessage: null,
      showRecap: true,
    };
  }

  if (hasDebts === undefined) {
    if (forceAdvance) {
      return {
        state: {
          step: 'RECAP',
          staged: { ...merged, hasDebts: false, debts: [] },
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
      agentNextMessage: DEBTS_AGENT_COPY.introRetry,
      showRecap: false,
    };
  }

  if (debts.length === 0) {
    return {
      state: {
        step: 'ASKING_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage:
        "Tell me a bit about your first debt — for example, \"car loan around $15k\" or \"HECS, about 30k\".",
      showRecap: false,
    };
  }

  const incompleteIdx = firstIncompleteIndex(debts);
  if (incompleteIdx === -1) {
    if (
      (state.step === 'ASKING_MORE' || state.step === 'REVIEWING_HYDRATED') &&
      newFields.debts === undefined
    ) {
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
      agentNextMessage: DEBTS_AGENT_COPY.askMore,
      showRecap: false,
    };
  }

  const target = debts[incompleteIdx];
  const missing = nextMissingField(target);

  if (forceAdvance && missing) {
    const patched = [...debts];
    if (missing === 'type') patched[incompleteIdx] = { ...target, type: 'PERSONAL' };
    if (missing === 'principal') patched[incompleteIdx] = { ...target, principal: 0 };
    return advanceDebtsScript({
      state: {
        step: state.step,
        staged: { ...merged, debts: patched },
        retriesOnCurrentStep: 0,
      },
      newFields: {},
      llmCouldNotExtract: false,
    });
  }

  if (missing === 'type') {
    return {
      state: {
        step: 'ASKING_DEBT_TYPE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: DEBTS_AGENT_COPY.askType(target.name),
      showRecap: false,
    };
  }
  if (missing === 'principal') {
    return {
      state: {
        step: 'ASKING_DEBT_PRINCIPAL',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: DEBTS_AGENT_COPY.askPrincipal(target.name),
      showRecap: false,
    };
  }

  return {
    state: { step: 'ASKING_MORE', staged: merged, retriesOnCurrentStep: 0 },
    agentNextMessage: DEBTS_AGENT_COPY.askMore,
    showRecap: false,
  };
}

/**
 * First-message bootstrap for the Debts topic.
 *
 * When `draft` already contains debts (entered in form mode), the
 * agent acknowledges them and asks whether to add more or move on.
 * When the draft is empty, behaviour is byte-for-byte unchanged.
 */
export function bootstrapDebtsConversation(
  draft?: Partial<WizardData> | null,
): {
  agentMessages: string[];
  nextState: DebtsScriptState;
} {
  const hydration = hydrateDebtsFromDraft(draft);
  if (hydration.hasExistingData && hydration.acknowledgement) {
    return {
      agentMessages: [hydration.acknowledgement],
      nextState: {
        step: 'REVIEWING_HYDRATED',
        staged: hydration.staged,
        retriesOnCurrentStep: 0,
      },
    };
  }
  return {
    agentMessages: [DEBTS_AGENT_COPY.intro],
    nextState: {
      step: 'ASKING_OWNERSHIP',
      staged: { debts: [] },
      retriesOnCurrentStep: 0,
    },
  };
}
