/**
 * Phase 33g — Adviser Feedback Inbox (write side).
 *
 * Master-detail layout. Left: list of the adviser's own threads. Right:
 * selected thread + reply box, OR the "new feedback" form when nothing is
 * selected. The new-thread form auto-fills `surfaceRoute` from the
 * `?route=` query param (set by the help-drawer footer link) so the
 * adviser doesn't have to remember where they were.
 *
 * Dismiss-via-X back to the inbox. URL `/portal/feedback?id=<threadId>`
 * deep-links to a thread.
 */
'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { useOrganization } from '@/lib/portal';
import { PracticeGlassCard } from '@/components/portal/practice/PracticeGlassCard';

type SurfaceTag = 'BUG' | 'FEATURE' | 'UX' | 'PRAISE' | 'QUESTION' | 'COMPLIANCE';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
type Status = 'OPEN' | 'IN_REVIEW' | 'PLANNED' | 'SHIPPED' | 'WONT_FIX' | 'DUPLICATE';

interface ThreadSummary {
  id: string;
  subject: string;
  surfaceRoute: string | null;
  surfaceTag: SurfaceTag;
  severity: Severity;
  status: Status;
  createdAt: string;
  updatedAt: string;
  organizationId: string | null;
  messages: Array<{
    id: string;
    authorRole: 'ADVISER' | 'MONITRAX_ADMIN';
    body: string;
    createdAt: string;
  }>;
}

const TAG_OPTIONS: Array<{ value: SurfaceTag; label: string; hint: string }> = [
  { value: 'BUG', label: 'Bug', hint: 'Something that should work but doesn’t' },
  { value: 'FEATURE', label: 'Feature', hint: 'Wishlist / enhancement' },
  { value: 'UX', label: 'UX', hint: 'Friction or clarity concern' },
  { value: 'QUESTION', label: 'Question', hint: 'Genuine question' },
  { value: 'PRAISE', label: 'Praise', hint: 'What’s working' },
  { value: 'COMPLIANCE', label: 'Compliance', hint: 'CDR / AFSL / TPB / privacy concern' },
];

