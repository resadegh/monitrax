'use client';

/**
 * ConversationalSetup — top-level orchestrator for chat-mode onboarding
 * (Phase 12 Track E).
 *
 * Topic flow (left to right):
 *   Household → Properties → form mode (debts step pre-filled handoff)
 *
 * Each topic is its own self-contained state machine + script (see
 * `householdScript.ts` and `propertiesScript.ts`). The orchestrator
 * owns:
 *   - the chat thread (shared across topics)
 *   - the current-topic state (household script | properties script)
 *   - the LLM extract call (routes to the right tool/prompt per topic)
 *   - the recap-card-confirm → save-draft → next-topic-or-redirect
 *     transition
 *
 * Hard rules (Phase 12 §2 — verified in PR #4):
 *   - Agent NEVER writes to a Prisma model directly.
 *   - Every numeric extraction must come from the user.
 *   - Per-topic confirmation gates persistence (no DB write until
 *     "Looks right" on a recap card).
 *   - Form mode is the only write boundary to the bulk-create
 *     endpoint — chat saves to draft only.
 *
 * E.2b motion polish (PR #773): PresenceOrb + typewriter + recap
 * stagger + dim-and-keep mistake recovery trail. Reused across both
 * topics in this PR — no changes needed.
 *
 * Deferred (E.2b.2 + later PRs):
 *   - First-encounter sequence persistence
 *   - Optional notification tone toggle
 *   - Mic-level → orb-ripple sync
 *   - Remaining topics (debts, accounts, super, investments, …)
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
  advanceScript as advanceHouseholdScript,
  bootstrapHouseholdConversation,
  initialHouseholdScriptState,
  summariseCars,
  summariseMembers,
  summarisePets,
  type HouseholdScriptState,
  AGENT_COPY as HOUSEHOLD_AGENT_COPY,
} from './householdScript';
import {
  advancePropertiesScript,
  bootstrapPropertiesConversation,
  initialPropertiesScriptState,
  summariseSingleProperty,
  formatPropertyValue,
  type PropertiesScriptState,
  PROPERTIES_AGENT_COPY,
} from './propertiesScript';
import type { ChatMessage } from './types';
import type {
  HouseholdFields,
  PropertiesFields,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';
import { jitteredThinkingPauseMs } from './design/motionTokens';

// After both chat topics are confirmed, redirect to form mode at
// `debts` (currentStep = 4). The form wizard hydrates the draft and
// the user continues there. Welcome (step 0) + Entities (step 2)
// stay empty — user can hit Back to fill them.
const AFTER_PROPERTIES_FORM_STEP_INDEX = 4;

type ChatTopic = 'household' | 'properties';

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `m-${messageIdCounter}-${Date.now()}`;
}

interface ExtractApiResponse {
  success: boolean;
  data?: {
    delta?:
      | {
          topic: 'household';
          fields: HouseholdFields;
          unresolved: string[];
          rationale?: string;
        }
      | {
          topic: 'properties';
          fields: PropertiesFields;
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
  // Per-topic script states. Household is always initialised; Properties
  // is initialised when the user transitions to it (mostly so the
  // initial debug snapshot of state isn't misleading).
  const [householdScript, setHouseholdScript] = useState<HouseholdScriptState>(
    initialHouseholdScriptState,
  );
  const [propertiesScript, setPropertiesScript] = useState<PropertiesScriptState>(
    initialPropertiesScriptState,
  );
  // Which topic we're currently in.
  const [chatTopic, setChatTopic] = useState<ChatTopic>('household');
  // True while the extract API is in flight.
  const [thinking, setThinking] = useState(false);
  // True after the user taps "Looks right" — locks the surface during
  // save + transition.
  const [confirming, setConfirming] = useState(false);
  // True after the user taps "Change something" — dims the prior recap
  // and opens the diff composer.
  const [changingMode, setChangingMode] = useState(false);
  // Last-error banner (recoverable — user can retype or switch to form).
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  // Which message animates next (typewriter target).
  const [newestAnimatedMessageId, setNewestAnimatedMessageId] = useState<string | null>(null);
  // Dim-and-keep transparency trail. Each entry is keyed by which topic
  // it was emitted from so the recap header reads correctly.
  const [historicalRecaps, setHistoricalRecaps] = useState<
    Array<{ topic: ChatTopic; rows: RecapRow[] }>
  >([]);

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
    setHouseholdScript(nextState);
  }, []);

  const appendAgent = useCallback((text: string, opts?: { animate?: boolean }) => {
    const id = nextId();
    setMessages((prev) => [...prev, { id, role: 'agent', text, ts: Date.now() }]);
    if (opts?.animate !== false) {
      setNewestAnimatedMessageId(id);
    }
  }, []);

  const appendUser = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'user', text, ts: Date.now() },
    ]);
  }, []);

  // Compute the current-topic's recap rows. Same shape regardless of
  // topic so TopicRecapCard stays generic.
  const householdRecapRows = useMemo<RecapRow[]>(
    () => [
      { label: 'Household', value: summariseMembers(householdScript.staged.householdMembers) },
      { label: 'Pets', value: summarisePets(householdScript.staged.householdPets) },
      { label: 'Cars', value: summariseCars(householdScript.staged.carsCount) },
    ],
    [householdScript.staged],
  );

  const propertiesRecapRows = useMemo<RecapRow[]>(() => {
    const f = propertiesScript.staged;
    if (f.ownsProperty === false) {
      return [{ label: 'Property', value: 'None' }];
    }
    const list = f.properties ?? [];
    if (list.length === 0) {
      return [{ label: 'Property', value: '(none listed)' }];
    }
    return list.map((p, idx) => ({
      label: `Property ${idx + 1}`,
      value: summariseSingleProperty(p),
    }));
  }, [propertiesScript.staged]);

  const recapRows = chatTopic === 'household' ? householdRecapRows : propertiesRecapRows;
  const recapHeader =
    chatTopic === 'household'
      ? HOUSEHOLD_AGENT_COPY.recapHeader
      : PROPERTIES_AGENT_COPY.recapHeader;

  const showRecap =
    (chatTopic === 'household' && householdScript.step === 'RECAP') ||
    (chatTopic === 'properties' && propertiesScript.step === 'RECAP');

  // ===========================================================================
  // handleSubmit — routes the user's reply through the current topic's
  // state machine.
  // ===========================================================================
  const handleSubmit = useCallback(
    async (userMessage: string) => {
      if (thinking || confirming) return;
      appendUser(userMessage);
      setThinking(true);
      setErrorBanner(null);

      const currentStateSubset =
        chatTopic === 'household' ? householdScript.staged : propertiesScript.staged;

      try {
        const res = await fetch('/api/onboarding/chat/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            topic: chatTopic,
            userMessage,
            currentStateSubset,
            recentTranscript: recentTranscriptForApi,
          }),
        });

        const json = (await res.json().catch(() => null)) as ExtractApiResponse | null;

        // §4a.3 pre-typewriter pause — the "I'm reading what you said"
        // beat, regardless of how fast the API responded.
        await new Promise((resolve) => setTimeout(resolve, jitteredThinkingPauseMs()));

        if (!res.ok || !json?.success || !json.data?.delta) {
          const msg =
            json?.error?.message ??
            'Chat-mode hit an issue. Try again or switch back to the form.';
          setErrorBanner(msg);
          return;
        }

        const delta = json.data.delta;
        if (delta.topic !== chatTopic) {
          // Server returned a different topic than we asked for —
          // shouldn't happen, but fail closed.
          setErrorBanner('Chat-mode got a confusing response. Try again or switch back to the form.');
          return;
        }

        if (chatTopic === 'household') {
          const householdDelta = delta.fields as HouseholdFields;
          const llmCouldNotExtract =
            delta.unresolved.includes('general') &&
            householdDelta.householdMembers === undefined &&
            householdDelta.householdPets === undefined &&
            householdDelta.carsCount === undefined;

          const stepBefore = householdScript.step;
          const next = advanceHouseholdScript({
            state: changingMode ? { ...householdScript, step: 'CHANGING' } : householdScript,
            newFields: householdDelta,
            llmCouldNotExtract,
          });

          setHouseholdScript(next.state);
          if (next.agentNextMessage) {
            appendAgent(next.agentNextMessage);
          }
          if (next.showRecap && stepBefore !== 'RECAP') {
            appendAgent(HOUSEHOLD_AGENT_COPY.recapHeader + ' — does this look right?');
          }
        } else {
          const propsDelta = delta.fields as PropertiesFields;
          const llmCouldNotExtract =
            delta.unresolved.includes('general') &&
            propsDelta.ownsProperty === undefined &&
            propsDelta.properties === undefined;

          const stepBefore = propertiesScript.step;
          const next = advancePropertiesScript({
            state: changingMode ? { ...propertiesScript, step: 'CHANGING' } : propertiesScript,
            newFields: propsDelta,
            llmCouldNotExtract,
          });

          setPropertiesScript(next.state);
          if (next.agentNextMessage) {
            appendAgent(next.agentNextMessage);
          }
          if (next.showRecap && stepBefore !== 'RECAP') {
            const isNoProperty = next.state.staged.ownsProperty === false;
            appendAgent(
              isNoProperty
                ? PROPERTIES_AGENT_COPY.recapNoProperty
                : PROPERTIES_AGENT_COPY.recapHeader + ' — does this look right?',
            );
          }
        }

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
      chatTopic,
      householdScript,
      propertiesScript,
      recentTranscriptForApi,
      changingMode,
      appendAgent,
    ],
  );

  // ===========================================================================
  // handleChange — snapshot the current recap into the history trail
  // (mistake-recovery transparency §4a.5).
  // ===========================================================================
  const handleChange = useCallback(() => {
    if (confirming) return;
    setHistoricalRecaps((prev) => [
      ...prev,
      { topic: chatTopic, rows: recapRows },
    ]);
    setChangingMode(true);
    appendAgent(
      chatTopic === 'household'
        ? HOUSEHOLD_AGENT_COPY.changingPrompt
        : PROPERTIES_AGENT_COPY.changingPrompt,
    );
  }, [confirming, appendAgent, chatTopic, recapRows]);

  // ===========================================================================
  // handleConfirm — topic-aware. Household-confirm pivots into
  // Properties; Properties-confirm saves + redirects to form mode.
  // ===========================================================================
  const handleConfirm = useCallback(async () => {
    if (confirming) return;
    setConfirming(true);
    setErrorBanner(null);

    try {
      const existingDraft = (onboardingState?.draft as Partial<WizardData> | null) ?? null;
      const baseDraft: WizardData = {
        ...INITIAL_WIZARD_DATA,
        ...(existingDraft ?? {}),
      };

      if (chatTopic === 'household') {
        // Merge household-staged fields into the existing wizard draft
        // and pivot to Properties topic — NOT redirect to form mode.
        const stagedMembers = householdScript.staged.householdMembers;
        const stagedPets = householdScript.staged.householdPets;
        const stagedCars = householdScript.staged.carsCount;

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

        await saveDraft(mergedDraft, 1);

        void fetch('/api/onboarding/chat/topic-confirmed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            topic: 'household',
            deltaFieldNames: Object.keys(householdScript.staged),
          }),
        }).catch(() => {
          // Audit failure is non-blocking — the data is saved.
        });

        // Pivot to Properties — bootstrap the new topic.
        const { agentMessages, nextState } = bootstrapPropertiesConversation();
        for (const text of agentMessages) {
          appendAgent(text);
        }
        setPropertiesScript(nextState);
        setChatTopic('properties');
        setConfirming(false);
        return;
      }

      // chatTopic === 'properties' — final chat topic. Save + redirect.
      const stagedProps = propertiesScript.staged.properties ?? [];
      const mergedDraft: WizardData = {
        ...baseDraft,
        properties: stagedProps.map((p, idx) => ({
          id: `chat-prop-${idx}-${Date.now()}`,
          name: p.name,
          address: '',
          type: p.type ?? 'HOME',
          purchasePrice: p.currentValue ?? 0,
          currentValue: p.currentValue ?? 0,
          hasLoan: p.hasLoan ?? false,
          expenses: [],
        })),
      };

      await saveDraft(mergedDraft, AFTER_PROPERTIES_FORM_STEP_INDEX);

      void fetch('/api/onboarding/chat/topic-confirmed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: 'properties',
          deltaFieldNames: Object.keys(propertiesScript.staged),
        }),
      }).catch(() => {
        // non-blocking
      });

      router.push('/onboarding');
    } catch (err) {
      console.error('chat confirm failed:', err);
      setErrorBanner('Could not save your answers. Try again, or switch to the form.');
      setConfirming(false);
    }
  }, [
    confirming,
    chatTopic,
    onboardingState?.draft,
    householdScript.staged,
    propertiesScript.staged,
    saveDraft,
    token,
    appendAgent,
    router,
  ]);

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
          newestAnimatedMessageId={newestAnimatedMessageId}
          trailingContent={
            <>
              {historicalRecaps.map((snapshot, idx) => (
                <TopicRecapCard
                  key={`recap-history-${idx}`}
                  title={
                    snapshot.topic === 'household'
                      ? HOUSEHOLD_AGENT_COPY.recapHeader
                      : PROPERTIES_AGENT_COPY.recapHeader
                  }
                  rows={snapshot.rows}
                  dimmed
                  onConfirm={() => {}}
                  onChange={() => {}}
                />
              ))}
              {showRecap ? (
                <TopicRecapCard
                  title={recapHeader}
                  rows={recapRows}
                  onConfirm={handleConfirm}
                  onChange={handleChange}
                  busy={confirming}
                />
              ) : null}
            </>
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

// Used by ConversationalSetup's recap when rendering properties currency.
// Re-exported so tests / story setups can import the same formatter.
export { formatPropertyValue };
