/**
 * Phase 32B PR3 — Adviser overlay for the canonical drill-in.
 *
 * Docked-right on desktop (≥768px), bottom-sheet on mobile. Contains:
 *   - Scope summary (which DataAccessScopes the client granted; visually
 *     reinforces the service-layer scope filter)
 *   - Last review date (most recent ClientAccessLog timestamp)
 *   - Notes panel
 *   - Tasks panel
 *   - AFSL / credit / TPB compliance footer (profession-aware)
 *
 * Design lens (CLAUDE.md §0): the overlay is *additive* to the consumer
 * dashboard, not a replacement. The professional sees the same surface
 * the client sees, with adviser-only context anchored at the edge.
 *
 * Behaviour-psychology lens: the overlay's compliance footer states the
 * professional's authority boundary in their own voice ("As your AFSL-
 * authorised adviser, this view is for analysis only…") rather than as a
 * legal hammer. Per Phase 32B hard constraint: alert text NEVER recommends
 * a specific product or action — that is the professional's job.
 */

'use client';

import { useState } from 'react';
import type { DataAccessScope, OrganizationType } from '@prisma/client';
import { ACCESS_SCOPE_DESCRIPTIONS } from '@/lib/portal/constants';
import type { PortalClient, ClientNote, ClientTask } from '@/lib/portal/types';

interface AdviserOverlayProps {
  client: PortalClient;
  notes: ClientNote[];
  tasks: ClientTask[];
  appliedScopes: DataAccessScope[];
  appliedScopeFilter: boolean;
  profession: OrganizationType;
  lastReviewedAt?: Date | string | null;
}

const COMPLIANCE_FOOTER: Record<OrganizationType, string> = {
  FINANCIAL_ADVISOR:
    'Acting under AFSL authorisation. This view supports analysis and advice; product recommendations remain a Statement of Advice deliverable.',
  MORTGAGE_BROKER:
    'Acting under Australian Credit Licence. This view supports loan structuring discussions; specific product recommendations require a Credit Assistance Quote.',
  ACCOUNTING_FIRM:
    'Acting under TPB Tax Agent registration. This view supports tax planning and compliance work; advice on financial products is outside scope and referred where appropriate.',
  TAX_AGENT:
    'Acting under TPB Tax Agent registration. This view supports tax planning and compliance work.',
  BOOKKEEPER:
    'Acting under BAS Agent registration. This view supports BAS-eligible bookkeeping work.',
  OTHER:
    'Professional view. Recommendations remain the responsibility of the qualified professional.',
};

export function AdviserOverlay({
  client,
  notes,
  tasks,
  appliedScopes,
  appliedScopeFilter,
  profession,
  lastReviewedAt,
}: AdviserOverlayProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED');
  const recentNotes = notes.slice(0, 5);

  return (
    <>
      {/* Desktop: docked right rail (≥md). Sticky so it follows the dashboard scroll. */}
      <aside
        aria-label="Adviser overlay"
        className="hidden md:flex md:flex-col md:gap-4 md:w-80 md:flex-shrink-0 md:sticky md:top-6 md:self-start md:max-h-[calc(100vh-3rem)] md:overflow-y-auto md:pr-1"
      >
        <OverlayContent
          client={client}
          notes={recentNotes}
          pendingTasks={pendingTasks}
          appliedScopes={appliedScopes}
          appliedScopeFilter={appliedScopeFilter}
          profession={profession}
          lastReviewedAt={lastReviewedAt}
        />
      </aside>

      {/* Mobile: bottom sheet. Tap header to expand. */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-slate-200 shadow-2xl rounded-t-3xl"
        style={{ maxHeight: mobileExpanded ? '85vh' : '4.5rem' }}
      >
        <button
          type="button"
          onClick={() => setMobileExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="block w-10 h-1 rounded-full bg-slate-300" aria-hidden />
            <span className="font-semibold text-slate-900">Adviser view</span>
            {pendingTasks.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                {pendingTasks.length}
              </span>
            )}
          </div>
          <span className="text-xs uppercase tracking-wider text-slate-500">
            {mobileExpanded ? 'Hide' : 'Show'}
          </span>
        </button>

        {mobileExpanded && (
          <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 4rem)' }}>
            <OverlayContent
              client={client}
              notes={recentNotes}
              pendingTasks={pendingTasks}
              appliedScopes={appliedScopes}
              appliedScopeFilter={appliedScopeFilter}
              profession={profession}
              lastReviewedAt={lastReviewedAt}
            />
          </div>
        )}
      </div>
    </>
  );
}

