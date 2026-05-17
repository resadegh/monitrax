'use client';

/**
 * ConversationalSetup — top-level orchestrator for chat-mode onboarding
 * (Phase 12 Track E).
 *
 * Topic flow (left to right):
 *   Household → Properties → Debts → Accounts → form mode (handoff at
 *   currentStep=6, the investments step)
 *
 * Each topic is its own self-contained state machine + script (one
 * file per topic under `wizard-chat/`). The orchestrator owns:
 *   - the chat thread (shared across topics)
 *   - per-topic script state (one piece of React state each)
 *   - the LLM extract call (routes to the right tool/prompt per topic
 *     via the gateway)
 *   - recap → confirm → next-topic-or-redirect transitions
 *
 * Hard rules (Phase 12 §2):
 *   - Agent NEVER writes to a Prisma model directly.
 *   - Every numeric extraction must come from the user.
 *   - Per-topic confirmation gates persistence (no DB write until
 *     "Looks right" on a recap card).
 *   - Form mode is the only write boundary to the bulk-create
 *     endpoint — chat saves to draft only via the existing
 *     `saveDraft()` path.
 *
 * E.2b polish reused unchanged across all topics: PresenceOrb +
 * typewriter + recap stagger + dim-and-keep trail.
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
import {
  advanceDebtsScript,
  bootstrapDebtsConversation,
  initialDebtsScriptState,
  summariseSingleDebt,
  type DebtsScriptState,
  DEBTS_AGENT_COPY,
} from './debtsScript';
import {
  advanceAccountsScript,
  bootstrapAccountsConversation,
  initialAccountsScriptState,
  summariseSingleAccount,
  type AccountsScriptState,
  ACCOUNTS_AGENT_COPY,
} from './accountsScript';
import {
  advanceSuperScript,
  bootstrapSuperConversation,
  initialSuperScriptState,
  summariseSingleSuper,
  type SuperScriptState,
  SUPER_AGENT_COPY,
} from './superScript';
import {
  advanceAssetsScript,
  bootstrapAssetsConversation,
  initialAssetsScriptState,
  summariseSingleAsset,
  type AssetsScriptState,
  ASSETS_AGENT_COPY,
} from './assetsScript';
import {
  advanceInvestmentsScript,
  bootstrapInvestmentsConversation,
  initialInvestmentsScriptState,
  summariseSingleInvestment,
  type InvestmentsScriptState,
  INVESTMENTS_AGENT_COPY,
} from './investmentsScript';
import {
  advanceIncomeExpensesScript,
  bootstrapIncomeExpensesConversation,
  initialIncomeExpensesScriptState,
  summariseSingleIncome,
  summariseSingleExpense,
  type IncomeExpensesScriptState,
  INCOME_EXPENSES_AGENT_COPY,
} from './incomeExpensesScript';
import type { ChatMessage } from './types';
import type {
  HouseholdFields,
  PropertiesFields,
  DebtsFields,
  AccountsFields,
  SuperFields,
  AssetsFields,
  InvestmentsFields,
  IncomeExpensesFields,
} from '@/lib/ai/onboarding-agent/schemas/wizardStateDelta';
import { jitteredThinkingPauseMs } from './design/motionTokens';

// After the chat chain ends, redirect to form mode at `review`
// (currentStep = 10) — the final wizard step. Chat now covers every
// data-collection step (1 household / 3 properties / 4 debts /
// 5 accounts / 6 investments / 7 super / 8 assets / 9 income-expenses)
// pre-filled; the user reviews + completes in form mode. Steps still
// skipped by chat (0 welcome / 2 entities) get sensible defaults and
// the user can hit Back to revisit them.
const AFTER_CHAT_FORM_STEP_INDEX = 10;

type ChatTopic =
  | 'household'
  | 'properties'
  | 'debts'
  | 'accounts'
  | 'investments'
  | 'super'
  | 'assets'
  | 'income-expenses';

// Order matches the form-wizard step order. Keeping chat in form-wizard
// order preserves user mental model on partial-resume back to form mode.
const TOPIC_CHAIN: ChatTopic[] = [
  'household',
  'properties',
  'debts',
  'accounts',
  'investments',
  'super',
  'assets',
  'income-expenses',
];

function nextTopicAfter(t: ChatTopic): ChatTopic | null {
  const idx = TOPIC_CHAIN.indexOf(t);
  if (idx === -1 || idx === TOPIC_CHAIN.length - 1) return null;
  return TOPIC_CHAIN[idx + 1];
}

let messageIdCounter = 0;
function nextId(): string {
  messageIdCounter += 1;
  return `m-${messageIdCounter}-${Date.now()}`;
}

interface ExtractApiResponse {
  success: boolean;
  data?: {
    delta?:
      | { topic: 'household'; fields: HouseholdFields; unresolved: string[]; rationale?: string }
      | { topic: 'properties'; fields: PropertiesFields; unresolved: string[]; rationale?: string }
      | { topic: 'debts'; fields: DebtsFields; unresolved: string[]; rationale?: string }
      | { topic: 'accounts'; fields: AccountsFields; unresolved: string[]; rationale?: string }
      | { topic: 'super'; fields: SuperFields; unresolved: string[]; rationale?: string }
      | { topic: 'assets'; fields: AssetsFields; unresolved: string[]; rationale?: string }
      | { topic: 'investments'; fields: InvestmentsFields; unresolved: string[]; rationale?: string }
      | { topic: 'income-expenses'; fields: IncomeExpensesFields; unresolved: string[]; rationale?: string };
  };
  error?: { code: string; message: string } | null;
}

export function ConversationalSetup() {
  const router = useRouter();
  const { token } = useAuth();
  const { state: onboardingState, saveDraft } = useOnboardingState();

  // Chat thread + ambient orchestrator state.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatTopic, setChatTopic] = useState<ChatTopic>('household');
  const [thinking, setThinking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [changingMode, setChangingMode] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [newestAnimatedMessageId, setNewestAnimatedMessageId] = useState<string | null>(null);
  const [historicalRecaps, setHistoricalRecaps] = useState<
    Array<{ topic: ChatTopic; rows: RecapRow[] }>
  >([]);

  // Per-topic script states. Each topic owns its own state slot so the
  // orchestrator never has to reason about heterogeneous unions.
  const [householdScript, setHouseholdScript] = useState<HouseholdScriptState>(
    initialHouseholdScriptState,
  );
  const [propertiesScript, setPropertiesScript] = useState<PropertiesScriptState>(
    initialPropertiesScriptState,
  );
  const [debtsScript, setDebtsScript] = useState<DebtsScriptState>(initialDebtsScriptState);
  const [accountsScript, setAccountsScript] = useState<AccountsScriptState>(
    initialAccountsScriptState,
  );
  const [superScript, setSuperScript] = useState<SuperScriptState>(initialSuperScriptState);
  const [assetsScript, setAssetsScript] = useState<AssetsScriptState>(initialAssetsScriptState);
  const [investmentsScript, setInvestmentsScript] = useState<InvestmentsScriptState>(
    initialInvestmentsScriptState,
  );
  const [incomeExpensesScript, setIncomeExpensesScript] = useState<IncomeExpensesScriptState>(
    initialIncomeExpensesScriptState,
  );

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

  // -------------------------------------------------------------------------
  // Per-topic recap rows
  // -------------------------------------------------------------------------
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
    if (f.ownsProperty === false) return [{ label: 'Property', value: 'None' }];
    const list = f.properties ?? [];
    if (list.length === 0) return [{ label: 'Property', value: '(none listed)' }];
    return list.map((p, idx) => ({
      label: `Property ${idx + 1}`,
      value: summariseSingleProperty(p),
    }));
  }, [propertiesScript.staged]);

  const debtsRecapRows = useMemo<RecapRow[]>(() => {
    const f = debtsScript.staged;
    if (f.hasDebts === false) return [{ label: 'Debts', value: 'None' }];
    const list = f.debts ?? [];
    if (list.length === 0) return [{ label: 'Debts', value: '(none listed)' }];
    return list.map((d, idx) => ({
      label: `Debt ${idx + 1}`,
      value: summariseSingleDebt(d),
    }));
  }, [debtsScript.staged]);

  const accountsRecapRows = useMemo<RecapRow[]>(() => {
    const f = accountsScript.staged;
    if (f.hasAccounts === false) return [{ label: 'Accounts', value: 'None' }];
    const list = f.accounts ?? [];
    if (list.length === 0) return [{ label: 'Accounts', value: '(none listed)' }];
    return list.map((a, idx) => ({
      label: `Account ${idx + 1}`,
      value: summariseSingleAccount(a),
    }));
  }, [accountsScript.staged]);

  const superRecapRows = useMemo<RecapRow[]>(() => {
    const f = superScript.staged;
    if (f.hasSuper === false) return [{ label: 'Super', value: 'None' }];
    const list = f.superAccounts ?? [];
    if (list.length === 0) return [{ label: 'Super', value: '(none listed)' }];
    return list.map((s, idx) => ({
      label: `Super ${idx + 1}`,
      value: summariseSingleSuper(s),
    }));
  }, [superScript.staged]);

  const assetsRecapRows = useMemo<RecapRow[]>(() => {
    const f = assetsScript.staged;
    if (f.hasAssets === false) return [{ label: 'Assets', value: 'None' }];
    const list = f.assets ?? [];
    if (list.length === 0) return [{ label: 'Assets', value: '(none listed)' }];
    return list.map((a, idx) => ({
      label: `Asset ${idx + 1}`,
      value: summariseSingleAsset(a),
    }));
  }, [assetsScript.staged]);

  const investmentsRecapRows = useMemo<RecapRow[]>(() => {
    const f = investmentsScript.staged;
    if (f.hasInvestments === false)
      return [{ label: 'Investments', value: 'None outside super' }];
    const list = f.investments ?? [];
    if (list.length === 0) return [{ label: 'Investments', value: '(none listed)' }];
    return list.map((i, idx) => ({
      label: `Investment ${idx + 1}`,
      value: summariseSingleInvestment(i),
    }));
  }, [investmentsScript.staged]);

  const incomeExpensesRecapRows = useMemo<RecapRow[]>(() => {
    const f = incomeExpensesScript.staged;
    const rows: RecapRow[] = [];
    const incomes = f.incomes ?? [];
    const expenses = f.expenses ?? [];
    if (f.hasIncome === false || incomes.length === 0) {
      rows.push({ label: 'Income', value: f.hasIncome === false ? 'None' : '(none listed)' });
    } else {
      incomes.forEach((i, idx) =>
        rows.push({ label: `Income ${idx + 1}`, value: summariseSingleIncome(i) }),
      );
    }
    if (f.hasExpenses === false || expenses.length === 0) {
      rows.push({
        label: 'Expenses',
        value: f.hasExpenses === false ? 'None' : '(none listed)',
      });
    } else {
      expenses.forEach((e, idx) =>
        rows.push({ label: `Expense ${idx + 1}`, value: summariseSingleExpense(e) }),
      );
    }
    return rows;
  }, [incomeExpensesScript.staged]);

  const recapRows: RecapRow[] = (() => {
    switch (chatTopic) {
      case 'household':
        return householdRecapRows;
      case 'properties':
        return propertiesRecapRows;
      case 'debts':
        return debtsRecapRows;
      case 'accounts':
        return accountsRecapRows;
      case 'investments':
        return investmentsRecapRows;
      case 'super':
        return superRecapRows;
      case 'assets':
        return assetsRecapRows;
      case 'income-expenses':
        return incomeExpensesRecapRows;
    }
  })();

  const recapHeader = (() => {
    switch (chatTopic) {
      case 'household':
        return HOUSEHOLD_AGENT_COPY.recapHeader;
      case 'properties':
        return PROPERTIES_AGENT_COPY.recapHeader;
      case 'debts':
        return DEBTS_AGENT_COPY.recapHeader;
      case 'accounts':
        return ACCOUNTS_AGENT_COPY.recapHeader;
      case 'investments':
        return INVESTMENTS_AGENT_COPY.recapHeader;
      case 'super':
        return SUPER_AGENT_COPY.recapHeader;
      case 'assets':
        return ASSETS_AGENT_COPY.recapHeader;
      case 'income-expenses':
        return INCOME_EXPENSES_AGENT_COPY.recapHeader;
    }
  })();

  const showRecap = (() => {
    switch (chatTopic) {
      case 'household':
        return householdScript.step === 'RECAP';
      case 'properties':
        return propertiesScript.step === 'RECAP';
      case 'debts':
        return debtsScript.step === 'RECAP';
      case 'accounts':
        return accountsScript.step === 'RECAP';
      case 'investments':
        return investmentsScript.step === 'RECAP';
      case 'super':
        return superScript.step === 'RECAP';
      case 'assets':
        return assetsScript.step === 'RECAP';
      case 'income-expenses':
        return incomeExpensesScript.step === 'RECAP';
    }
  })();

  // -------------------------------------------------------------------------
  // handleSubmit — routes the user's reply through the current topic's
  // state machine. Each branch is small + symmetric so adding a topic
  // means duplicating one block (until the registry refactor lands).
  // -------------------------------------------------------------------------
  const handleSubmit = useCallback(
    async (userMessage: string) => {
      if (thinking || confirming) return;
      appendUser(userMessage);
      setThinking(true);
      setErrorBanner(null);

      const currentStateSubset = (() => {
        switch (chatTopic) {
          case 'household':
            return householdScript.staged;
          case 'properties':
            return propertiesScript.staged;
          case 'debts':
            return debtsScript.staged;
          case 'accounts':
            return accountsScript.staged;
          case 'investments':
            return investmentsScript.staged;
          case 'super':
            return superScript.staged;
          case 'assets':
            return assetsScript.staged;
          case 'income-expenses':
            return incomeExpensesScript.staged;
        }
      })();

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

        // §4a.3 pre-typewriter pause — "I'm reading what you said" beat.
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
          setErrorBanner('Chat-mode got a confusing response. Try again or switch back to the form.');
          return;
        }

        switch (delta.topic) {
          case 'household': {
            const f = delta.fields;
            const llmCouldNotExtract =
              delta.unresolved.includes('general') &&
              f.householdMembers === undefined &&
              f.householdPets === undefined &&
              f.carsCount === undefined;
            const stepBefore = householdScript.step;
            const next = advanceHouseholdScript({
              state: changingMode ? { ...householdScript, step: 'CHANGING' } : householdScript,
              newFields: f,
              llmCouldNotExtract,
            });
            setHouseholdScript(next.state);
            if (next.agentNextMessage) appendAgent(next.agentNextMessage);
            if (next.showRecap && stepBefore !== 'RECAP') {
              appendAgent(HOUSEHOLD_AGENT_COPY.recapHeader + ' — does this look right?');
            }
            break;
          }
          case 'properties': {
            const f = delta.fields;
            const llmCouldNotExtract =
              delta.unresolved.includes('general') &&
              f.ownsProperty === undefined &&
              f.properties === undefined;
            const stepBefore = propertiesScript.step;
            const next = advancePropertiesScript({
              state: changingMode ? { ...propertiesScript, step: 'CHANGING' } : propertiesScript,
              newFields: f,
              llmCouldNotExtract,
            });
            setPropertiesScript(next.state);
            if (next.agentNextMessage) appendAgent(next.agentNextMessage);
            if (next.showRecap && stepBefore !== 'RECAP') {
              const isNone = next.state.staged.ownsProperty === false;
              appendAgent(
                isNone
                  ? PROPERTIES_AGENT_COPY.recapNoProperty
                  : PROPERTIES_AGENT_COPY.recapHeader + ' — does this look right?',
              );
            }
            break;
          }
          case 'debts': {
            const f = delta.fields;
            const llmCouldNotExtract =
              delta.unresolved.includes('general') &&
              f.hasDebts === undefined &&
              f.debts === undefined;
            const stepBefore = debtsScript.step;
            const next = advanceDebtsScript({
              state: changingMode ? { ...debtsScript, step: 'CHANGING' } : debtsScript,
              newFields: f,
              llmCouldNotExtract,
            });
            setDebtsScript(next.state);
            if (next.agentNextMessage) appendAgent(next.agentNextMessage);
            if (next.showRecap && stepBefore !== 'RECAP') {
              const isNone = next.state.staged.hasDebts === false;
              appendAgent(
                isNone
                  ? DEBTS_AGENT_COPY.recapNoDebts
                  : DEBTS_AGENT_COPY.recapHeader + ' — does this look right?',
              );
            }
            break;
          }
          case 'accounts': {
            const f = delta.fields;
            const llmCouldNotExtract =
              delta.unresolved.includes('general') &&
              f.hasAccounts === undefined &&
              f.accounts === undefined;
            const stepBefore = accountsScript.step;
            const next = advanceAccountsScript({
              state: changingMode ? { ...accountsScript, step: 'CHANGING' } : accountsScript,
              newFields: f,
              llmCouldNotExtract,
            });
            setAccountsScript(next.state);
            if (next.agentNextMessage) appendAgent(next.agentNextMessage);
            if (next.showRecap && stepBefore !== 'RECAP') {
              const isNone = next.state.staged.hasAccounts === false;
              appendAgent(
                isNone
                  ? ACCOUNTS_AGENT_COPY.recapNoAccounts
                  : ACCOUNTS_AGENT_COPY.recapHeader + ' — does this look right?',
              );
            }
            break;
          }
          case 'super': {
            const f = delta.fields;
            const llmCouldNotExtract =
              delta.unresolved.includes('general') &&
              f.hasSuper === undefined &&
              f.superAccounts === undefined;
            const stepBefore = superScript.step;
            const next = advanceSuperScript({
              state: changingMode ? { ...superScript, step: 'CHANGING' } : superScript,
              newFields: f,
              llmCouldNotExtract,
            });
            setSuperScript(next.state);
            if (next.agentNextMessage) appendAgent(next.agentNextMessage);
            if (next.showRecap && stepBefore !== 'RECAP') {
              const isNone = next.state.staged.hasSuper === false;
              appendAgent(
                isNone
                  ? SUPER_AGENT_COPY.recapNoSuper
                  : SUPER_AGENT_COPY.recapHeader + ' — does this look right?',
              );
            }
            break;
          }
          case 'assets': {
            const f = delta.fields;
            const llmCouldNotExtract =
              delta.unresolved.includes('general') &&
              f.hasAssets === undefined &&
              f.assets === undefined;
            const stepBefore = assetsScript.step;
            const next = advanceAssetsScript({
              state: changingMode ? { ...assetsScript, step: 'CHANGING' } : assetsScript,
              newFields: f,
              llmCouldNotExtract,
            });
            setAssetsScript(next.state);
            if (next.agentNextMessage) appendAgent(next.agentNextMessage);
            if (next.showRecap && stepBefore !== 'RECAP') {
              const isNone = next.state.staged.hasAssets === false;
              appendAgent(
                isNone
                  ? ASSETS_AGENT_COPY.recapNoAssets
                  : ASSETS_AGENT_COPY.recapHeader + ' — does this look right?',
              );
            }
            break;
          }
          case 'investments': {
            const f = delta.fields;
            const llmCouldNotExtract =
              delta.unresolved.includes('general') &&
              f.hasInvestments === undefined &&
              f.investments === undefined;
            const stepBefore = investmentsScript.step;
            const next = advanceInvestmentsScript({
              state: changingMode
                ? { ...investmentsScript, step: 'CHANGING' }
                : investmentsScript,
              newFields: f,
              llmCouldNotExtract,
            });
            setInvestmentsScript(next.state);
            if (next.agentNextMessage) appendAgent(next.agentNextMessage);
            if (next.showRecap && stepBefore !== 'RECAP') {
              const isNone = next.state.staged.hasInvestments === false;
              appendAgent(
                isNone
                  ? INVESTMENTS_AGENT_COPY.recapNoInvestments
                  : INVESTMENTS_AGENT_COPY.recapHeader + ' — does this look right?',
              );
            }
            break;
          }
          case 'income-expenses': {
            const f = delta.fields;
            const llmCouldNotExtract =
              delta.unresolved.includes('general') &&
              f.hasIncome === undefined &&
              f.incomes === undefined &&
              f.hasExpenses === undefined &&
              f.expenses === undefined;
            const stepBefore = incomeExpensesScript.step;
            const next = advanceIncomeExpensesScript({
              state: changingMode
                ? { ...incomeExpensesScript, step: 'CHANGING' }
                : incomeExpensesScript,
              newFields: f,
              llmCouldNotExtract,
            });
            setIncomeExpensesScript(next.state);
            if (next.agentNextMessage) appendAgent(next.agentNextMessage);
            if (next.showRecap && stepBefore !== 'RECAP') {
              appendAgent(
                INCOME_EXPENSES_AGENT_COPY.recapHeader + ' — does this look right?',
              );
            }
            break;
          }
        }

        if (changingMode) setChangingMode(false);
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
      debtsScript,
      accountsScript,
      superScript,
      assetsScript,
      investmentsScript,
      incomeExpensesScript,
      recentTranscriptForApi,
      changingMode,
      appendAgent,
    ],
  );

  // -------------------------------------------------------------------------
  // handleChange — snapshot the current recap into the trail.
  // -------------------------------------------------------------------------
  const handleChange = useCallback(() => {
    if (confirming) return;
    setHistoricalRecaps((prev) => [...prev, { topic: chatTopic, rows: recapRows }]);
    setChangingMode(true);
    const prompt = (() => {
      switch (chatTopic) {
        case 'household':
          return HOUSEHOLD_AGENT_COPY.changingPrompt;
        case 'properties':
          return PROPERTIES_AGENT_COPY.changingPrompt;
        case 'debts':
          return DEBTS_AGENT_COPY.changingPrompt;
        case 'accounts':
          return ACCOUNTS_AGENT_COPY.changingPrompt;
        case 'investments':
          return INVESTMENTS_AGENT_COPY.changingPrompt;
        case 'super':
          return SUPER_AGENT_COPY.changingPrompt;
        case 'assets':
          return ASSETS_AGENT_COPY.changingPrompt;
        case 'income-expenses':
          return INCOME_EXPENSES_AGENT_COPY.changingPrompt;
      }
    })();
    appendAgent(prompt);
  }, [confirming, appendAgent, chatTopic, recapRows]);

  // -------------------------------------------------------------------------
  // handleConfirm — topic-aware. Each topic confirms by saving its
  // staged data into the existing WizardData draft, then either
  // pivots to the next topic in the chain or (for the last topic)
  // redirects to form mode.
  // -------------------------------------------------------------------------
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

      let mergedDraft: WizardData = baseDraft;

      if (chatTopic === 'household') {
        const stagedMembers = householdScript.staged.householdMembers;
        const stagedPets = householdScript.staged.householdPets;
        const stagedCars = householdScript.staged.carsCount;
        mergedDraft = {
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
      } else if (chatTopic === 'properties') {
        const stagedProps = propertiesScript.staged.properties ?? [];
        mergedDraft = {
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
      } else if (chatTopic === 'debts') {
        const stagedDebts = debtsScript.staged.debts ?? [];
        mergedDraft = {
          ...baseDraft,
          debts: stagedDebts.map((d, idx) => ({
            id: `chat-debt-${idx}-${Date.now()}`,
            name: d.name,
            type: d.type ?? 'PERSONAL',
            principal: d.principal ?? 0,
            interestRateAnnual: 0,
            minRepayment: 0,
            repaymentFrequency: 'MONTHLY' as const,
            isHecsHelp: d.isHecsHelp ?? d.type === 'STUDENT',
          })),
        };
      } else if (chatTopic === 'accounts') {
        const stagedAccts = accountsScript.staged.accounts ?? [];
        mergedDraft = {
          ...baseDraft,
          accounts: stagedAccts.map((a, idx) => ({
            id: `chat-acct-${idx}-${Date.now()}`,
            name: a.name,
            type: a.type ?? 'TRANSACTIONAL',
            currentBalance: a.currentBalance ?? 0,
            source: 'MANUAL' as const,
          })),
        };
      } else if (chatTopic === 'super') {
        const stagedSuper = superScript.staged.superAccounts ?? [];
        mergedDraft = {
          ...baseDraft,
          superAccounts: stagedSuper.map((s, idx) => ({
            id: `chat-super-${idx}-${Date.now()}`,
            // SuperAccountInput requires both `name` + `fundName`.
            // Chat only captures the fund name; we use it for both so
            // the wizard's display has a sensible value (user can
            // rename in form mode if they want a separate nickname).
            name: s.fundName,
            fundName: s.fundName,
            currentBalance: s.currentBalance ?? 0,
          })),
        };
      } else if (chatTopic === 'assets') {
        const stagedAssets = assetsScript.staged.assets ?? [];
        mergedDraft = {
          ...baseDraft,
          assets: stagedAssets.map((a, idx) => ({
            id: `chat-asset-${idx}-${Date.now()}`,
            name: a.name,
            type: a.type ?? 'OTHER',
            // AssetInput requires `purchasePrice` + `currentValue`.
            // Chat only captures `currentValue`; default purchasePrice
            // to the same value (sensible — user can correct in form).
            purchasePrice: a.currentValue ?? 0,
            currentValue: a.currentValue ?? 0,
            expenses: [],
          })),
        };
      } else if (chatTopic === 'investments') {
        const stagedInv = investmentsScript.staged.investments ?? [];
        mergedDraft = {
          ...baseDraft,
          investments: stagedInv.map((inv, idx) => ({
            id: `chat-inv-${idx}-${Date.now()}`,
            name: inv.name,
            type: inv.type ?? 'BROKERAGE',
            // InvestmentAccountInput requires `cashBalance` +
            // `holdings`. Chat captures a single totalValue; store
            // the whole amount as `cashBalance` with an empty
            // holdings array. Form mode handles per-holding drill-in
            // (users need their broker statement to recall holdings).
            cashBalance: inv.totalValue ?? 0,
            holdings: [],
          })),
        };
      } else if (chatTopic === 'income-expenses') {
        const stagedIncomes = incomeExpensesScript.staged.incomes ?? [];
        const stagedExpenses = incomeExpensesScript.staged.expenses ?? [];
        const ieMerged: WizardData = {
          ...baseDraft,
          income: stagedIncomes.map((inc, idx) => ({
            id: `chat-income-${idx}-${Date.now()}`,
            name: inc.name,
            type: inc.type ?? 'OTHER',
            amount: inc.amount ?? 0,
            frequency: inc.frequency ?? 'ANNUAL',
            // Default GROSS for SALARY when chat didn't capture it —
            // most users state their headline figure as gross.
            ...(inc.type === 'SALARY'
              ? { salaryType: inc.salaryType ?? 'GROSS' as const }
              : {}),
          })),
          expenses: stagedExpenses.map((exp, idx) => ({
            id: `chat-exp-${idx}-${Date.now()}`,
            name: exp.name,
            category: exp.category ?? 'OTHER',
            amount: exp.amount ?? 0,
            frequency: exp.frequency ?? 'MONTHLY',
          })),
        };
        // Smart Welcome hydration — only on the FINAL chat topic.
        // Chat skips Welcome (step 0) + Entities (step 2); without
        // this, the form-mode review screen has empty profile /
        // housing / debtCategories / hasInvestments fields. Derive
        // sensible defaults from the data already collected so the
        // review pre-fills end-to-end. User can Back-button to
        // change anything they disagree with.
        mergedDraft = applyWelcomeHydration(ieMerged);
      }

      // The currentStep we save under depends on whether we're pivoting
      // to another topic (save into the topic's own step) or wrapping
      // up (save at the post-chat redirect step).
      const next = nextTopicAfter(chatTopic);
      const stepIndexToSave =
        next === null ? AFTER_CHAT_FORM_STEP_INDEX : currentStepFor(chatTopic);

      await saveDraft(mergedDraft, stepIndexToSave);

      // Fire-and-forget topic-confirmed audit row.
      void fetch('/api/onboarding/chat/topic-confirmed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: chatTopic,
          deltaFieldNames: Object.keys(
            chatTopic === 'household'
              ? householdScript.staged
              : chatTopic === 'properties'
                ? propertiesScript.staged
                : chatTopic === 'debts'
                  ? debtsScript.staged
                  : chatTopic === 'accounts'
                    ? accountsScript.staged
                    : chatTopic === 'investments'
                      ? investmentsScript.staged
                      : chatTopic === 'super'
                        ? superScript.staged
                        : chatTopic === 'assets'
                          ? assetsScript.staged
                          : incomeExpensesScript.staged,
          ),
        }),
      }).catch(() => {
        // non-blocking
      });

      if (next === null) {
        // Last topic confirmed — hand off to form mode.
        router.push('/onboarding');
        return;
      }

      // Pivot to the next topic — bootstrap its conversation in-thread.
      const bootstrap = (() => {
        switch (next) {
          case 'properties':
            return bootstrapPropertiesConversation();
          case 'debts':
            return bootstrapDebtsConversation();
          case 'accounts':
            return bootstrapAccountsConversation();
          case 'investments':
            return bootstrapInvestmentsConversation();
          case 'super':
            return bootstrapSuperConversation();
          case 'assets':
            return bootstrapAssetsConversation();
          case 'income-expenses':
            return bootstrapIncomeExpensesConversation();
          case 'household':
            // Defensive — household is never a pivot target.
            return bootstrapHouseholdConversation();
        }
      })();
      for (const text of bootstrap.agentMessages) appendAgent(text);
      switch (next) {
        case 'properties':
          setPropertiesScript(bootstrap.nextState as PropertiesScriptState);
          break;
        case 'debts':
          setDebtsScript(bootstrap.nextState as DebtsScriptState);
          break;
        case 'accounts':
          setAccountsScript(bootstrap.nextState as AccountsScriptState);
          break;
        case 'investments':
          setInvestmentsScript(bootstrap.nextState as InvestmentsScriptState);
          break;
        case 'super':
          setSuperScript(bootstrap.nextState as SuperScriptState);
          break;
        case 'assets':
          setAssetsScript(bootstrap.nextState as AssetsScriptState);
          break;
        case 'income-expenses':
          setIncomeExpensesScript(bootstrap.nextState as IncomeExpensesScriptState);
          break;
      }
      setChatTopic(next);
      setConfirming(false);
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
    debtsScript.staged,
    accountsScript.staged,
    investmentsScript.staged,
    superScript.staged,
    assetsScript.staged,
    incomeExpensesScript.staged,
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
                  title={headerForTopic(snapshot.topic)}
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Which form-wizard step does each chat topic live at? The chat saves
 * its draft under this index so if the user lands on form-mode at any
 * pivot point, they see the right step pre-filled.
 *
 * Wizard step indices (see WIZARD_STEPS in onboarding/wizard/types.ts):
 *   0 welcome / 1 household / 2 entities / 3 properties / 4 debts /
 *   5 accounts / 6 investments / 7 super / 8 assets / 9 income-expenses
 */
