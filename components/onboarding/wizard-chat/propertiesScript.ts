/**
 * Properties-topic conversation script (Phase 12 §E.3, expanded
 * for multi-property capture).
 *
 * Pure state machine + copy bank — no React, no Anthropic, no fetch.
 * The orchestrator (ConversationalSetup.tsx) imports `advanceScript`
 * + the agent-copy helpers + the recap formatters.
 *
 * What we capture (the bare-minimum useful handoff to form mode):
 *   - per-property: name, type (HOME/INVESTMENT), currentValue, hasLoan
 *   - sentinel: ownsProperty (false = skip to recap)
 *
 * What we DON'T capture (deferred to form mode):
 *   - address, loan details, rental income, expenses, purchase date,
 *     acquisition contract date, isNewBuild — the form is better at
 *     date pickers, dollar precision, and Phase 41E reform context.
 *
 * State machine:
 *   - INTRO            → ask the user "Now let's talk about property — do you own any?"
 *   - ASKING_OWNERSHIP → wait for yes/no; if no, jump to RECAP
 *   - ASKING_PROPERTY_TYPE / VALUE / LOAN → fill in missing fields on
 *     the next-incomplete property, one field at a time, in this order
 *   - ASKING_MORE      → "Any other properties, or are these all of them?"
 *   - RECAP            → recap card
 *   - CHANGING         → mistake-recovery diff input
 */

