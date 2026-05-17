'use client';

/**
 * ConversationalSetup — top-level orchestrator for chat-mode onboarding
 * (Phase 12 Track E.0 + E.1 + E.2a + E.3 + E.4 + E.5).
 *
 * v1 scope: HOUSEHOLD topic only. The chat collects household
 * composition (members, pets, cars), emits a recap card, and on
 * "Looks right" persists the staged data into the existing
 * `UserPreference.onboardingDraft` JSON (the same draft the form
 * wizard reads on hydrate) + redirects the user to form-mode at
 * the Household step (now pre-filled). Remaining topics (entities,
 * properties, debts, accounts, …) are collected via the existing
 * form wizard.
 *
 * Hard rules enforced here (Phase 12 §2):
 *   - The agent never writes to a Prisma model directly.
 *   - Every numeric extraction must come from the user (the LLM is
 *     extraction-only; if it didn't extract a number, the field stays
 *     un-staged + the chat asks again).
 *   - Per-topic confirmation BEFORE any persistence — staged delta
 *     is purely client-side state until the user taps "Looks right".
 *   - On "Looks right", the staged data is merged into the existing
 *     WizardData draft (the form wizard's SSOT for in-progress
 *     onboarding) + the user lands on form-mode at the Household
 *     step (currentStep = 1) so they see the data pre-filled and
 *     can continue / correct.
 *
 * Out of scope for this PR (E.2b — animation polish):
 *   - Presence orb SVG
 *   - Typewriter agent message render
 *   - First-encounter sequence
 *   - Optional notification tone
 *   - Mic-level → orb-ripple sync
 *
 * Those land in PR #2.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import {
  INITIAL_WIZARD_DATA,
  type WizardData,
} from '@/components/onboarding/wizard';
import { ChatThread } from './ChatThread';
import { ChatComposer } from './ChatComposer';
import { TopicRecapCard, type RecapRow } from './TopicRecapCard';
import {
  advanceScript,
  bootstrapHouseholdConversation,
  initialHouseholdScriptState,
  summariseCars,
  summariseMembers,
  summarisePets,
  type HouseholdScriptState,
  AGENT_COPY,
} from './householdScript';
import type { ChatMessage } from './types';
import type { HouseholdFields } from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';

const HOUSEHOLD_STEP_INDEX = 1; // matches WIZARD_STEPS — household is index 1.
const TOPIC = 'household' as const;

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `m-${messageIdCounter}-${Date.now()}`;
}

interface ExtractApiResponse {
  success: boolean;
  data?: {
    delta?: {
      topic: 'household';
      fields: HouseholdFields;
      unresolved: string[];
      rationale?: string;
    };
  };
  error?: { code: string; message: string } | null;
}

export function ConversationalSetup() {
  const router = useRouter();
  const { token } = useAuth();
  const { state: onboardingState, saveDraft } = useOnboardingState();

  // Chat thread
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // Script state machine
  const [script, setScript] = useState<HouseholdScriptState>(initialHouseholdScriptState);
  // True while the extract API is in flight
  const [thinking, setThinking] = useState(false);
  // True after the user taps "Looks right" — locks the surface during save+redirect
  const [confirming, setConfirming] = useState(false);
  // True after the user taps "Change something" — dims the prior recap, opens diff composer
  const [changingMode, setChangingMode] = useState(false);
  // Last-error banner (recoverable — user can retype or switch to form)
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const bootstrappedRef = useRef(false);
  const recentTranscriptForApi = useMemo(
    () => messages.slice(-4).map((m) => ({ role: m.role, text: m.text })),
    [messages],
  );

  // Bootstrap intro + first ask, exactly once.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const { agentMessages, nextState } = bootstrapHouseholdConversation();
    setMessages(
      agentMessages.map((text) => ({
        id: nextId(),
        role: 'agent' as const,
        text,
        ts: Date.now(),
      })),
    );
    setScript(nextState);
  }, []);

  const appendAgent = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'agent', text, ts: Date.now() },
    ]);
  }, []);

  const appendUser = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', text, ts: Date.now() },
    ]);
  }, []);

  const handleSubmit = useCallback(
    async (userMessage: string) => {
      if (thinking || confirming) return;
      appendUser(userMessage);
      setThinking(true);
      setErrorBanner(null);

      try {
        const res = await fetch('/api/onboarding/chat/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            topic: TOPIC,
            userMessage,
            currentStateSubset: script.staged,
            recentTranscript: recentTranscriptForApi,
          }),
        });

        const json = (await res.json().catch(() => null)) as ExtractApiResponse | null;

        if (!res.ok || !json?.success || !json.data?.delta) {
          const msg =
            json?.error?.message ??
            'Chat-mode hit an issue. Try again or switch back to the form.';
          setErrorBanner(msg);
          // Stay on the same script step — let the user retype.
          return;
        }

        const delta = json.data.delta;
        const llmCouldNotExtract =
          delta.unresolved.includes('general') &&
          delta.fields.householdMembers === undefined &&
          delta.fields.householdPets === undefined &&
          delta.fields.carsCount === undefined;

        const stepBefore = script.step;
        const next = advanceScript({
          state: changingMode ? { ...script, step: 'CHANGING' } : script,
          newFields: delta.fields,
          llmCouldNotExtract,
        });

        setScript(next.state);
        if (next.agentNextMessage) {
          appendAgent(next.agentNextMessage);
        }
        // If the script advanced INTO RECAP from a regular question
        // step (i.e. we were ASKING_CARS and now we have a recap),
        // also leave a brief acknowledgement line so the recap card
        // doesn't appear suddenly without context.
        if (next.showRecap && stepBefore !== 'RECAP') {
          appendAgent(AGENT_COPY.recapHeader + ' — does this look right?');
        }
        // Reset changingMode once we've absorbed the diff.
        if (changingMode) {
          setChangingMode(false);
        }
      } catch (err) {
        console.error('chat extract failed:', err);
        setErrorBanner('Chat-mode hit a network issue. Try again or switch to the form.');
      } finally {
        setThinking(false);
      }
    },
    [
      thinking,
      confirming,
      appendUser,
      token,
      script,
      recentTranscriptForApi,
      changingMode,
      appendAgent,
    ],
  );

  const handleChange = useCallback(() => {
    if (confirming) return;
    setChangingMode(true);
    appendAgent(AGENT_COPY.changingPrompt);
  }, [confirming, appendAgent]);

  const handleConfirm = useCallback(async () => {
    if (confirming) return;
    setConfirming(true);
    setErrorBanner(null);

    try {
      // 1. Merge staged household fields into the existing WizardData draft.
      const existingDraft = (onboardingState?.draft as Partial<WizardData> | null) ?? null;
      const baseDraft: WizardData = {
        ...INITIAL_WIZARD_DATA,
        ...(existingDraft ?? {}),
      };

      const stagedMembers = script.staged.householdMembers;
      const stagedPets = script.staged.householdPets;
      const stagedCars = script.staged.carsCount;

      const mergedDraft: WizardData = {
        ...baseDraft,
        householdMembers:
          stagedMembers !== undefined
            ? stagedMembers.map((m, idx) => ({
                id: `chat-${idx}-${Date.now()}`,
                name: m.name,
                relationship: m.relationship,
                isIncomeEarner: m.isIncomeEarner,
              }))
            : baseDraft.householdMembers,
        householdPets:
          stagedPets !== undefined
            ? stagedPets.map((p, idx) => ({
                id: `chat-pet-${idx}-${Date.now()}`,
                name: p.name,
                type: p.type,
              }))
            : baseDraft.householdPets,
        carsCount: stagedCars !== undefined ? stagedCars : baseDraft.carsCount,
      };

      // 2. Persist draft via the existing saveDraft path.
      await saveDraft(mergedDraft, HOUSEHOLD_STEP_INDEX);

      // 3. Fire-and-forget topic-confirmed audit row.
      void fetch('/api/onboarding/chat/topic-confirmed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: TOPIC,
          deltaFieldNames: Object.keys(script.staged),
        }),
      }).catch(() => {
        // Audit failure is non-blocking — the data is saved.
      });

      // 4. Redirect to form-mode. Form-mode hydrates the draft +
      //    opens at the Household step (currentStep=1) so the user
      //    sees the chat-staged data pre-filled and can continue.
      router.push('/onboarding');
    } catch (err) {
      console.error('chat confirm failed:', err);
      setErrorBanner('Could not save your answers. Try again, or switch to the form.');
      setConfirming(false);
    }
  }, [confirming, onboardingState?.draft, script.staged, saveDraft, token, router]);

  const showRecap = script.step === 'RECAP';

  const recapRows = useMemo<RecapRow[]>(
    () => [
      { label: 'Household', value: summariseMembers(script.staged.householdMembers) },
      { label: 'Pets', value: summarisePets(script.staged.householdPets) },
      { label: 'Cars', value: summariseCars(script.staged.carsCount) },
    ],
    [script.staged],
  );

  const composerDisabled = thinking || confirming;
  const composerPlaceholder = changingMode
    ? "Tell me what's off — for example, \"actually 3 kids, not 2\"."
    : confirming
      ? 'Saving your answers…'
      : 'Type your reply, or tap the mic to speak…';

  return (
    <section className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-4 px-5 pb-6 pt-4">
      {errorBanner && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200"
        >
          {errorBanner}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <ChatThread
          messages={messages}
          thinking={thinking}
          trailingContent={
            showRecap ? (
              <TopicRecapCard
                title={AGENT_COPY.recapHeader}
                rows={recapRows}
                dimmed={changingMode}
                onConfirm={handleConfirm}
                onChange={handleChange}
                busy={confirming}
              />
            ) : null
          }
        />
      </div>

      <ChatComposer
        onSubmit={handleSubmit}
        disabled={composerDisabled}
        placeholder={composerPlaceholder}
      />
    </section>
  );
}