/**
 * Smart Welcome hydration — derive Welcome-step defaults from the data
 * the chat already collected, so the form-mode review screen pre-fills
 * end-to-end (instead of showing empty Welcome fields the user would
 * have to Back-button to fill).
 *
 * Called ONLY when the final chat topic (income-expenses) confirms.
 * The baseDraft at that point already contains everything previously
 * confirmed by chat (properties, debts, accounts, investments, super,
 * assets) + the income/expenses just confirmed in this call.
 *
 * Rules:
 *   profileType:
 *     HOME property + (INVESTMENT property OR investments)  → MIXED
 *     INVESTMENT property OR investments                    → INVESTOR
 *     HOME property                                          → HOMEOWNER
 *     otherwise                                              → STARTER
 *
 *   housing:
 *     HOME property + RENT expense  → BOTH
 *     HOME property                  → OWN
 *     RENT expense, no HOME          → RENT
 *     otherwise                      → keep existing (or OWN default)
 *
 *   country / taxYear: AU + current calendar year (Monitrax is AU-only;
 *     user can override in form-mode Welcome).
 *
 *   hasInvestments:
 *     investments[] non-empty OR superAccounts[] non-empty → YES
 *     otherwise                                              → NO
 *
 *   debtCategories: derived from staged debts' types (CAR / STUDENT /
 *     PERSONAL / BUSINESS). De-duplicated.
 *
 * Conservative — never overwrites a non-null Welcome field the user
 * may have set elsewhere; only fills the nulls.
 */
