/**
 * Super-topic conversation script (Phase 12 §E.3, fifth chat topic).
 *
 * Pure state machine + copy bank — no React, no Anthropic, no fetch.
 *
 * What we capture per super account:
 *   - fundName       — e.g. "AustralianSuper", "Hostplus", "REST"
 *   - currentBalance — integer AUD
 *
 * Deferred to form mode:
 *   - investment option / risk profile
 *   - employer / member / salary-sacrifice contributions
 *   - SMSF-specific fields (member list, trust deed, fund ABN)
 *
 * State-machine shape mirrors `propertiesScript.ts` / `debtsScript.ts` /
 * `accountsScript.ts`. Adding a topic costs about this much code now.
 */

import type {
  SuperFields,
  SuperDelta,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';

export type SuperScriptStep =
  | 'INTRO'
  | 'ASKING_OWNERSHIP'
  | 'ASKING_BALANCE'
  | 'ASKING_MORE'
  | 'RECAP'
  | 'CHANGING';

export interface SuperScriptState {
  step: SuperScriptStep;
  staged: SuperFields;
  retriesOnCurrentStep: number;
}

export const initialSuperScriptState: SuperScriptState = {
  step: 'INTRO',
  staged: { superAccounts: [] },
  retriesOnCurrentStep: 0,
};

const MAX_RETRIES_PER_STEP = 2;

// ============================================================================
// Agent copy
// ============================================================================

export const SUPER_AGENT_COPY = {
  intro:
    "Now let's add your superannuation. Which fund(s) are you with — like AustralianSuper, Hostplus, REST, or a self-managed fund? Roughly how much is in each?",
  introRetry:
    'Just a quick check — do you have any super accounts you can tell me about? Even just the fund name is a good start.',
  askBalance: (fundName: string) =>
    `Roughly how much is in your ${quote(fundName)} right now? A ballpark is fine.`,
  askMore: 'Any other super accounts, or is that everything?',
  askMoreRetry: 'Just to confirm — anything else, or is that all your super?',
  recapHeader: 'Quick recap of your super',
  recapNoSuper: "Just to confirm — no super to add right now. We'll skip ahead.",
  changingPrompt: "What would you like to change?",
} as const;

function quote(fundName: string): string {
  const trimmed = fundName.trim();
  if (!trimmed) return 'super';
  return `"${trimmed}"`;
}

// ============================================================================
// Recap formatting
// ============================================================================

export function formatSuperBalance(v: number | undefined): string {
  if (typeof v !== 'number') return '(not set)';
  return v.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

export function summariseSingleSuper(s: SuperDelta): string {
  const balPart =
    s.currentBalance !== undefined ? ` — ${formatSuperBalance(s.currentBalance)}` : '';
  return `${s.fundName.trim()}${balPart}`;
}

export function summariseSuper(fields: SuperFields): string {
  if (fields.hasSuper === false) return 'No super';
  if (!fields.superAccounts || fields.superAccounts.length === 0) return '(nothing yet)';
  return fields.superAccounts.map(summariseSingleSuper).join('; ');
}

// ============================================================================
// State-machine logic
// ============================================================================

function firstIncompleteIndex(accounts: SuperDelta[]): number {
  for (let i = 0; i < accounts.length; i++) {
    if (accounts[i].currentBalance === undefined) return i;
  }
  return -1;
}

interface AdvanceInput {
  state: SuperScriptState;
  newFields: SuperFields;
  llmCouldNotExtract: boolean;
}

interface AdvanceOutput {
  state: SuperScriptState;
  agentNextMessage: string | null;
  showRecap: boolean;
}

function mergeStaged(staged: SuperFields, incoming: SuperFields): SuperFields {
  return {
    hasSuper: incoming.hasSuper !== undefined ? incoming.hasSuper : staged.hasSuper,
    superAccounts:
      incoming.superAccounts !== undefined
        ? incoming.superAccounts.slice(0, 10)
        : staged.superAccounts,
  };
}

export function advanceSuperScript({
  state,
  newFields,
  llmCouldNotExtract,
}: AdvanceInput): AdvanceOutput {
  const merged = mergeStaged(state.staged, newFields);
  const hasSuper = merged.hasSuper;
  const accounts = merged.superAccounts ?? [];

  const extractedAnything =
    newFields.hasSuper !== undefined || newFields.superAccounts !== undefined;
  const retriesIfSameStep =
    !extractedAnything && llmCouldNotExtract
      ? state.retriesOnCurrentStep + 1
      : 0;
  const forceAdvance = retriesIfSameStep > MAX_RETRIES_PER_STEP;

  if (hasSuper === false) {
    return {
      state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
      agentNextMessage: null,
      showRecap: true,
    };
  }

  if (hasSuper === undefined) {
    if (forceAdvance) {
      return {
        state: {
          step: 'RECAP',
          staged: { ...merged, hasSuper: false, superAccounts: [] },
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
      agentNextMessage: SUPER_AGENT_COPY.introRetry,
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
        "Got it — which fund? You can say something like \"AustralianSuper, around $80k\" or just the fund name.",
      showRecap: false,
    };
  }

  const incompleteIdx = firstIncompleteIndex(accounts);
  if (incompleteIdx === -1) {
    if (state.step === 'ASKING_MORE' && newFields.superAccounts === undefined) {
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
      agentNextMessage: SUPER_AGENT_COPY.askMore,
      showRecap: false,
    };
  }

  const target = accounts[incompleteIdx];
  if (forceAdvance) {
    const patched = [...accounts];
    patched[incompleteIdx] = { ...target, currentBalance: 0 };
    return advanceSuperScript({
      state: {
        step: state.step,
        staged: { ...merged, superAccounts: patched },
        retriesOnCurrentStep: 0,
      },
      newFields: {},
      llmCouldNotExtract: false,
    });
  }

  return {
    state: {
      step: 'ASKING_BALANCE',
      staged: merged,
      retriesOnCurrentStep: retriesIfSameStep,
    },
    agentNextMessage: SUPER_AGENT_COPY.askBalance(target.fundName),
    showRecap: false,
  };
}

export function bootstrapSuperConversation(): {
  agentMessages: string[];
  nextState: SuperScriptState;
} {
  return {
    agentMessages: [SUPER_AGENT_COPY.intro],
    nextState: {
      step: 'ASKING_OWNERSHIP',
      staged: { superAccounts: [] },
      retriesOnCurrentStep: 0,
    },
  };
}