function OverlayContent({
  client,
  notes,
  pendingTasks,
  appliedScopes,
  appliedScopeFilter,
  profession,
  lastReviewedAt,
}: {
  client: PortalClient;
  notes: ClientNote[];
  pendingTasks: ClientTask[];
  appliedScopes: DataAccessScope[];
  appliedScopeFilter: boolean;
  profession: OrganizationType;
  lastReviewedAt?: Date | string | null;
}) {
  return (
    <div className="space-y-4">
      <Section title="Scope" subtle={appliedScopeFilter ? 'Filtered' : 'Full access'}>
        <div className="flex flex-wrap gap-1.5">
          {appliedScopes.map((scope) => (
            <span
              key={scope}
              className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200"
            >
              {ACCESS_SCOPE_DESCRIPTIONS[scope]?.label ?? scope}
            </span>
          ))}
        </div>
        {appliedScopeFilter && (
          <p className="mt-2 text-xs text-slate-500 leading-relaxed">
            Tiles outside the granted scope are hidden by the snapshot service. The client can extend
            scope from their consent settings.
          </p>
        )}
      </Section>

      <Section title="Last review">
        <p className="text-sm text-slate-700">
          {lastReviewedAt ? formatDateTime(lastReviewedAt) : 'First view'}
        </p>
      </Section>

      <Section title="Notes" subtle={`${notes.length}`}>
        {notes.length === 0 ? (
          <p className="text-xs text-slate-500">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg bg-slate-50 px-3 py-2">
                {note.title && (
                  <p className="text-xs font-semibold text-slate-900">{note.title}</p>
                )}
                <p className="text-xs text-slate-700 line-clamp-3">{note.content}</p>
                <p className="text-[10px] text-slate-400 mt-1">{formatDate(note.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Tasks" subtle={`${pendingTasks.length} open`}>
        {pendingTasks.length === 0 ? (
          <p className="text-xs text-slate-500">No open tasks.</p>
        ) : (
          <ul className="space-y-2">
            {pendingTasks.slice(0, 6).map((task) => (
              <li
                key={task.id}
                className="rounded-lg bg-slate-50 px-3 py-2 flex items-start gap-2"
              >
                <span
                  className={`mt-1 inline-block w-2 h-2 rounded-full ${priorityDot(task.priority)}`}
                  aria-hidden
                />
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-900">{task.title}</p>
                  {task.dueDate && (
                    <p className="text-[10px] text-slate-500">Due {formatDate(task.dueDate)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-[11px] leading-relaxed text-slate-500 border-t border-slate-200 pt-3">
        {COMPLIANCE_FOOTER[profession] ?? COMPLIANCE_FOOTER.OTHER}
      </p>
    </div>
  );
}

function Section({
  title,
  subtle,
  children,
}: {
  title: string;
  subtle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
        {subtle && <span className="text-[10px] text-slate-400">{subtle}</span>}
      </header>
      {children}
    </section>
  );
}

function priorityDot(priority: ClientTask['priority']): string {
  switch (priority) {
    case 'URGENT':
      return 'bg-rose-500';
    case 'HIGH':
      return 'bg-amber-500';
    case 'MEDIUM':
      return 'bg-sky-500';
    case 'LOW':
    default:
      return 'bg-slate-400';
  }
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