import type {
  PropertiesFields,
  PropertyDelta,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';
import type { WizardData } from '@/components/onboarding/wizard/types';
import { hydratePropertiesFromDraft } from './draftHydration';

export type PropertiesScriptStep =
  | 'INTRO'
  | 'ASKING_OWNERSHIP'
  | 'ASKING_PROPERTY_TYPE'
  | 'ASKING_PROPERTY_VALUE'
  | 'ASKING_PROPERTY_LOAN'
  | 'ASKING_MORE'
  // Hydration entry — the draft already had properties, so the agent
  // acknowledged them and is asking whether to add more or move on.
  // Behaves like ASKING_MORE once the user replies.
  | 'REVIEWING_HYDRATED'
  | 'RECAP'
  | 'CHANGING';

export interface PropertiesScriptState {
  step: PropertiesScriptStep;
  staged: PropertiesFields;
  /** Loop-break protection — bumped when we ask the same step without
   *  progress; after MAX_RETRIES we advance anyway and leave the field
   *  unstaged (the recap will show what's missing). */
  retriesOnCurrentStep: number;
}

export const initialPropertiesScriptState: PropertiesScriptState = {
  step: 'INTRO',
  staged: { properties: [] },
  retriesOnCurrentStep: 0,
};

const MAX_RETRIES_PER_STEP = 2;

// ============================================================================
// Agent copy
// ============================================================================

export const PROPERTIES_AGENT_COPY = {
  intro: "Now let's talk about property. Do you own any — your home, or an investment?",
  introRetry:
    'A quick yes or no on property: do you own any property at all? You can say "no" if you rent or don\'t own anything yet.',
  askType: (name: string) =>
    `Got it — for ${quote(name)}, is that your home (where you live) or an investment property?`,
  askValue: (name: string) =>
    `About how much is ${quote(name)} worth today? A ballpark is fine.`,
  askLoan: (name: string) => `Is there a mortgage on ${quote(name)}?`,
  askMore: 'Any other properties, or is that all of them?',
  askMoreRetry: 'Just to confirm — anything else, or are those all your properties?',
  recapHeader: 'Quick recap of your properties',
  recapNoProperty: 'Just to confirm — you don\'t own any property right now. We\'ll skip this step.',
  changingPrompt: "What would you like to change?",
} as const;

function quote(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'that property';
  // Lowercase common nouns; quote multi-word names; pass-through proper-ish names.
  const lower = trimmed.toLowerCase();
  if (lower === 'home' || lower === 'house' || lower === 'place') return `your ${lower}`;
  return `"${trimmed}"`;
}

// ============================================================================
// Recap formatting
// ============================================================================

export function formatPropertyValue(v: number | undefined): string {
  if (typeof v !== 'number') return '(not set)';
  return v.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

export function summariseSingleProperty(p: PropertyDelta): string {
  const parts: string[] = [];
  if (p.type === 'HOME') parts.push('home');
  else if (p.type === 'INVESTMENT') parts.push('investment');
  else parts.push('property');
  if (p.currentValue !== undefined) {
    parts.push(`worth ${formatPropertyValue(p.currentValue)}`);
  }
  if (p.hasLoan === true) parts.push('with a mortgage');
  else if (p.hasLoan === false) parts.push('no mortgage');
  return `${p.name.trim()} — ${parts.join(', ')}`;
}

export function summariseProperties(fields: PropertiesFields): string {
  if (fields.ownsProperty === false) return 'No property';
  if (!fields.properties || fields.properties.length === 0) return '(nothing yet)';
  return fields.properties.map(summariseSingleProperty).join('; ');
}

// ============================================================================
// State-machine logic
// ============================================================================

/**
 * Returns the index of the first property missing any of type / value /
 * hasLoan, or -1 if all staged properties are complete.
 */
function firstIncompleteIndex(properties: PropertyDelta[]): number {
  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    if (
      p.type === undefined ||
      p.currentValue === undefined ||
      p.hasLoan === undefined
    ) {
      return i;
    }
  }
  return -1;
}

/**
 * Returns the next field to ask about for a partial property (type
 * first, then value, then hasLoan).
 */
function nextMissingField(p: PropertyDelta): 'type' | 'value' | 'loan' | null {
  if (p.type === undefined) return 'type';
  if (p.currentValue === undefined) return 'value';
  if (p.hasLoan === undefined) return 'loan';
  return null;
}

interface AdvanceInput {
  state: PropertiesScriptState;
  newFields: PropertiesFields;
  /** Whether the LLM listed `general` in `unresolved` — could not
   *  extract anything from the user's message. */
  llmCouldNotExtract: boolean;
}

interface AdvanceOutput {
  state: PropertiesScriptState;
  /** What the agent says next. `null` means "show the recap card now". */
  agentNextMessage: string | null;
  showRecap: boolean;
}

/**
 * Merge new fields into staged. For the `properties` array, the LLM
 * is instructed to ECHO ALL STAGED + NEW so its emission already
 * represents the merged state — we trust it as the new state (capped
 * at 10 properties).
 */
function mergeStaged(
  staged: PropertiesFields,
  incoming: PropertiesFields,
): PropertiesFields {
  return {
    ownsProperty:
      incoming.ownsProperty !== undefined ? incoming.ownsProperty : staged.ownsProperty,
    properties:
      incoming.properties !== undefined
        ? incoming.properties.slice(0, 10)
        : staged.properties,
  };
}

export function advancePropertiesScript({
  state,
  newFields,
  llmCouldNotExtract,
}: AdvanceInput): AdvanceOutput {
  const merged = mergeStaged(state.staged, newFields);
  const ownership = merged.ownsProperty;
  const properties = merged.properties ?? [];

  const extractedAnything =
    newFields.ownsProperty !== undefined || newFields.properties !== undefined;
  const retriesIfSameStep =
    !extractedAnything && llmCouldNotExtract
      ? state.retriesOnCurrentStep + 1
      : 0;
  const forceAdvance = retriesIfSameStep > MAX_RETRIES_PER_STEP;

  // No property at all — straight to recap.
  if (ownership === false) {
    return {
      state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
      agentNextMessage: null,
      showRecap: true,
    };
  }

  // Haven't established ownership yet.
  if (ownership === undefined) {
    if (forceAdvance) {
      // User won't clarify — assume they own property and we'll let them
      // edit in form mode if wrong.
      return {
        state: {
          step: 'ASKING_PROPERTY_TYPE',
          staged: { ...merged, ownsProperty: true },
          retriesOnCurrentStep: 0,
        },
        agentNextMessage: PROPERTIES_AGENT_COPY.askMore,
        showRecap: false,
      };
    }
    return {
      state: {
        step: 'ASKING_OWNERSHIP',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: PROPERTIES_AGENT_COPY.introRetry,
      showRecap: false,
    };
  }

  // ownership === true here — proceed through property details.
  if (properties.length === 0) {
    // User confirmed ownership but didn't list any. Ask for the first.
    return {
      state: {
        step: 'ASKING_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage:
        'Great — could you tell me a bit about your first property? Just a quick description like "my home worth around 850k with a mortgage".',
      showRecap: false,
    };
  }

  // Find next incomplete property.
  const incompleteIdx = firstIncompleteIndex(properties);
  if (incompleteIdx === -1) {
    // All staged properties complete. Ask if there are more, OR advance
    // to recap if the user already signaled "no more" (i.e. they're now
    // in ASKING_MORE / REVIEWING_HYDRATED step + the latest reply didn't
    // add a property).
    if (
      (state.step === 'ASKING_MORE' || state.step === 'REVIEWING_HYDRATED') &&
      newFields.properties === undefined
    ) {
      // User answered "no more" or equivalent → recap.
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
      agentNextMessage: PROPERTIES_AGENT_COPY.askMore,
      showRecap: false,
    };
  }

  // Have an incomplete property — ask for its next missing field.
  const target = properties[incompleteIdx];
  const missing = nextMissingField(target);
  if (forceAdvance && missing) {
    // Skip the missing field — the recap will show "(not set)" and
    // the user can fix in form mode.
    const patched = [...properties];
    if (missing === 'type') patched[incompleteIdx] = { ...target, type: 'HOME' };
    if (missing === 'value')
      patched[incompleteIdx] = { ...target, currentValue: 0 };
    if (missing === 'loan')
      patched[incompleteIdx] = { ...target, hasLoan: false };
    return advancePropertiesScript({
      state: {
        step: state.step,
        staged: { ...merged, properties: patched },
        retriesOnCurrentStep: 0,
      },
      newFields: {},
      llmCouldNotExtract: false,
    });
  }

  if (missing === 'type') {
    return {
      state: {
        step: 'ASKING_PROPERTY_TYPE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: PROPERTIES_AGENT_COPY.askType(target.name),
      showRecap: false,
    };
  }
  if (missing === 'value') {
    return {
      state: {
        step: 'ASKING_PROPERTY_VALUE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: PROPERTIES_AGENT_COPY.askValue(target.name),
      showRecap: false,
    };
  }
  if (missing === 'loan') {
    return {
      state: {
        step: 'ASKING_PROPERTY_LOAN',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: PROPERTIES_AGENT_COPY.askLoan(target.name),
      showRecap: false,
    };
  }

  // Unreachable — all fields complete already handled above.
  return {
    state: { step: 'ASKING_MORE', staged: merged, retriesOnCurrentStep: 0 },
    agentNextMessage: PROPERTIES_AGENT_COPY.askMore,
    showRecap: false,
  };
}

/**
 * First-message bootstrap — returns the agent's intro for the
 * Properties topic. Called once when the orchestrator transitions
 * from Household → Properties.
 *
 * When `draft` already contains properties (entered in form mode),
 * the agent acknowledges them and asks whether to add more or move on.
 * When the draft is empty, behaviour is byte-for-byte unchanged.
 */
export function bootstrapPropertiesConversation(
  draft?: Partial<WizardData> | null,
): {
  agentMessages: string[];
  nextState: PropertiesScriptState;
} {
  const hydration = hydratePropertiesFromDraft(draft);
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
    agentMessages: [PROPERTIES_AGENT_COPY.intro],
    nextState: {
      step: 'ASKING_OWNERSHIP',
      staged: { properties: [] },
      retriesOnCurrentStep: 0,
    },
  };
}
