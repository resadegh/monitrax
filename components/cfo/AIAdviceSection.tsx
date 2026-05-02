'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import type {
  AIAdviceDocument,
  AIAdviceRecommendation,
  ScenarioResult,
} from '@/lib/cfo';
import { AdviceHero } from './AdviceHero';
import { AdviceRecommendationCard } from './AdviceRecommendationCard';
import { AdviceChatThread, type ChatMessage } from './AdviceChatThread';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Sparkles } from 'lucide-react';

const appleEase: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

interface AIAdviceSectionProps {
  token: string | null;
}

interface ScenarioState {
  loading: boolean;
  result?: ScenarioResult;
  error?: string;
}

/**
 * The orchestrating client component for the AI Advice surface.
 *
 * Responsibility split:
 *   • This component owns the data lifecycle (fetch advice, run scenarios,
 *     send chat messages, handle refresh).
 *   • Visual presentation lives in AdviceHero / AdviceRecommendationCard /
 *     AdviceChatThread.
 *
 * Stability contract: once an advice doc is loaded, it stays put. The doc
 * does not silently regenerate when underlying data drifts — only an
 * explicit user-triggered refresh swaps it. See `lib/cfo/aiAdvisor.ts`
 * findFreshCache() for the server-side guarantee.
 */
export function AIAdviceSection({ token }: AIAdviceSectionProps) {
  const reduced = useReducedMotion() ?? false;
  const [advice, setAdvice] = useState<AIAdviceDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scenarios, setScenarios] = useState<Record<string, ScenarioState>>({});

  // Chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSending, setChatSending] = useState(false);
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();

  const fetchAdvice = useCallback(
    async (forceRegenerate = false) => {
      if (!token) return;
      setLoading(!advice);
      setRefreshing(forceRegenerate);
      setError(null);
      try {
        const res = await fetch('/api/cfo/advice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ forceRegenerate }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message || 'Failed to load advice.');
        }
        setAdvice(json.data as AIAdviceDocument);
        // Clear any in-flight scenarios when a new doc arrives.
        if (forceRegenerate) {
          setScenarios({});
          setChatMessages([]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load advice.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, advice]
  );

  const fetchChatHistory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/cfo/advice/chat', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data?.messages)) {
        setChatMessages(json.data.messages as ChatMessage[]);
      }
    } catch {
      // Non-blocking; chat just starts empty.
    }
  }, [token]);

  useEffect(() => {
    fetchAdvice(false);
    fetchChatHistory();
    // Intentionally only re-run when token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const runScenario = useCallback(
    async (rec: AIAdviceRecommendation) => {
      if (!token || !rec.suggestedScenario) return;
      setScenarios((s) => ({ ...s, [rec.id]: { loading: true } }));
      try {
        const res = await fetch('/api/cfo/scenarios/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: rec.suggestedScenario.type,
            params: rec.suggestedScenario.params,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message || 'Could not run scenario.');
        }
        setScenarios((s) => ({
          ...s,
          [rec.id]: { loading: false, result: json.data as ScenarioResult },
        }));
      } catch (e) {
        setScenarios((s) => ({
          ...s,
          [rec.id]: {
            loading: false,
            error: e instanceof Error ? e.message : 'Scenario failed.',
          },
        }));
      }
    },
    [token]
  );

  const askFollowUp = useCallback((rec: AIAdviceRecommendation) => {
    setChatPrefill(`About "${rec.title}" — `);
    setChatOpen(true);
  }, []);

  const sendChat = useCallback(
    async (text: string) => {
      if (!token) return;
      const tempId = `tmp-${Date.now()}`;
      setChatMessages((m) => [
        ...m,
        { id: tempId, role: 'user', content: text, createdAt: new Date().toISOString() },
      ]);
      setChatSending(true);
      try {
        const res = await fetch('/api/cfo/advice/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: text }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json?.error?.message || 'Could not send message.');
        }
        setChatMessages((m) => [...m, json.data.message as ChatMessage]);
      } catch (e) {
        setChatMessages((m) => [
          ...m,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content: `Sorry — I couldn't reply just now. ${e instanceof Error ? e.message : ''}`.trim(),
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setChatSending(false);
        setChatPrefill(undefined);
      }
    },
    [token]
  );

  if (loading && !advice) {
    return <AdviceLoadingSkeleton />;
  }

  if (error && !advice) {
    return (
      <Card className="rounded-[28px] border-rose-400/30 bg-rose-500/5">
        <CardContent className="px-6 py-6 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!advice) return null;

  return (
    <section aria-label="AI Financial Advice" className="space-y-5">
      <AdviceHero
        advice={advice}
        isRefreshing={refreshing}
        onRefresh={() => fetchAdvice(true)}
      />

      {advice.recommendations.length === 0 ? (
        <Card className="rounded-[22px] border-foreground/10 bg-card/70 backdrop-blur-xl">
          <CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">
            No specific recommendations right now — your financial picture looks balanced.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {advice.recommendations.map((r, i) => (
            <AdviceRecommendationCard
              key={r.id}
              recommendation={r}
              index={i}
              onRunScenario={runScenario}
              onAskFollowUp={askFollowUp}
              scenarioState={scenarios[r.id] ?? { loading: false }}
            />
          ))}
        </div>
      )}

      {(advice.watchPoints.length > 0 || advice.questionsForUser.length > 0) && (
        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduced ? { duration: 0 } : { duration: 0.5, ease: appleEase, delay: 0.3 }}
          className="grid gap-4 lg:grid-cols-2"
        >
          {advice.watchPoints.length > 0 && (
            <Card className="rounded-[22px] border-foreground/10 bg-card/70 backdrop-blur-xl">
              <CardContent className="px-5 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-foreground/60" aria-hidden />
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Watch points
                  </h4>
                </div>
                <ul className="space-y-2 text-sm text-foreground/85">
                  {advice.watchPoints.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 leading-relaxed">
                      <span aria-hidden className="mt-1.5 h-1 w-1 flex-none rounded-full bg-foreground/50" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {advice.questionsForUser.length > 0 && (
            <Card className="rounded-[22px] border-foreground/10 bg-card/70 backdrop-blur-xl">
              <CardContent className="px-5 py-5">
                <div className="mb-3 flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-foreground/60" aria-hidden />
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Sharpen the advice
                  </h4>
                </div>
                <ul className="space-y-2 text-sm text-foreground/85">
                  {advice.questionsForUser.map((q, i) => (
                    <li
                      key={i}
                      className="cursor-pointer rounded-xl bg-foreground/[0.04] px-3 py-2 leading-relaxed transition-colors hover:bg-foreground/[0.08]"
                      onClick={() => {
                        setChatPrefill(q);
                        setChatOpen(true);
                      }}
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-background/60 px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur transition-colors hover:bg-foreground/[0.06]"
        >
          <Brain className="h-4 w-4" aria-hidden />
          Ask your Personal CFO
        </button>
      </div>

      <AdviceChatThread
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        isSending={chatSending}
        onSend={sendChat}
        prefilledMessage={chatPrefill}
      />
    </section>
  );
}

function AdviceLoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-[200px] animate-pulse rounded-[28px] bg-foreground/[0.04]" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[180px] animate-pulse rounded-[22px] bg-foreground/[0.04]" />
        ))}
      </div>
    </div>
  );
}
