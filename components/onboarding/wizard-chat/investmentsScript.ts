/**
 * Investments-topic conversation script (Phase 12 §E.3, seventh chat topic).
 *
 * Pure state machine + copy bank — no React, no Anthropic, no fetch.
 *
 * What we capture per investment account:
 *   - name       — free text (e.g. "CommSec", "Vanguard ETFs")
 *   - type       — BROKERAGE / FUND / TRUST / ETF_CRYPTO
 *   - totalValue — single integer AUD
 *
 * Scope: NON-SUPER listed investments only. Super → Super topic.
 * Property → Properties. Bank/cash → Accounts. Personal assets → Assets.
 *
 * Deferred to form mode:
 *   - per-holding ticker / units / averagePrice / type
 *   - platform field (separate from name)
 *   - acquisitionDate (Phase 41E CGT discount + indexation)
 *
 * State-machine shape mirrors `assetsScript.ts`.
 */

import type {
  InvestmentsFields,
  InvestmentDelta,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';

export type InvestmentsScriptStep =
  | 'INTRO'
  | 'ASKING_OWNERSHIP'
  | 'ASKING_INVESTMENT_TYPE'
  | 'ASKING_INVESTMENT_VALUE'
  | 'ASKING_MORE'
  | 'RECAP'
  | 'CHANGING';

export interface InvestmentsScriptState {
  step: InvestmentsScriptStep;
  staged: InvestmentsFields;
  retriesOnCurrentStep: number;
}

export const initialInvestmentsScriptState: InvestmentsScriptState = {
  step: 'INTRO',
  staged: { investments: [] },
  retriesOnCurrentStep: 0,
};

const MAX_RETRIES_PER_STEP = 2;

// ============================================================================
// Agent copy
// ============================================================================

export const INVESTMENTS_AGENT_COPY = {
  intro:
    "Now investments — apart from super, do you have any shares, ETFs, managed funds, or crypto? Something like CommSec, Vanguard, Pearler, Stake, Coinbase?",
  introRetry:
    'Quick yes or no — any investments outside of super? Shares, ETFs, managed funds, crypto?',
  askType: (name: string) =>
    `For ${quote(name)} — is that a brokerage account, a managed fund, an investment trust, or an ETF / crypto holding?`,
  askValue: (name: string) =>
    `Roughly what's the total value of ${quote(name)} today? A ballpark is fine.`,
  askMore: 'Any other investments, or is that everything?',
  askMoreRetry: 'Just to confirm — anything else, or are those all your investments?',
  recapHeader: 'Quick recap of your investments',
  recapNoInvestments: "Just to confirm — no investments outside super. We'll skip ahead.",
  changingPrompt: "What would you like to change?",
} as const;

function quote(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'that one';
  return `"${trimmed}"`;
}

// ============================================================================
// Recap formatting
// ============================================================================

const INVESTMENT_TYPE_LABEL: Record<NonNullable<InvestmentDelta['type']>, string> = {
  BROKERAGE: 'Brokerage',
  FUND: 'Managed fund',
  TRUST: 'Trust',
  ETF_CRYPTO: 'ETF / Crypto',
};

export function formatInvestmentValue(v: number | undefined): string {
  if (typeof v !== 'number') return '(not set)';
  return v.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

export function summariseSingleInvestment(i: InvestmentDelta): string {
  const typeLabel = i.type ? INVESTMENT_TYPE_LABEL[i.type] : 'Investment';
  const valuePart =
    i.totalValue !== undefined ? ` — ${formatInvestmentValue(i.totalValue)}` : '';
  return `${i.name.trim()} (${typeLabel})${valuePart}`;
}

export function summariseInvestments(fields: InvestmentsFields): string {
  if (fields.hasInvestments === false) return 'No investments outside super';
  if (!fields.investments || fields.investments.length === 0) return '(nothing yet)';
  return fields.investments.map(summariseSingleInvestment).join('; ');
}

// ============================================================================
// State-machine logic
// ============================================================================

function firstIncompleteIndex(investments: InvestmentDelta[]): number {
  for (let i = 0; i < investments.length; i++) {
    const inv = investments[i];
    if (inv.type === undefined || inv.totalValue === undefined) return i;
  }
  return -1;
}

function nextMissingField(i: InvestmentDelta): 'type' | 'value' | null {
  if (i.type === undefined) return 'type';
  if (i.totalValue === undefined) return 'value';
  return null;
}

interface AdvanceInput {
  state: InvestmentsScriptState;
  newFields: InvestmentsFields;
  llmCouldNotExtract: boolean;
}

interface AdvanceOutput {
  state: InvestmentsScriptState;
  agentNextMessage: string | null;
  showRecap: boolean;
}

function mergeStaged(
  staged: InvestmentsFields,
  incoming: InvestmentsFields,
): InvestmentsFields {
  return {
    hasInvestments:
      incoming.hasInvestments !== undefined ? incoming.hasInvestments : staged.hasInvestments,
    investments:
      incoming.investments !== undefined
        ? incoming.investments.slice(0, 10)
        : staged.investments,
  };
}

export function advanceInvestmentsScript({
  state,
  newFields,
  llmCouldNotExtract,
}: AdvanceInput): AdvanceOutput {
  const merged = mergeStaged(state.staged, newFields);
  const hasInvestments = merged.hasInvestments;
  const investments = merged.investments ?? [];

  const extractedAnything =
    newFields.hasInvestments !== undefined || newFields.investments !== undefined;
  const retriesIfSameStep =
    !extractedAnything && llmCouldNotExtract
      ? state.retriesOnCurrentStep + 1
      : 0;
  const forceAdvance = retriesIfSameStep > MAX_RETRIES_PER_STEP;

  if (hasInvestments === false) {
    return {
      state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
      agentNextMessage: null,
      showRecap: true,
    };
  }

  if (hasInvestments === undefined) {
    if (forceAdvance) {
      return {
        state: {
          step: 'RECAP',
          staged: { ...merged, hasInvestments: false, investments: [] },
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
      agentNextMessage: INVESTMENTS_AGENT_COPY.introRetry,
      showRecap: false,
    };
  }

  if (investments.length === 0) {
    return {
      state: {
        step: 'ASKING_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage:
        "Tell me about your first one — for example, \"CommSec, about 50k\" or \"Vanguard ETFs, around 120k\".",
      showRecap: false,
    };
  }

  const incompleteIdx = firstIncompleteIndex(investments);
  if (incompleteIdx === -1) {
    if (state.step === 'ASKING_MORE' && newFields.investments === undefined) {
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
      agentNextMessage: INVESTMENTS_AGENT_COPY.askMore,
      showRecap: false,
    };
  }

  const target = investments[incompleteIdx];
  const missing = nextMissingField(target);

  if (forceAdvance && missing) {
    const patched = [...investments];
    if (missing === 'type') patched[incompleteIdx] = { ...target, type: 'BROKERAGE' };
    if (missing === 'value') patched[incompleteIdx] = { ...target, totalValue: 0 };
    return advanceInvestmentsScript({
      state: {
        step: state.step,
        staged: { ...merged, investments: patched },
        retriesOnCurrentStep: 0,
      },
      newFields: {},
      llmCouldNotExtract: false,
    });
  }

  if (missing === 'type') {
    return {
      state: {
        step: 'ASKING_INVESTMENT_TYPE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: INVESTMENTS_AGENT_COPY.askType(target.name),
      showRecap: false,
    };
  }
  if (missing === 'value') {
    return {
      state: {
        step: 'ASKING_INVESTMENT_VALUE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: INVESTMENTS_AGENT_COPY.askValue(target.name),
      showRecap: false,
    };
  }

  return {
    state: { step: 'ASKING_MORE', staged: merged, retriesOnCurrentStep: 0 },
    agentNextMessage: INVESTMENTS_AGENT_COPY.askMore,
    showRecap: false,
  };
}

export function bootstrapInvestmentsConversation(): {
  agentMessages: string[];
  nextState: InvestmentsScriptState;
} {
  return {
    agentMessages: [INVESTMENTS_AGENT_COPY.intro],
    nextState: {
      step: 'ASKING_OWNERSHIP',
      staged: { investments: [] },
      retriesOnCurrentStep: 0,
    },
  };
}