const STATUS_LABEL: Record<Status, string> = {
  OPEN: 'Open',
  IN_REVIEW: 'In review',
  PLANNED: 'Planned',
  SHIPPED: 'Shipped',
  WONT_FIX: 'Won’t fix',
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

const SEVERITY_TONE: Record<Severity, string> = {
  LOW: 'text-slate-500',
  MEDIUM: 'text-amber-600',
  HIGH: 'text-rose-600',
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

export default function AdviserFeedbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params?.get('id') ?? null;
  const initialRoute = params?.get('route') ?? null;
  const { token } = useAuth();
  const { currentOrg } = useOrganization();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [token]);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/feedback', { headers, cache: 'no-store' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = (await res.json()) as { data: { threads: ThreadSummary[] } };
      setThreads(json.data.threads);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!token) return;
    void fetchThreads();
  }, [fetchThreads, token]);

  const selected = selectedId ? threads.find((t) => t.id === selectedId) ?? null : null;

  return (
    <div className="min-h-screen px-5 sm:px-8 lg:px-12 py-8 lg:py-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-700">
            Feedback
          </p>
          <h1 className="mt-0.5 text-2xl sm:text-[28px] font-semibold tracking-tight text-slate-900">
            Tell us what would make Monitrax better.
          </h1>
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">
            Bugs, friction, wishlist, praise — all of it lands in one inbox. We aim for a first reply
            within 48 hours, every time.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* List column */}
          <aside className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                Your threads
              </p>
              <Link
                href="/portal/feedback"
                className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
              >
                + New
              </Link>
            </div>
            {loading && (
              <div className="text-sm text-slate-500 py-4">Loading…</div>
            )}
            {error && (
              <div className="rounded-2xl bg-rose-50 ring-1 ring-rose-200/70 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            )}
            {!loading && !error && threads.length === 0 && (
              <div className="rounded-2xl bg-white/70 ring-1 ring-slate-900/[0.06] px-4 py-5 text-sm text-slate-500">
                You haven’t submitted any feedback yet. Use the form on the right to start a thread.
              </div>
            )}
            {threads.map((t) => {
              const isActive = t.id === selectedId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/portal/feedback?id=${t.id}`)}
                  className={`
                    w-full text-left rounded-[20px] px-4 py-3
                    transition-[transform,box-shadow] duration-200 ease-out
                    ring-1
                    ${isActive
                      ? 'bg-white ring-emerald-300/70 shadow-[0_4px_14px_-6px_rgba(11,18,32,0.18)]'
                      : 'bg-white/85 ring-slate-900/[0.06] hover:-translate-y-0.5 hover:shadow-[0_4px_14px_-6px_rgba(11,18,32,0.18)] motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-900 leading-snug line-clamp-2">
                      {t.subject}
                    </p>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full ring-1 ring-inset px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] ${STATUS_TONE[t.status]}`}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                    {t.surfaceTag}
                    <span className={`ml-2 ${SEVERITY_TONE[t.severity]}`}>{t.severity}</span>
                    <span className="ml-2 text-slate-400">· {relTime(t.updatedAt)}</span>
                  </p>
                </button>
              );
            })}
          </aside>

          {/* Detail column */}
          <section>
            {selected ? (
              <ThreadDetail
                thread={selected}
                token={token}
                onReply={fetchThreads}
              />
            ) : (
              <NewThreadForm
                token={token}
                organizationId={currentOrg?.id ?? null}
                initialSurfaceRoute={initialRoute}
                onCreated={(newId) => {
                  void fetchThreads();
                  router.push(`/portal/feedback?id=${newId}`);
                }}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function NewThreadForm({
  token,
  organizationId,
  initialSurfaceRoute,
  onCreated,
}: {
  token: string | null;
  organizationId: string | null;
  initialSurfaceRoute: string | null;
  onCreated: (threadId: string) => void;
}) {
  const [subject, setSubject] = useState('');
  const [surfaceTag, setSurfaceTag] = useState<SurfaceTag>('FEATURE');
  const [severity, setSeverity] = useState<Severity>('MEDIUM');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const submitHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) submitHeaders['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/portal/feedback', {
        method: 'POST',
        headers: submitHeaders,
        body: JSON.stringify({
          subject,
          body,
          surfaceTag,
          severity,
          surfaceRoute: initialSurfaceRoute,
          organizationId,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as Record<string, unknown>));
        const errObj = (errBody as { error?: { message?: string } }).error;
        throw new Error(errObj?.message ?? `Request failed (${res.status})`);
      }
      const json = (await res.json()) as { data: { threadId: string } };
      setSubject('');
      setBody('');
      onCreated(json.data.threadId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PracticeGlassCard padding="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Send feedback</h2>
          <p className="mt-1 text-xs text-slate-500">
            If you reference a specific client, please use a non-identifying tag like “Client A”
            — conversation contents are subject to retention rules. For formal complaints,
            escalate via Settings → Support.
          </p>
        </div>

        {initialSurfaceRoute && (
          <div className="text-[11px] text-slate-500 bg-slate-50 ring-1 ring-slate-200/70 rounded-lg px-3 py-2">
            About this surface: <code className="text-slate-700">{initialSurfaceRoute}</code>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={140}
            required
            placeholder="One line about what’s on your mind"
            className="w-full rounded-xl bg-white ring-1 ring-slate-900/[0.08] px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Tag</label>
            <select
              value={surfaceTag}
              onChange={(e) => setSurfaceTag(e.target.value as SurfaceTag)}
              className="w-full rounded-xl bg-white ring-1 ring-slate-900/[0.08] px-3 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              {TAG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as Severity)}
              className="w-full rounded-xl bg-white ring-1 ring-slate-900/[0.08] px-3 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">Details</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={8}
            placeholder="What happened, what did you expect, and what would good look like?"
            className="w-full rounded-xl bg-white ring-1 ring-slate-900/[0.08] px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 resize-y"
          />
          <p className="mt-1.5 text-[11px] text-slate-400">
            Markdown supported. Code in backticks, links as [text](url).
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200/70 px-3 py-2 text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            We aim to reply within 48 hours.
          </p>
          <button
            type="submit"
            disabled={submitting || !subject || !body}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white ring-1 ring-slate-900 transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      </form>
    </PracticeGlassCard>
  );
}

function ThreadDetail({
  thread,
  token,
  onReply,
}: {
  thread: ThreadSummary;
  token: string | null;
  onReply: () => void | Promise<void>;
}) {
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const replyHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) replyHeaders['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/portal/feedback/${thread.id}/reply`, {
        method: 'POST',
        headers: replyHeaders,
        body: JSON.stringify({ body: reply }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setReply('');
      await onReply();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PracticeGlassCard padding="lg">
      <header className="border-b border-slate-200/70 pb-4 mb-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">
            {thread.subject}
          </h2>
          <span
            className={`shrink-0 inline-flex items-center rounded-full ring-1 ring-inset px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${STATUS_TONE[thread.status]}`}
          >
            {STATUS_LABEL[thread.status]}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.08em] text-slate-500">
          {thread.surfaceTag} · <span className={SEVERITY_TONE[thread.severity]}>{thread.severity}</span>
          {thread.surfaceRoute && (
            <span className="ml-2 text-slate-400">about <code className="text-slate-600">{thread.surfaceRoute}</code></span>
          )}
        </p>
      </header>

      <div className="space-y-4 mb-5">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl px-4 py-3 ring-1 ${
              m.authorRole === 'ADVISER'
                ? 'bg-white ring-slate-900/[0.06]'
                : 'bg-emerald-50/60 ring-emerald-200/60'
            }`}
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-slate-500 mb-1">
              {m.authorRole === 'ADVISER' ? 'You' : 'Monitrax'} · {relTime(m.createdAt)}
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{m.body}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleReply} className="space-y-3 border-t border-slate-200/70 pt-5">
        <label className="block text-xs font-medium text-slate-700">Add a reply</label>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={4}
          placeholder="Anything to add?"
          className="w-full rounded-xl bg-white ring-1 ring-slate-900/[0.08] px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 resize-y"
        />
        {error && (
          <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200/70 px-3 py-2 text-xs text-rose-800">
            {error}
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !reply.trim()}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white ring-1 ring-slate-900 transition-colors hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      </form>
    </PracticeGlassCard>
  );
}
