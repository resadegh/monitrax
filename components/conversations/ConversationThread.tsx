'use client';

/**
 * Phase 32C PR4d — `<ConversationThread />`.
 *
 * Two-pane (header + scroll + composer) thread component that handles:
 *   - Initial fetch + 5s polling for new messages
 *   - Optimistic-add on send (rolled back on failure)
 *   - Channel badges (in-app vs. email-bridged) — small, monochrome,
 *     not screaming for attention. Auditors care; users mostly don't.
 *   - Read-receipt update on every fetch (`markAsRead=true`)
 *   - Scroll-to-bottom on new message + initial mount
 *   - Composer ⌘/Ctrl+Enter to send
 *   - prefers-reduced-motion-aware via Tailwind motion-safe:* utilities
 *
 * Caller passes the conversation id + viewer perspective ('consumer' or
 * 'professional') so the message bubbles align right/left correctly.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface Message {
  id: string;
  body: string;
  channel: 'IN_APP' | 'EMAIL_OUT' | 'EMAIL_IN' | 'SYSTEM';
  senderRole: 'CONSUMER' | 'PROFESSIONAL' | 'AI_HELPER';
  senderUserId: string | null;
  externalMessageId: string | null;
  inboundFromEmail: string | null;
  retentionUntil: string;
  createdAt: string;
}

interface Props {
  conversationId: string;
  viewerRole: 'CONSUMER' | 'PROFESSIONAL';
  viewerName: string;
  /** Display name shown for the OTHER side of the conversation. */
  counterpartyName: string;
  /** Conversation closed state — disables composer. */
  isClosed?: boolean;
  /** Called when a message has just been sent — caller can refresh
   *  conversation metadata (lastMessageAt, etc.) if needed. */
  onSent?: () => void;
}

const POLL_INTERVAL_MS = 5000;

export function ConversationThread({
  conversationId,
  viewerRole,
  viewerName,
  counterpartyName,
  isClosed = false,
  onSent,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const lastMessageAtRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchMessages = useCallback(
    async (since?: string) => {
      const params = new URLSearchParams();
      if (since) params.set('since', since);
      params.set('markAsRead', 'true');
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?${params.toString()}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load messages');
      }
      const json = await res.json();
      return (json.data?.messages ?? []) as Message[];
    },
    [conversationId],
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setInitialLoading(true);
    fetchMessages()
      .then((msgs) => {
        if (cancelled) return;
        setMessages(msgs);
        if (msgs.length > 0) lastMessageAtRef.current = msgs[msgs.length - 1].createdAt;
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchMessages]);

  // Poll for new messages
  useEffect(() => {
    const tick = async () => {
      try {
        const since = lastMessageAtRef.current;
        if (!since) return;
        const fresh = await fetchMessages(since);
        if (fresh.length > 0) {
          setMessages((prev) => [...prev, ...fresh]);
          lastMessageAtRef.current = fresh[fresh.length - 1].createdAt;
        }
      } catch {
        // Silent — next tick will retry
      }
    };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending || isClosed) return;
    setSending(true);
    setError(null);

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      body,
      channel: 'IN_APP',
      senderRole: viewerRole,
      senderUserId: null,
      externalMessageId: null,
      inboundFromEmail: null,
      retentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Send failed');
      // Replace optimistic with the real message from the server
      setMessages((prev) => prev.map((m) => (m.id === tempId ? (json.data.message as Message) : m)));
      lastMessageAtRef.current = (json.data.message as Message).createdAt;
      onSent?.();
    } catch (err) {
      // Roll back optimistic add
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      setError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }, [draft, sending, isClosed, viewerRole, conversationId, onSent]);

  return (
    <div className="flex flex-col h-[68vh] sm:h-[72vh] rounded-2xl bg-white ring-1 ring-slate-200/70 overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4"
      >
        {initialLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-14 max-w-[70%]" />
            ))}
          </div>
        )}

        {!initialLoading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-[13px] text-slate-500 text-center max-w-sm">
              No messages yet. {viewerRole === 'PROFESSIONAL' ? 'Send a welcome to get the engagement started.' : 'Wait for a response, or send a follow-up question.'}
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isViewer = msg.senderRole === viewerRole;
          return (
            <div
              key={msg.id}
              className={`flex ${isViewer ? 'justify-end' : 'justify-start'} motion-safe:animate-in motion-safe:fade-in duration-200`}
            >
              <div
                className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 ${
                  isViewer
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${
                  isViewer ? 'text-emerald-100' : 'text-slate-500'
                }`}>
                  <span className="tabular-nums">
                    {new Date(msg.createdAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.channel === 'EMAIL_OUT' && (
                    <span className="inline-flex items-center gap-0.5" title="Mirrored via email">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 3h8v6H2z M2 3l4 3 4-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      via email
                    </span>
                  )}
                  {msg.channel === 'EMAIL_IN' && (
                    <span className="inline-flex items-center gap-0.5" title={`Replied via email${msg.inboundFromEmail ? ` (${msg.inboundFromEmail})` : ''}`}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 3h8v6H2z M2 3l4 3 4-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      from email
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 px-3 py-3 bg-white">
        {error && (
          <div className="mb-2 rounded-lg bg-rose-50 ring-1 ring-rose-200 px-3 py-1.5 text-[12px] text-rose-700">
            {error}
          </div>
        )}
        {isClosed ? (
          <div className="text-center text-[12px] text-slate-500 py-2">
            This conversation is closed. Re-open it from the conversation menu to continue.
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              ref={composerRef}
              className="flex-1 rounded-xl border-0 bg-slate-50 py-2 px-3 text-[14px] text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-emerald-500 resize-none min-h-[44px] max-h-[160px] transition-shadow"
              placeholder={viewerRole === 'PROFESSIONAL' ? `Reply to ${counterpartyName}…` : `Message ${counterpartyName}…`}
              rows={1}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (composerRef.current) {
                  composerRef.current.style.height = 'auto';
                  composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 160)}px`;
                }
              }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={sending}
              maxLength={10_000}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || draft.trim().length === 0}
              className="inline-flex items-center justify-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              title="Send (⌘ + Enter)"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
        <p className="mt-2 text-[10px] text-slate-400 leading-snug">
          {viewerRole === 'PROFESSIONAL'
            ? `Replies are mirrored to ${counterpartyName} via email. ${viewerName} can reply from email and the response lands here.`
            : `Replies are mirrored from your professional via email. You can reply in-app or from your email; both land here.`}
          {' '}Conversation archived for 7 years for compliance.
        </p>
      </div>
    </div>
  );
}
