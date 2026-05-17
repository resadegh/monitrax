/**
 * Assets-topic conversation script (Phase 12 §E.3, sixth chat topic).
 *
 * Pure state machine + copy bank — no React, no Anthropic, no fetch.
 *
 * What we capture per asset:
 *   - name           — free text (e.g. "car", "iPhone", "guitar")
 *   - type           — VEHICLE / ELECTRONICS / FURNITURE / EQUIPMENT /
 *                      COLLECTIBLE / OTHER
 *   - currentValue   — integer AUD
 *
 * Scope: PERSONAL assets only — vehicles, electronics, collectibles.
 * NOT property (Properties topic), bank accounts (Accounts), super
 * (Super), or listed investments (Investments — future topic).
 *
 * Deferred to form mode:
 *   - purchasePrice (defaults to currentValue on bulk-create)
 *   - purchaseDate, description
 *   - expenses (defaults to [])
 *   - vehicle-specific fields (make / model / year)
 */

import type {
  AssetsFields,
  AssetDelta,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';

export type AssetsScriptStep =
  | 'INTRO'
  | 'ASKING_OWNERSHIP'
  | 'ASKING_ASSET_TYPE'
  | 'ASKING_ASSET_VALUE'
  | 'ASKING_MORE'
  | 'RECAP'
  | 'CHANGING';

export interface AssetsScriptState {
  step: AssetsScriptStep;
  staged: AssetsFields;
  retriesOnCurrentStep: number;
}

export const initialAssetsScriptState: AssetsScriptState = {
  step: 'INTRO',
  staged: { assets: [] },
  retriesOnCurrentStep: 0,
};

const MAX_RETRIES_PER_STEP = 2;

// ============================================================================
// Agent copy
// ============================================================================

export const ASSETS_AGENT_COPY = {
  intro:
    "Last big bucket — any personal assets worth noting? Things like a car, electronics, jewellery, collectibles. (We've already covered property, bank accounts and super.)",
  introRetry:
    "Just a quick check — anything personal you'd like to add? Could be a car, a watch, instruments, electronics. Say no and we'll skip it.",
  askType: (name: string) =>
    `For ${quote(name)} — is that a vehicle, electronics, furniture, equipment, or something collectible?`,
  askValue: (name: string) =>
    `Roughly how much is ${quote(name)} worth today?`,
  askMore: 'Any other assets, or is that everything?',
  askMoreRetry: 'Just to confirm — anything else, or are those all your assets?',
  recapHeader: 'Quick recap of your assets',
  recapNoAssets: "Just to confirm — no personal assets to add. We'll skip ahead.",
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

const ASSET_TYPE_LABEL: Record<NonNullable<AssetDelta['type']>, string> = {
  VEHICLE: 'Vehicle',
  ELECTRONICS: 'Electronics',
  FURNITURE: 'Furniture',
  EQUIPMENT: 'Equipment',
  COLLECTIBLE: 'Collectible',
  OTHER: 'Other',
};

export function formatAssetValue(v: number | undefined): string {
  if (typeof v !== 'number') return '(not set)';
  return v.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

export function summariseSingleAsset(a: AssetDelta): string {
  const typeLabel = a.type ? ASSET_TYPE_LABEL[a.type] : 'Asset';
  const valuePart =
    a.currentValue !== undefined ? ` — ${formatAssetValue(a.currentValue)}` : '';
  return `${a.name.trim()} (${typeLabel})${valuePart}`;
}

export function summariseAssets(fields: AssetsFields): string {
  if (fields.hasAssets === false) return 'No personal assets';
  if (!fields.assets || fields.assets.length === 0) return '(nothing yet)';
  return fields.assets.map(summariseSingleAsset).join('; ');
}

// ============================================================================
// State-machine logic
// ============================================================================

function firstIncompleteIndex(assets: AssetDelta[]): number {
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    if (a.type === undefined || a.currentValue === undefined) return i;
  }
  return -1;
}

function nextMissingField(a: AssetDelta): 'type' | 'value' | null {
  if (a.type === undefined) return 'type';
  if (a.currentValue === undefined) return 'value';
  return null;
}

interface AdvanceInput {
  state: AssetsScriptState;
  newFields: AssetsFields;
  llmCouldNotExtract: boolean;
}

interface AdvanceOutput {
  state: AssetsScriptState;
  agentNextMessage: string | null;
  showRecap: boolean;
}

function mergeStaged(staged: AssetsFields, incoming: AssetsFields): AssetsFields {
  return {
    hasAssets: incoming.hasAssets !== undefined ? incoming.hasAssets : staged.hasAssets,
    assets:
      incoming.assets !== undefined
        ? incoming.assets.slice(0, 15)
        : staged.assets,
  };
}

export function advanceAssetsScript({
  state,
  newFields,
  llmCouldNotExtract,
}: AdvanceInput): AdvanceOutput {
  const merged = mergeStaged(state.staged, newFields);
  const hasAssets = merged.hasAssets;
  const assets = merged.assets ?? [];

  const extractedAnything =
    newFields.hasAssets !== undefined || newFields.assets !== undefined;
  const retriesIfSameStep =
    !extractedAnything && llmCouldNotExtract
      ? state.retriesOnCurrentStep + 1
      : 0;
  const forceAdvance = retriesIfSameStep > MAX_RETRIES_PER_STEP;

  if (hasAssets === false) {
    return {
      state: { step: 'RECAP', staged: merged, retriesOnCurrentStep: 0 },
      agentNextMessage: null,
      showRecap: true,
    };
  }

  if (hasAssets === undefined) {
    if (forceAdvance) {
      return {
        state: {
          step: 'RECAP',
          staged: { ...merged, hasAssets: false, assets: [] },
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
      agentNextMessage: ASSETS_AGENT_COPY.introRetry,
      showRecap: false,
    };
  }

  if (assets.length === 0) {
    return {
      state: {
        step: 'ASKING_MORE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage:
        "Tell me about your first one — for example, \"car, around $25k\" or \"guitar, about $2k\".",
      showRecap: false,
    };
  }

  const incompleteIdx = firstIncompleteIndex(assets);
  if (incompleteIdx === -1) {
    if (state.step === 'ASKING_MORE' && newFields.assets === undefined) {
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
      agentNextMessage: ASSETS_AGENT_COPY.askMore,
      showRecap: false,
    };
  }

  const target = assets[incompleteIdx];
  const missing = nextMissingField(target);

  if (forceAdvance && missing) {
    const patched = [...assets];
    if (missing === 'type') patched[incompleteIdx] = { ...target, type: 'OTHER' };
    if (missing === 'value') patched[incompleteIdx] = { ...target, currentValue: 0 };
    return advanceAssetsScript({
      state: {
        step: state.step,
        staged: { ...merged, assets: patched },
        retriesOnCurrentStep: 0,
      },
      newFields: {},
      llmCouldNotExtract: false,
    });
  }

  if (missing === 'type') {
    return {
      state: {
        step: 'ASKING_ASSET_TYPE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: ASSETS_AGENT_COPY.askType(target.name),
      showRecap: false,
    };
  }
  if (missing === 'value') {
    return {
      state: {
        step: 'ASKING_ASSET_VALUE',
        staged: merged,
        retriesOnCurrentStep: retriesIfSameStep,
      },
      agentNextMessage: ASSETS_AGENT_COPY.askValue(target.name),
      showRecap: false,
    };
  }

  return {
    state: { step: 'ASKING_MORE', staged: merged, retriesOnCurrentStep: 0 },
    agentNextMessage: ASSETS_AGENT_COPY.askMore,
    showRecap: false,
  };
}

export function bootstrapAssetsConversation(): {
  agentMessages: string[];
  nextState: AssetsScriptState;
} {
  return {
    agentMessages: [ASSETS_AGENT_COPY.intro],
    nextState: {
      step: 'ASKING_OWNERSHIP',
      staged: { assets: [] },
      retriesOnCurrentStep: 0,
    },
  };
}
