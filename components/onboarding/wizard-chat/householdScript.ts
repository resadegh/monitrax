/**
 * Household-topic conversation script (Phase 12 §E.3).
 *
 * Pure state-machine + copy bank — no React, no Anthropic, no fetch.
 * The orchestrator (ConversationalSetup.tsx) imports `advanceScript`
 * and the agent-copy helpers and drives the chat from there.
 *
 * Why a state machine + scripted copy (not an autonomous agent):
 *   Phase 12 §2 rule #1: the LLM is constrained to extraction only,
 *   never decides what to ask next. This file is what decides.
 *
 * Rules:
 *   - The LLM may extract multiple fields from one user reply
 *     ("me, my partner Sarah, and two kids called Eve and Sam, plus
 *     a dog called Buddy and two cars" → all four fields populated
 *     in one turn). The script collapses to the next un-filled step.
 *   - If a user reply yields NO new fields and lists `general` in
 *     `unresolved`, the script repeats the current step with a
 *     slightly different ask. After two repeats with no progress,
 *     the script moves on (avoid trapping the user in a loop) and
 *     leaves the field un-staged — the recap will show what's
 *     missing, the user can edit on the recap card or in form-mode.
 */

import type { HouseholdFields } from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';
import type {
  HouseholdRelationship,
  HouseholdPetType,
} from '@/components/onboarding/wizard/types';
import {
  EMPTY_HOUSEHOLD_SNAPSHOT,
  snapshotToWizardSlice,
  type HouseholdSnapshot,
} from '@/lib/onboarding/householdSync';
import { hydrateHouseholdFromDraft } from './draftHydration';

export type HouseholdScriptStep =
  | 'INTRO'
  | 'ASKING_MEMBERS'
  | 'ASKING_PETS'
  | 'ASKING_CARS'
  // Hydration entry — the draft already had household data, so the
  // agent acknowledged it and is asking whether to add more or move on.
  | 'REVIEWING_HYDRATED'
  | 'RECAP'
  | 'CHANGING';

export interface HouseholdScriptState {
  step: HouseholdScriptStep;
  staged: HouseholdFields;
  /** How many times we've asked the SAME step without extracting
   *  anything new. Used to break loops — after 2 retries with no
   *  progress, advance regardless. */
  retriesOnCurrentStep: number;
  /**
   * Phase 12 Track F.1: the household as it existed in the REAL tables
   * (`HouseholdProfile` / `HouseholdMember` / `HouseholdPet`) when the
   * topic was bootstrapped. This is the diff baseline `handleConfirm`
   * uses so confirming household writes only the delta — and so
   * re-entering chat + re-confirming with no changes is idempotent (no
   * duplicate rows). Empty for a fresh user with no household.
   */
  realSnapshot: HouseholdSnapshot;
}

export const initialHouseholdScriptState: HouseholdScriptState = {
  step: 'INTRO',
  staged: {},
  retriesOnCurrentStep: 0,
  realSnapshot: EMPTY_HOUSEHOLD_SNAPSHOT,
};

// ============================================================================
// Agent copy — every line the agent ever says, in one place.
// Warm-words rule (CLAUDE.md §14), no emojis, no character framing.
// ============================================================================

export const AGENT_COPY = {
  intro:
    "Hi — let's get a quick picture of your finances. I'll ask a few questions, and you can type or speak your answers. You can switch back to the form anytime.",
  askMembers:
    'First up — who shares finances with you? Just you, you and a partner, or a whole family?',
  askMembersRetry:
    "No worries — could you describe who's in your household? For example: \"just me\", or \"me and my partner Sarah\", or \"me, my partner, and two kids\".",
  askPets: 'Got it. Any pets at home?',
  askPetsRetry:
    "Just to check — any pets? You can say \"no pets\" or list them, like \"a dog called Buddy\".",
  askCars: 'And any cars in the household?',
  askCarsRetry: "Could you tell me how many cars? You can say \"none\" or just a number.",
  recapHeader: 'Quick recap of your household',
  changingPrompt: "What would you like to change?",
  // Hydration path — shown when the draft already had household data.
  // The acknowledgement sentence itself is built per-session in
  // draftHydration.ts; this is the fallback ask if the user's reply to
  // the acknowledgement adds nothing new.
  hydratedMoveOnRetry:
    "No problem — tell me anyone or anything to add, or say \"move on\" and we'll continue.",
} as const;

// ============================================================================
// Recap row formatting (presentation, not state machine).
// ============================================================================

export const RELATIONSHIP_LABELS_SHORT: Record<HouseholdRelationship, string> = {
  SELF: 'You',
  SPOUSE: 'Spouse',
  PARTNER: 'Partner',
  CHILD: 'Child',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  OTHER: 'Other',
};

export const PET_TYPE_LABELS_SHORT: Record<HouseholdPetType, string> = {
  DOG: 'Dog',
  CAT: 'Cat',
  BIRD: 'Bird',
  FISH: 'Fish',
  RABBIT: 'Rabbit',
  REPTILE: 'Reptile',
  OTHER: 'Pet',
};

