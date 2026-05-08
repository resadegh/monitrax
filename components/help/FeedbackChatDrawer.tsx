/**
 * FeedbackChatDrawer — chat-style feedback UI for consumers (Phase 33g.2).
 *
 * Two behaviour modes, decided server-side via /api/portal/feedback/ai-status:
 *
 * 1. **AI on** (`ANTHROPIC_API_KEY` present in Vercel env):
 *    - User types first message + tag/severity → thread is created → AI
 *      replies in real-time, asks clarifying questions for 2–5 turns,
 *      then summarises and tells the user it's been passed to Reza.
 *    - User can keep typing after the AI summary; messages still land in
 *      the thread for Reza to read in /admin/feedback.
 *
 * 2. **AI off** (key absent):
 *    - Same UI shape — user types, taps send.
 *    - No AI reply appears; instead a friendly success message confirms
 *      "thanks, Reza will reply by email when ready." Same thread shape;
 *      same /admin/feedback inbox row.
 *
 * Same drawer mechanics as Phase 33b HelpDrawer:
 *   - Right-edge slide-in on ≥md, bottom-sheet on <md.
 *   - Esc / X / backdrop / route change all dismiss.
 *   - Body-scroll lock for iOS Safari.
 *   - prefers-reduced-motion-aware.
 *
 * Design language: PracticeGlassCard / HelpDrawer warm-ivory glass.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { X, Send, Sparkles, ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

type SurfaceTag = 'BUG' | 'FEATURE' | 'UX' | 'PRAISE' | 'QUESTION' | 'COMPLIANCE';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
type Status = 'OPEN' | 'IN_REVIEW' | 'PLANNED' | 'SHIPPED' | 'WONT_FIX' | 'DUPLICATE';

interface ChatMessage {
  id: string;
  role: 'user' | 'monitrax' | 'ai';
  body: string;
  createdAt: string;
}

/**
 * Phase 33g.3 (2026-05-12): Consumer drawer becomes a three-view state
 * machine — `list` (the user's prior threads), `new` (compose a new thread),
 * `thread` (read + reply on a specific thread). When the drawer opens, we
 * fetch the user's existing threads via the existing `GET /api/portal/feedback`
 * endpoint (already scopes to caller's own userId) and default to:
 *   - `list` if any threads exist
 *   - `new` otherwise (first-time + after-delete state)
 */
type DrawerView = 'list' | 'new' | 'thread';

interface ThreadSummary {
  id: string;
  subject: string;
  status: Status;
  surfaceTag: SurfaceTag;
  surfaceRoute: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    authorRole: 'ADVISER' | 'CONSUMER' | 'MONITRAX_ADMIN' | 'CLAUDE_AI';
    body: string;
    createdAt: string;
  }>;
}

const STATUS_LABEL: Record<Status, string> = {
  OPEN: 'Open',
  IN_REVIEW: 'In review',
  PLANNED: 'Planned',
  SHIPPED: 'Shipped',
  WONT_FIX: "Won't fix",
  DUPLICATE: 'Duplicate',
};

const STATUS_TONE: Record<Status, string> = {
  OPEN: 'bg-amber-50 text-amber-700 ring-amber-200/70',
  IN_REVIEW: 'bg-sky-50 text-sky-700 ring-sky-200/70',
  PLANNED: 'bg-violet-50 text-violet-700 ring-violet-200/70',
  SHIPPED: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  WONT_FIX: 'bg-slate-100 text-slate-600 ring-slate-300/70',
  DUPLICATE: 'bg-slate-100 text-slate-600 ring-slate-300/70',
};

/** Phase 33g.4: closed states that disable the composer + show a banner. */
const CLOSED_STATUSES: Status[] = ['SHIPPED', 'WONT_FIX', 'DUPLICATE'];
const isThreadClosed = (s: Status | null): boolean =>
  s !== null && CLOSED_STATUSES.includes(s);

