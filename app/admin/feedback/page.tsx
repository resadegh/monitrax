'use client';

/**
 * Phase 33g — Admin (Reza) Feedback Inbox.
 *
 * Single-page master-detail. Filters: status, surface tag, severity. Detail
 * pane: full thread + reply box + status flipper + internal notes textarea
 * + tag-for-AI toggle + Markdown export trigger.
 *
 * Auth: every fetch sends the same Firebase ID token used by the consumer
 * surface (admins authenticate via the same Identity Platform flow); the
 * admin-side API routes call `verifyAdminGCPAuth` which checks the
 * `monitraxAdmin` custom claim on top of standard token verification.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';

type SurfaceTag = 'BUG' | 'FEATURE' | 'UX' | 'PRAISE' | 'QUESTION' | 'COMPLIANCE';
type Severity = 'LOW' | 'MEDIUM' | 'HIGH';
type Status = 'OPEN' | 'IN_REVIEW' | 'PLANNED' | 'SHIPPED' | 'WONT_FIX' | 'DUPLICATE';

interface ThreadListItem {
  id: string;
  subject: string;
  surfaceTag: SurfaceTag;
  severity: Severity;
  status: Status;
  surfaceRoute: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
  organization: { id: string; name: string } | null;
  _count: { messages: number };
}

interface ThreadDetail extends Omit<ThreadListItem, '_count'> {
  internalNotes: string | null;
  taggedForAi: boolean;
  aiDisabled: boolean;
  lastReviewedAt: string | null;
  messages: Array<{
    id: string;
    authorRole: 'ADVISER' | 'CONSUMER' | 'MONITRAX_ADMIN' | 'CLAUDE_AI';
    body: string;
    createdAt: string;
    author: { id: string; name: string; email: string };
  }>;
}

const STATUSES: Status[] = ['OPEN', 'IN_REVIEW', 'PLANNED', 'SHIPPED', 'WONT_FIX', 'DUPLICATE'];
const STATUS_LABEL: Record<Status, string> = {
  OPEN: 'Open',
  IN_REVIEW: 'In review',
  PLANNED: 'Planned',
  SHIPPED: 'Shipped',
  WONT_FIX: 'Won’t fix',
  DUPLICATE: 'Duplicate',
};

const STATUS_TONE: Record<Status, string> = {
  OPEN: 'bg-amber-50 text-amber-700 border-amber-200',
  IN_REVIEW: 'bg-sky-50 text-sky-700 border-sky-200',
  PLANNED: 'bg-violet-50 text-violet-700 border-violet-200',
  SHIPPED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  WONT_FIX: 'bg-gray-100 text-gray-600 border-gray-300',
  DUPLICATE: 'bg-gray-100 text-gray-600 border-gray-300',
};

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function AdminFeedbackPage() {
  const { token } = useAuth();
  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = {};
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [token]);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const url = statusFilter
      ? `/api/admin/feedback?status=${statusFilter}`
      : '/api/admin/feedback';
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as { data: { threads: ThreadListItem[] } };
      setThreads(json.data.threads);
    }
    setLoading(false);
  }, [headers, statusFilter, token]);

  const fetchDetail = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/feedback/${id}`, { headers, cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { data: { thread: ThreadDetail } };
        setDetail(json.data.thread);
      }
    },
    [headers],
  );

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (selectedId) void fetchDetail(selectedId);
    else setDetail(null);
  }, [fetchDetail, selectedId]);

  const handleExport = async (taggedOnly: boolean) => {
    setExporting(true);
    try {
      const url = `/api/admin/feedback/export${taggedOnly ? '?taggedOnly=true' : ''}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `monitrax-feedback-${new Date().toISOString().slice(0, 10)}${
        taggedOnly ? '-tagged' : ''
      }.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="Adviser Feedback"
        description="Async inbox from advisers + pilot users. Reply, triage, tag for AI synthesis."
        action={
          <div className="flex gap-2">
            <AdminButton variant="outline" onClick={() => void handleExport(true)} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export tagged (.md)'}
            </AdminButton>
            <AdminButton variant="outline" onClick={() => void handleExport(false)} disabled={exporting}>
              Export all (.md)
            </AdminButton>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status:</span>
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1 text-xs rounded-full border ${
            statusFilter === '' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300'
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border ${
              statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr]">
        {/* List */}
        <aside className="space-y-2">
          {loading && <div className="text-sm text-gray-500 py-4">Loading…</div>}
          {!loading && threads.length === 0 && (
            <div className="text-sm text-gray-500 py-4">
              No threads match this filter. Try widening the status filter.
            </div>
          )}
          {threads.map((t) => {
            const isActive = t.id === selectedId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {t.subject}
                  </p>
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[t.status]}`}
                  >
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  {t.user.name} · {t.organization?.name ?? 'no org'}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-400">
                  {t.surfaceTag} · {t.severity} · {t._count.messages} msg · {relTime(t.updatedAt)}
                </p>
              </button>
            );
          })}
        </aside>

        {/* Detail */}
        <section>
          {detail ? (
            <ThreadDetailView
              thread={detail}
              token={token}
              onChanged={async () => {
                await fetchDetail(detail.id);
                await fetchList();
              }}
            />
          ) : (
            <AdminCard padding="none">
              <div className="px-6 py-12 text-center text-gray-500">
                <p className="text-sm">Select a thread to view + reply.</p>
                <p className="text-xs mt-2">
                  Use Export to bundle threads as Markdown for a Claude Code synthesis session.
                </p>
              </div>
            </AdminCard>
          )}
        </section>
      </div>
    </AdminFeatureGate>
  );
}

function ThreadDetailView({
  thread,
  token,
  onChanged,
}: {
  thread: ThreadDetail;
  token: string | null;
  onChanged: () => void | Promise<void>;
}) {
  const [reply, setReply] = useState('');
  const [internalNotes, setInternalNotes] = useState(thread.internalNotes ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setInternalNotes(thread.internalNotes ?? '');
  }, [thread.id, thread.internalNotes]);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const handleReply = async () => {
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/feedback/${thread.id}/reply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body: reply }),
      });
      if (res.ok) {
        setReply('');
        await onChanged();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const patch = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/feedback/${thread.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload),
    });
    if (res.ok) await onChanged();
  };

  return (
    <div className="space-y-4">
      <AdminCard padding="none">
        <div className="px-6 py-5 border-b border-gray-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{thread.subject}</h2>
              <p className="mt-1 text-xs text-gray-500">
                <strong>{thread.user.name}</strong> &lt;{thread.user.email}&gt;
                {thread.organization && ` · ${thread.organization.name}`}
                {' · '}
                <code className="text-gray-700">{thread.surfaceRoute ?? '—'}</code>
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-gray-400">
                {thread.surfaceTag} · {thread.severity} · created {relTime(thread.createdAt)}
                {thread.lastReviewedAt && ` · last reviewed ${relTime(thread.lastReviewedAt)}`}
              </p>
            </div>
          </div>
        </div>

        {/* Status flipper + AI tag toggle */}
        <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-gray-700">Status</label>
          <select
            value={thread.status}
            onChange={(e) => void patch({ status: e.target.value })}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <label className="text-xs font-medium text-gray-700 ml-4 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={thread.taggedForAi}
              onChange={(e) => void patch({ taggedForAi: e.target.checked })}
            />
            Tag for AI synthesis
          </label>
          {/* Phase 33g.2 polish: per-thread AI-disable. Bails the
              respondToFeedbackThread() guard even when ANTHROPIC_API_KEY is
              set globally — use for sensitive threads (CDR/AFSL nuance)
              you want to handle directly without AI triage. */}
          <label className="text-xs font-medium text-gray-700 ml-4 inline-flex items-center gap-2" title="When checked, the AI triage agent stops replying on this thread. New consumer/adviser replies still land normally; you respond directly.">
            <input
              type="checkbox"
              checked={thread.aiDisabled}
              onChange={(e) => void patch({ aiDisabled: e.target.checked })}
            />
            Disable AI on this thread
          </label>
        </div>

        {/* Conversation */}
        <div className="px-6 py-5 space-y-3">
          {thread.messages.map((m) => {
            const isAdmin = m.authorRole === 'MONITRAX_ADMIN';
            const isAi = m.authorRole === 'CLAUDE_AI';
            const roleLabel = isAdmin ? 'Monitrax (you)'
              : isAi ? 'Monitrax AI'
              : m.authorRole === 'CONSUMER' ? 'Consumer'
              : 'Adviser';
            const bubble = isAi
              ? 'bg-violet-50 border-violet-200'
              : isAdmin
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-white border-gray-200';
            return (
              <div key={m.id} className={`rounded-lg border px-4 py-3 ${bubble}`}>
                <p className={`text-[10px] uppercase tracking-wider mb-1 inline-flex items-center gap-1 ${isAi ? 'text-violet-700 font-medium' : 'text-gray-500'}`}>
                  {isAi && <span aria-hidden="true">✨</span>}
                  {roleLabel} · {m.author.name} · {relTime(m.createdAt)}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{m.body}</p>
              </div>
            );
          })}
        </div>

        {/* Reply */}
        <div className="px-6 py-5 border-t border-gray-200">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            placeholder="Reply to the adviser…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <div className="mt-3 flex justify-end">
            <AdminButton onClick={() => void handleReply()} disabled={submitting || !reply.trim()}>
              {submitting ? 'Sending…' : 'Send reply'}
            </AdminButton>
          </div>
        </div>
      </AdminCard>

      {/* Internal notes */}
      <AdminCard padding="none">
        <div className="px-6 py-5">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Internal notes (Reza only — never shown to the adviser; every edit is audited)
          </label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            onBlur={() => {
              if ((thread.internalNotes ?? '') !== internalNotes) {
                void patch({ internalNotes });
              }
            }}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
      </AdminCard>
    </div>
  );
}