export function summariseMembers(members: HouseholdFields['householdMembers']): string {
  if (!members || members.length === 0) return '(nobody listed yet)';
  return members
    .map((m) => {
      const label = RELATIONSHIP_LABELS_SHORT[m.relationship];
      const name = m.name.trim();
      // If we have a real name AND it's not just the relationship word,
      // prefer the name. Otherwise show the relationship.
      return name && name.toLowerCase() !== label.toLowerCase()
        ? `${name} (${label})`
        : label;
    })
    .join(', ');
}

export function summarisePets(pets: HouseholdFields['householdPets']): string {
  if (!pets || pets.length === 0) return 'None';
  return pets
    .map((p) => {
      const label = PET_TYPE_LABELS_SHORT[p.type];
      const name = p.name.trim();
      return name && name.toLowerCase() !== label.toLowerCase()
        ? `${name} (${label})`
        : label;
    })
    .join(', ');
}

export function summariseCars(carsCount: HouseholdFields['carsCount']): string {
  if (typeof carsCount !== 'number') return '(not set)';
  if (carsCount === 0) return 'None';
  if (carsCount === 1) return '1 car';
  return `${carsCount} cars`;
}

// ============================================================================
// State-machine logic
// ============================================================================

const MAX_RETRIES_PER_STEP = 2;

interface AdvanceInput {
  state: HouseholdScriptState;
  /** Fresh fields extracted from the latest user reply. */
  newFields: HouseholdFields;
  /** Whether the LLM listed `general` in `unresolved` — i.e. it
   *  couldn't extract anything useful from the user's message. */
  llmCouldNotExtract: boolean;
}

interface AdvanceOutput {
  state: HouseholdScriptState;
  /** What the agent says next. `null` means "no agent message — show
   *  the recap card instead". */
  agentNextMessage: string | null;
  /** Whether the agent should render the recap card now. */
  showRecap: boolean;
}

/** The inner state machine reasons only about the step/staged/retries
 *  triple — `realSnapshot` is carried by the public `advanceScript`. */
interface AdvanceOutputInner {
  state: Omit<HouseholdScriptState, 'realSnapshot'>;
  agentNextMessage: string | null;
  showRecap: boolean;
}

/**
 * Public entry point. Runs the pure state-machine (`advanceScriptInner`)
 * and then carries the immutable `realSnapshot` baseline (Phase 12 Track
 * F.1 diff baseline) through onto the returned state — the inner machine
 * only reasons about `step` / `staged` / `retriesOnCurrentStep`.
 */
export function advanceScript(input: AdvanceInput): AdvanceOutput {
  const out = advanceScriptInner(input);
  return {
    ...out,
    state: { ...out.state, realSnapshot: input.state.realSnapshot },
  };
}