const CLOSED_MESSAGE: Record<'SHIPPED' | 'WONT_FIX' | 'DUPLICATE', string> = {
  SHIPPED: 'This is shipped — your feedback led to a change that\'s now live. Thanks for raising it. Start a new thread anytime.',
  WONT_FIX: 'Reza closed this without a fix. Reasoning is in the conversation above. Start a new thread if your situation changes.',
  DUPLICATE: 'Closed as a duplicate. Reza\'s reply above points to the canonical thread. Start a new thread for unrelated feedback.',
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface FeedbackChatDrawerProps {
  open: boolean;
  onClose: () => void;
  /**
   * Phase 33g.5: thread IDs the user hasn't seen since their last
   * drawer-open. Used to render a small red dot on each row in the
   * Your-threads list. Source: `useUnreadFeedback()`.
   */
  unreadThreadIds?: Set<string>;
}

const TAG_OPTIONS: Array<{ value: SurfaceTag; label: string }> = [
  { value: 'BUG', label: 'Bug — something broken' },
  { value: 'FEATURE', label: 'Feature — wishlist' },
  { value: 'UX', label: 'UX — friction or unclear' },
  { value: 'QUESTION', label: 'Question' },
  { value: 'PRAISE', label: "Praise — what's working" },
  { value: 'COMPLIANCE', label: 'Compliance / privacy concern' },
];

function mapAuthorRole(role: ThreadSummary['messages'][number]['authorRole']): ChatMessage['role'] {
  if (role === 'CLAUDE_AI') return 'ai';
  if (role === 'MONITRAX_ADMIN') return 'monitrax';
  return 'user'; // ADVISER + CONSUMER both render as the user's own message
}

export function FeedbackChatDrawer({ open, onClose, unreadThreadIds }: FeedbackChatDrawerProps) {
  const pathname = usePathname();
  const { token } = useAuth();
  const [view, setView] = useState<DrawerView>('list');
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadStatus, setThreadStatus] = useState<Status | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [surfaceTag, setSurfaceTag] = useState<SurfaceTag>('FEATURE');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const closeAndReset = useCallback(() => {
    onClose();
    setView('list');
    setThreadId(null);
    setThreadStatus(null);
    setMessages([]);
    setDraft('');
    setSubject('');
    setSurfaceTag('FEATURE');
    setSeverity('MEDIUM');
    setError(null);
    setDone(false);
    setThreadsLoaded(false);
  }, [onClose]);

  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [token]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAndReset();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeAndReset]);

  // Body-scroll lock on open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Fetch AI-enabled status on first open
  useEffect(() => {
    if (!open || aiEnabled !== null || !token) return;
    fetch('/api/portal/feedback/ai-status', { headers, cache: 'no-store' })
      .then(async (res) => (res.ok ? (await res.json()) : { data: { aiEnabled: false } }))
      .then((j) => setAiEnabled(Boolean(j?.data?.aiEnabled)))
      .catch(() => setAiEnabled(false));
  }, [open, aiEnabled, headers, token]);

  // Fetch user's prior threads on first open. Sets default view: `list` if
  // user has any threads; `new` otherwise. Re-fetches after a thread is
  // created so the list updates without a full drawer reset.
  const fetchThreads = useCallback(async (): Promise<ThreadSummary[]> => {
    if (!token) return [];
    try {
      const res = await fetch('/api/portal/feedback', { headers, cache: 'no-store' });
      if (!res.ok) return [];
      const j = (await res.json()) as { data: { threads: ThreadSummary[] } };
      const list = j.data.threads ?? [];
      setThreads(list);
      return list;
    } catch {
      return [];
    }
  }, [headers, token]);

  useEffect(() => {
    if (!open || threadsLoaded || !token) return;
    void fetchThreads().then((list) => {
      setThreadsLoaded(true);
      setView(list.length > 0 ? 'list' : 'new');
    });
  }, [open, threadsLoaded, token, fetchThreads]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Phase 33g.4: light polling while drawer is in `thread` view so the
  // consumer sees Reza's reply or a status change without closing +
  // reopening the drawer. Polls every 8s; clears on view change or close.
  // Skips while a submit is in-flight (the existing pollForAiReply path
  // is already polling; we avoid stepping on it).
  useEffect(() => {
    if (!open || view !== 'thread' || !threadId || !token) return;
    const tick = async () => {
      if (submitting) return;
      try {
        const res = await fetch(`/api/portal/feedback/${threadId}`, { headers, cache: 'no-store' });
        if (!res.ok) return;
        const j = (await res.json()) as {
          data: {
            thread: {
              status: Status;
              messages: Array<{ id: string; authorRole: string; body: string; createdAt: string }>;
            };
          };
        };
        const incoming = j.data.thread.messages;
        // Update status if it changed (admin marked SHIPPED / WONT_FIX / etc.)
        setThreadStatus((prev) => (prev !== j.data.thread.status ? j.data.thread.status : prev));
        // Merge any messages whose IDs we don't already have. Skip pure-local
        // optimistic IDs (`local-*`) — those are placeholders waiting for
        // the server-issued ID; they get replaced on the user's next refresh.
        setMessages((prev) => {
          const known = new Set(prev.filter((m) => !m.id.startsWith('local-')).map((m) => m.id));
          const additions = incoming
            .filter((m) => !known.has(m.id) && !prev.some((p) => p.id === m.id))
            .map((m) => ({
              id: m.id,
              role: mapAuthorRole(m.authorRole as ThreadSummary['messages'][number]['authorRole']),
              body: m.body,
              createdAt: m.createdAt,
            }));
          return additions.length ? [...prev, ...additions] : prev;
        });
      } catch {
        // ignore polling errors
      }
    };
    const interval = setInterval(tick, 8000);
    return () => clearInterval(interval);
  }, [open, view, threadId, submitting, headers, token]);

  // Open a specific thread from the list.
  const openThread = (t: ThreadSummary) => {
    setThreadId(t.id);
    setThreadStatus(t.status);
    setSubject(t.subject);
    setSurfaceTag(t.surfaceTag);
    setMessages(t.messages.map((m) => ({
      id: m.id,
      role: mapAuthorRole(m.authorRole),
      body: m.body,
      createdAt: m.createdAt,
    })));
    setDone(false);
    setError(null);
    setView('thread');
  };

  // Back to the list view from inside a thread or from new-thread.
  const backToList = () => {
    setThreadId(null);
    setThreadStatus(null);
    setMessages([]);
    setDraft('');
    setSubject('');
    setSurfaceTag('FEATURE');
    setSeverity('MEDIUM');
    setError(null);
    setDone(false);
    setView('list');
    void fetchThreads();
  };

  const startNewThread = () => {
    setThreadId(null);
    setThreadStatus(null);
    setMessages([]);
    setDraft('');
    setSubject('');
    setSurfaceTag('FEATURE');
    setSeverity('MEDIUM');
    setError(null);
    setDone(false);
    setView('new');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!threadId) {
        // First message — create the thread.
        const subjectToUse = subject.trim() || draft.trim().slice(0, 80);
        const res = await fetch('/api/portal/feedback', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            subject: subjectToUse,
            body: draft.trim(),
            surfaceTag,
            severity,
            surfaceRoute: pathname,
            authorRole: 'CONSUMER',
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error?.message ?? `Failed (${res.status})`);
        }
        const j = (await res.json()) as { data: { threadId: string } };
        const newThreadId = j.data.threadId;
        setThreadId(newThreadId);
        setThreadStatus('OPEN');
        setMessages([
          {
            id: `local-${Date.now()}`,
            role: 'user',
            body: draft.trim(),
            createdAt: new Date().toISOString(),
          },
        ]);
        setDraft('');
        // Phase 33g.3: switch to thread view so the user sees the chat
        // unfold (was: stayed on `new` view which awkwardly kept the
        // metadata pickers visible after submit).
        setView('thread');
        // Refresh the user's thread list silently so when they hit
        // "Back to threads" later, the new thread is included.
        void fetchThreads();
        // Poll for AI reply if enabled.
        if (aiEnabled) {
          void pollForAiReply(newThreadId);
        } else {
          setDone(true);
        }
      } else {
        // Subsequent reply on existing thread.
        const res = await fetch(`/api/portal/feedback/${threadId}/reply`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ body: draft.trim() }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.error?.message ?? `Failed (${res.status})`);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            role: 'user',
            body: draft.trim(),
            createdAt: new Date().toISOString(),
          },
        ]);
        setDraft('');
        if (aiEnabled) {
          void pollForAiReply(threadId);
        } else {
          setDone(true);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSubmitting(false);
    }
  };

  // Poll the thread up to 6× over ~12s for an AI reply that didn't exist
  // a moment ago. Background AI response is fire-and-forget on the server,
  // so we wait briefly for it to land. If nothing arrives, we silently
  // give up — the user sees their message; Reza picks up via /admin/feedback.
  const pollForAiReply = async (id: string) => {
    let knownIds = new Set<string>(messages.map((m) => m.id));
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(`/api/portal/feedback/${id}`, { headers, cache: 'no-store' });
        if (!res.ok) continue;
        const j = (await res.json()) as { data: { thread: { messages: Array<{ id: string; authorRole: string; body: string; createdAt: string }> } } };
        const incoming = j.data.thread.messages
          .filter((m) => !knownIds.has(m.id))
          .map((m) => ({
            id: m.id,
            role: (m.authorRole === 'CLAUDE_AI'
              ? 'ai'
              : m.authorRole === 'MONITRAX_ADMIN'
                ? 'monitrax'
                : 'user') as ChatMessage['role'],
            body: m.body,
            createdAt: m.createdAt,
          }));
        if (incoming.length > 0) {
          setMessages((prev) => [...prev, ...incoming]);
          incoming.forEach((m) => knownIds.add(m.id));
          // Stop polling once we get an AI reply.
          const gotAi = incoming.some((m) => m.role === 'ai');
          if (gotAi) return;
        }
      } catch {
        // ignore polling errors
      }
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeAndReset}
        className={`
          fixed inset-0 z-[60]
          bg-slate-900/30 backdrop-blur-[2px]
          transition-opacity duration-200 ease-out motion-reduce:transition-none
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Send feedback"
        className={`
          fixed z-[70]
          bg-[#fbf8f1] ring-1 ring-slate-900/[0.06]
          shadow-[0_-12px_40px_-12px_rgba(11,18,32,0.25)] md:shadow-[-12px_0_40px_-12px_rgba(11,18,32,0.25)]

          left-0 right-0 bottom-0 top-auto
          h-[85vh] rounded-t-[28px]

          md:left-auto md:right-0 md:top-0 md:bottom-0
          md:h-full md:w-[480px] md:max-w-[92vw] md:rounded-none md:rounded-l-[22px]

          flex flex-col

          transition-transform duration-200 ease-out motion-reduce:transition-none
          ${open
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full'
          }
        `}
      >
        {/* Mobile drag-handle visual */}
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <span className="block h-1 w-10 rounded-full bg-slate-300/80" aria-hidden="true" />
        </div>

        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-4 pb-3 border-b border-slate-200/70">
          <div className="min-w-0 flex items-start gap-2">
            {(view === 'thread' || (view === 'new' && threads.length > 0)) && (
              <button
                type="button"
                onClick={backToList}
                aria-label="Back to your threads"
                className="
                  shrink-0 inline-flex items-center justify-center
                  h-7 w-7 rounded-full -mt-0.5
                  text-slate-500 hover:text-slate-900 hover:bg-slate-100
                  transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
                "
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-700">
                {view === 'list' ? 'Your feedback' : 'Send feedback'}
              </p>
              <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight text-slate-900 truncate">
                {view === 'list'
                  ? 'Your previous threads'
                  : view === 'thread'
                    ? subject || 'Your feedback'
                    : "What's on your mind?"}
              </h2>
              {/* Phase 33g.4: status chip in thread-view header so the
                  consumer sees Reza's triage state at a glance. */}
              {view === 'thread' && threadStatus && (
                <span className={`mt-1 inline-flex items-center rounded-full ring-1 ring-inset px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] ${STATUS_TONE[threadStatus]}`}>
                  {STATUS_LABEL[threadStatus]}
                </span>
              )}
              {view === 'new' && (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {aiEnabled === null
                    ? '…'
                    : aiEnabled
                      ? 'AI will reply with clarifying questions before passing it to Reza.'
                      : "We'll reply within 48 hours, every time."}
                </p>
              )}
              {view === 'list' && (
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Pick a thread to continue, or start a new one.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={closeAndReset}
            aria-label="Close feedback drawer"
            className="
              shrink-0 inline-flex items-center justify-center
              h-8 w-8 rounded-full
              text-slate-500 hover:text-slate-900 hover:bg-slate-100
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
            "
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-3">
          {/* LIST VIEW — user's prior threads */}
          {view === 'list' && (
            <>
              {threads.length === 0 ? (
                <div className="rounded-2xl bg-white/70 ring-1 ring-slate-900/[0.06] px-4 py-5 text-sm text-slate-500">
                  You haven't sent any feedback yet. Tap "+ New" below to start.
                </div>
              ) : (
                <ul className="space-y-2">
                  {threads.map((t) => {
                    const last = t.messages[t.messages.length - 1];
                    const lastIsAi = last?.authorRole === 'CLAUDE_AI';
                    const lastIsAdmin = last?.authorRole === 'MONITRAX_ADMIN';
                    const isUnread = unreadThreadIds?.has(t.id) ?? false;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => openThread(t)}
                          className={`
                            w-full text-left rounded-2xl px-4 py-3
                            ring-1
                            transition-[transform,box-shadow] duration-200 ease-out
                            hover:-translate-y-0.5 hover:shadow-[0_4px_14px_-6px_rgba(11,18,32,0.18)]
                            motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
                            ${isUnread ? 'bg-rose-50/40 ring-rose-200/60' : 'bg-white/85 ring-slate-900/[0.06]'}
                          `}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              {/* Phase 33g.5: unread dot — appears when admin/AI replied since last drawer-open */}
                              {isUnread && (
                                <span
                                  aria-hidden="true"
                                  className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-rose-500"
                                />
                              )}
                              <p className="text-[13px] font-semibold text-slate-900 leading-snug line-clamp-2">
                                {t.subject}
                              </p>
                            </div>
                            <span className={`shrink-0 inline-flex items-center rounded-full ring-1 ring-inset px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] ${STATUS_TONE[t.status]}`}>
                              {STATUS_LABEL[t.status]}
                            </span>
                          </div>
                          {last && (
                            <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                              {lastIsAi ? '✨ Monitrax AI: ' : lastIsAdmin ? 'Monitrax: ' : 'You: '}
                              {last.body}
                            </p>
                          )}
                          <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                            {t.surfaceTag} · {relTime(t.updatedAt)}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button
                type="button"
                onClick={startNewThread}
                className="
                  w-full inline-flex items-center justify-center gap-1.5
                  rounded-full bg-slate-900 text-white
                  px-4 py-2 text-sm font-medium
                  hover:bg-slate-800 transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
                "
              >
                <Plus className="h-4 w-4" />
                New thread
              </button>
            </>
          )}

          {/* NEW VIEW — pre-thread metadata pickers + form */}
          {view === 'new' && (
            <>
              {/* Pre-thread metadata pickers — collapse once thread is started */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 mb-1.5">
                    Subject (optional)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={140}
                    placeholder="A short title — we'll use the first line of your message if blank"
                    className="
                      w-full rounded-xl bg-white ring-1 ring-slate-900/[0.08]
                      px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
                    "
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 mb-1.5">
                      Tag
                    </label>
                    <select
                      value={surfaceTag}
                      onChange={(e) => setSurfaceTag(e.target.value as SurfaceTag)}
                      className="
                        w-full rounded-xl bg-white ring-1 ring-slate-900/[0.08]
                        px-3 py-2 text-sm text-slate-800
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
                      "
                    >
                      {TAG_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 mb-1.5">
                      Severity
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as Severity)}
                      className="
                        w-full rounded-xl bg-white ring-1 ring-slate-900/[0.08]
                        px-3 py-2 text-sm text-slate-800
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
                      "
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 px-1 pt-1">
                If you reference a specific person or balance, please use a non-identifying
                tag like "Client A" — feedback contents are subject to retention rules.
              </p>
            </>
          )}

          {/* THREAD VIEW — conversation only */}
          {view === 'thread' && messages.map((m) => (
            <div key={m.id}>
              {m.role === 'user' && (
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 text-white px-4 py-2.5 shadow-[0_4px_14px_-6px_rgba(11,18,32,0.18)]">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              )}
              {m.role === 'ai' && (
                <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-emerald-50/80 ring-1 ring-emerald-200/60 px-4 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-700 mb-1 inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Monitrax AI
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              )}
              {m.role === 'monitrax' && (
                <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-white ring-1 ring-slate-900/[0.06] px-4 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500 mb-1">
                    Monitrax
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              )}
            </div>
          ))}

          {view === 'thread' && submitting && aiEnabled && (
            <div className="mr-auto max-w-[60%] rounded-2xl rounded-bl-sm bg-emerald-50/60 ring-1 ring-emerald-200/40 px-4 py-2.5">
              <p className="text-xs text-emerald-700 inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 animate-pulse" /> Monitrax AI is typing…
              </p>
            </div>
          )}

          {/* Phase 33g.4: closed-state banner. Composer below is also disabled. */}
          {view === 'thread' && threadStatus && isThreadClosed(threadStatus) && (
            <div className="rounded-2xl bg-slate-100 ring-1 ring-slate-300/70 px-4 py-3 text-sm text-slate-700">
              {CLOSED_MESSAGE[threadStatus as 'SHIPPED' | 'WONT_FIX' | 'DUPLICATE']}
            </div>
          )}

          {view === 'thread' && done && !aiEnabled && (
            <div className="rounded-2xl bg-emerald-50/60 ring-1 ring-emerald-200/60 px-4 py-3 text-sm text-emerald-800">
              Thanks — your feedback is in. Reza aims to reply within 48 hours.
              You can close this drawer or keep adding detail below.
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200/70 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}
        </div>

        {/* Composer — hidden on the list view (no draft to submit there).
             Phase 33g.4: also disabled when the thread is closed
             (SHIPPED/WONT_FIX/DUPLICATE) — banner above tells the user
             why; the consumer's path forward is "+ New thread". */}
        {view !== 'list' && (
        <form onSubmit={handleSubmit} className="border-t border-slate-200/70 bg-white/60 px-4 sm:px-5 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              disabled={view === 'thread' && isThreadClosed(threadStatus)}
              placeholder={
                view === 'thread' && isThreadClosed(threadStatus)
                  ? 'This thread is closed. Start a new one to continue.'
                  : threadId
                    ? 'Add another message…'
                    : 'Type your feedback here…'
              }
              className="
                flex-1 resize-none rounded-xl bg-white ring-1 ring-slate-900/[0.08]
                px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
                disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
              "
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  void handleSubmit(e as unknown as FormEvent);
                }
              }}
            />
            <button
              type="submit"
              disabled={submitting || !draft.trim() || (view === 'thread' && isThreadClosed(threadStatus))}
              aria-label="Send"
              className="
                inline-flex items-center justify-center
                h-9 w-9 rounded-full
                bg-slate-900 text-white
                hover:bg-slate-800
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
              "
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            ⌘/Ctrl + Enter to send
          </p>
        </form>
        )}
      </aside>
    </>
  );
}