function applyWelcomeHydration(draft: WizardData): WizardData {
  const hasHome = draft.properties.some((p) => p.type === 'HOME');
  const hasInvProp = draft.properties.some((p) => p.type === 'INVESTMENT');
  const hasInvAccount = draft.investments.length > 0;
  const hasSuper = draft.superAccounts.length > 0;
  const paysRent = draft.expenses.some((e) => e.category === 'RENT');

  let profileType = draft.profileType;
  if (profileType === null) {
    if (hasHome && (hasInvProp || hasInvAccount)) profileType = 'MIXED';
    else if (hasInvProp || hasInvAccount) profileType = 'INVESTOR';
    else if (hasHome) profileType = 'HOMEOWNER';
    else profileType = 'STARTER';
  }

  let housing = draft.housing;
  if (housing === null) {
    if (hasHome && paysRent) housing = 'BOTH';
    else if (hasHome) housing = 'OWN';
    else if (paysRent) housing = 'RENT';
    // else: keep null — user can pick on the Welcome step
  }

  const hasInvestments: typeof draft.hasInvestments =
    draft.hasInvestments ?? ((hasInvAccount || hasSuper) ? 'YES' : 'NO');

  // De-duplicate debt categories from staged debts. Only the four
  // canonical categories are valid (matches DebtCategory enum).
  const validCategories = new Set(['CAR', 'STUDENT', 'PERSONAL', 'BUSINESS'] as const);
  const debtCategorySet = new Set<typeof draft.debtCategories[number]>(draft.debtCategories);
  for (const d of draft.debts) {
    if (validCategories.has(d.type as 'CAR' | 'STUDENT' | 'PERSONAL' | 'BUSINESS')) {
      debtCategorySet.add(d.type as 'CAR' | 'STUDENT' | 'PERSONAL' | 'BUSINESS');
    }
  }

  return {
    ...draft,
    profileType,
    country: draft.country || 'AU',
    taxYear: draft.taxYear || new Date().getFullYear().toString(),
    housing,
    hasInvestments,
    debtCategories: Array.from(debtCategorySet),
  };
}

function currentStepFor(topic: ChatTopic): number {
  switch (topic) {
    case 'household':
      return 1;
    case 'properties':
      return 3;
    case 'debts':
      return 4;
    case 'accounts':
      return 5;
    case 'investments':
      return 6;
    case 'super':
      return 7;
    case 'assets':
      return 8;
    case 'income-expenses':
      return 9;
  }
}

function headerForTopic(t: ChatTopic): string {
  switch (t) {
    case 'household':
      return HOUSEHOLD_AGENT_COPY.recapHeader;
    case 'properties':
      return PROPERTIES_AGENT_COPY.recapHeader;
    case 'debts':
      return DEBTS_AGENT_COPY.recapHeader;
    case 'accounts':
      return ACCOUNTS_AGENT_COPY.recapHeader;
    case 'investments':
      return INVESTMENTS_AGENT_COPY.recapHeader;
    case 'super':
      return SUPER_AGENT_COPY.recapHeader;
    case 'assets':
      return ASSETS_AGENT_COPY.recapHeader;
    case 'income-expenses':
      return INCOME_EXPENSES_AGENT_COPY.recapHeader;
  }
}

// Re-export for tests / story setups.
export { formatPropertyValue };