function advanceScriptInner({ state, newFields, llmCouldNotExtract }: AdvanceInput): AdvanceOutputInner {
  // Merge: new fields overwrite if present, otherwise keep staged.
  const merged: HouseholdFields = {
    householdMembers: newFields.householdMembers ?? state.staged.householdMembers,
    householdPets: newFields.householdPets ?? state.staged.householdPets,
    carsCount: newFields.carsCount ?? state.staged.carsCount,
  };
  const extractedAnything =
    newFields.householdMembers !== undefined ||
    newFields.householdPets !== undefined ||
    newFields.carsCount !== undefined;

  const retriesIfSameStep =
    !extractedAnything && llmCouldNotExtract
      ? state.retriesOnCurrentStep + 1
      : 0;
  const forceAdvance = retriesIfSameStep > MAX_RETRIES_PER_STEP;

  switch (state.step) {
    case 'REVIEWING_HYDRATED': {
      // The draft already had household data and the agent acknowledged
      // it. The user's reply either adds more (continue the normal
      // member→pets→cars flow from wherever data is still missing) or
      // signals "move on" (→ recap).
      if (extractedAnything) {
        // User added something — fall through to the normal flow by
        // re-entering the machine at the first un-filled step.
        if (!merged.householdMembers || merged.householdMembers.length === 0) {
          return {
            state: { step: 'ASKING_MEMBERS', staged: merged, retriesOnCurrentStep: 0 },
            agentNextMessage: AGENT_COPY.askMembersRetry,
            showRecap: false,
          };
        }
        if (merged.householdPets === undefined) {
          return {
            state: { step: 'ASKING_PETS', staged: merged, retriesOnCurrentStep: 0 },
            agentNextMessage: AGENT_COPY.askPets,
            showRecap: false,
          };
        }
        if (typeof merged.carsCount !== 'number') {
          return {
            state: { step: 'ASKING_CARS', staged: merged, retriesOnCurrentStep: 0 },
            agentNextMessage: AGENT_COPY.askCars,
            showRecap: false,
          };
        }
        // Everything filled — go straight to recap.
        return {
          state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
          agentNextMessage: null,
          showRecap: true,
        };
      }
      // No new data — treat as "move on" once the LLM is confident
      // (or after retries) and otherwise re-ask gently.
      if (llmCouldNotExtract && !forceAdvance) {
        return {
          state: {
            step: 'REVIEWING_HYDRATED',
            staged: merged,
            retriesOnCurrentStep: retriesIfSameStep,
          },
          agentNextMessage: AGENT_COPY.hydratedMoveOnRetry,
          showRecap: false,
        };
      }
      return {
        state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
        agentNextMessage: null,
        showRecap: true,
      };
    }
    case 'INTRO':
    case 'ASKING_MEMBERS': {
      if ((merged.householdMembers && merged.householdMembers.length > 0) || forceAdvance) {
        return {
          state: { step: 'ASKING_PETS', staged: merged, retriesOnCurrentStep: 0 },
          agentNextMessage: AGENT_COPY.askPets,
          showRecap: false,
        };
      }
      return {
        state: { step: 'ASKING_MEMBERS', staged: merged, retriesOnCurrentStep: retriesIfSameStep },
        agentNextMessage: AGENT_COPY.askMembersRetry,
        showRecap: false,
      };
    }
    case 'ASKING_PETS': {
      // "No pets" is a valid answer — the LLM emits an empty array,
      // which we treat as "set the field to []" (sentinel = explicit none).
      // We rely on `extractedAnything` (above) to detect this — if
      // the LLM returned `householdPets: []`, that counts as extracted.
      if (merged.householdPets !== undefined || forceAdvance) {
        return {
          state: { step: 'ASKING_CARS', staged: merged, retriesOnCurrentStep: 0 },
          agentNextMessage: AGENT_COPY.askCars,
          showRecap: false,
        };
      }
      return {
        state: { step: 'ASKING_PETS', staged: merged, retriesOnCurrentStep: retriesIfSameStep },
        agentNextMessage: AGENT_COPY.askPetsRetry,
        showRecap: false,
      };
    }
    case 'ASKING_CARS': {
      if (typeof merged.carsCount === 'number' || forceAdvance) {
        return {
          state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
          agentNextMessage: null,
          showRecap: true,
        };
      }
      return {
        state: { step: 'ASKING_CARS', staged: merged, retriesOnCurrentStep: retriesIfSameStep },
        agentNextMessage: AGENT_COPY.askCarsRetry,
        showRecap: false,
      };
    }
    case 'CHANGING': {
      // User asked to change something — we accept the diff + re-render
      // a fresh recap. The orchestrator dims the prior recap (§4a.5).
      return {
        state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
        agentNextMessage: null,
        showRecap: true,
      };
    }
    case 'RECAP': {
      // Once we're showing the recap, an inbound message is treated as
      // a "change" instruction. The orchestrator should have already
      // flipped state.step to 'CHANGING' before re-calling this; but
      // defensively, just absorb the new fields.
      return {
        state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
        agentNextMessage: null,
        showRecap: true,
      };
    }
  }
}

/**
 * First-message bootstrap — returns the agent's intro + first ask
 * paired together as a single message. Called once on mount.
 *
 * Phase 12 Track F.1: the household topic now reads the REAL household
 * tables (not the draft blob). `snapshot` is the real-table household
 * (`readHousehold()` result) — it becomes the diff baseline carried on
 * `nextState.realSnapshot` so confirming writes only the delta and
 * re-entry is idempotent.
 *
 * When the real tables already contain household data, the agent
 * acknowledges what's there and asks whether to add more or move on —
 * instead of asking from scratch. When empty (genuinely new user),
 * behaviour is byte-for-byte unchanged. The acknowledgement copy is
 * unchanged — it just reads from the real tables now (design doc §3.5).
 */
export function bootstrapHouseholdConversation(
  snapshot?: HouseholdSnapshot | null,
): {
  agentMessages: string[];
  nextState: HouseholdScriptState;
} {
  const realSnapshot = snapshot ?? EMPTY_HOUSEHOLD_SNAPSHOT;
  // Reuse the existing acknowledgement builder by feeding it the
  // real-table snapshot in the draft-shaped slice it already understands.
  // `hydrateHouseholdFromDraft` is pure copy/mapping — it does not care
  // whether the data came from the draft blob or the real tables.
  const hydration = hydrateHouseholdFromDraft(snapshotToWizardSlice(realSnapshot));
  if (hydration.hasExistingData && hydration.acknowledgement) {
    return {
      agentMessages: [AGENT_COPY.intro, hydration.acknowledgement],
      nextState: {
        step: 'REVIEWING_HYDRATED',
        staged: hydration.staged,
        retriesOnCurrentStep: 0,
        realSnapshot,
      },
    };
  }
  return {
    agentMessages: [AGENT_COPY.intro, AGENT_COPY.askMembers],
    nextState: {
      step: 'ASKING_MEMBERS',
      staged: {},
      retriesOnCurrentStep: 0,
      realSnapshot,
    },
  };
}
