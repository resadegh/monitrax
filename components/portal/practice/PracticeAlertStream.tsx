/**
 * PracticeAlertStream — the prioritised "needs attention today" call sheet.
 *
 * This is the moat. Per the four-lens recommendation (financial-adviser
 * lens), the alert stream — not the dashboard view — is what justifies
 * AU$149+/seat/mo. It turns a reactive book into a proactive one.
 *
 * Filter rules:
 *   - profession.alertTriggers determines which trigger kinds surface
 *   - critical alerts always come first, then opportunity, then milestone
 *   - max 5 visible by default; "view all" link to the (future) /portal/alerts route
 *
 * AFSL/credit/tax-agent boundary (CLAUDE.md §0 financial-adviser lens):
 * alert text NEVER recommends a specific product or action. The platform
 * surfaces the *trigger*; the professional generates the *recommendation*.
 * Reviewers must reject any future copy that crosses that line.
 */
import { PracticeGlassCard } from './PracticeGlassCard';
import type { DemoAlert, DemoClient } from '@/lib/portal/practice';
import type { PracticeProfessionConfig } from '@/lib/portal/practice';

interface PracticeAlertStreamProps {
  alerts: DemoAlert[];
  clients: DemoClient[];
  profession: PracticeProfessionConfig;
  maxVisible?: number;
}

const SEVERITY_RANK: Record<DemoAlert['severity'], number> = {
  critical: 0,
  opportunity: 1,
  milestone: 2,
};

const SEVERITY_BADGE: Record<DemoAlert['severity'], { label: string; classes: string }> = {
  critical: {
    label: 'Critical',
    classes: 'bg-rose-50 text-rose-700 ring-rose-200/70',
  },
  opportunity: {
    label: 'Opportunity',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  },
  milestone: {
    label: 'Milestone',
    classes: 'bg-sky-50 text-sky-700 ring-sky-200/70',
  },
};

export function PracticeAlertStream({
  alerts,
  clients,
  profession,
  maxVisible = 5,
}: PracticeAlertStreamProps) {
  const allowed = new Set(profession.alertTriggers);
  const filtered = alerts
    .filter((a) => allowed.has(a.triggerKind))
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
    });

  const visible = filtered.slice(0, maxVisible);
  const overflow = Math.max(0, filtered.length - visible.length);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  return (
    <section aria-labelledby="practice-alerts-heading">
      <header className="flex items-baseline justify-between mb-3">
        <div>
          <h2
            id="practice-alerts-heading"
            className="text-base font-semibold tracking-tight text-slate-900"
          >
            Needs attention today
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length === 0
              ? 'No critical or opportunity signals on your book right now.'
              : `${filtered.length} active signal${filtered.length === 1 ? '' : 's'} — sorted by urgency.`}
          </p>
        </div>
      </header>

      {filtered.length === 0 ? (
        <PracticeGlassCard padding="lg">
          <p className="text-sm text-slate-500">
            All quiet. New triggers will appear here as your clients&rsquo; financial
            position changes.
          </p>
        </PracticeGlassCard>
      ) : (
        <ul className="space-y-3">
          {visible.map((alert) => {
            const client = clientById.get(alert.clientId);
            const badge = SEVERITY_BADGE[alert.severity];
            return (
              <li key={alert.id}>
                <PracticeGlassCard accentTone={alert.severity} interactive padding="md">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold tracking-tight"
                      aria-hidden="true"
                    >
                      {client?.initials ?? '·'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">
                          {client?.name ?? 'Unknown client'}
                        </span>
                        <span
                          className={`text-[10px] font-medium uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full ring-1 ring-inset ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {alert.headline}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{alert.body}</p>
                      <p className="mt-2 text-[11px] text-slate-500 tabular-nums">
                        {alert.context}
                      </p>
                    </div>
                    <div className="flex-shrink-0 hidden sm:flex items-center">
                      <button
                        type="button"
                        className="inline-flex items-center rounded-full bg-slate-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-slate-800 transition-colors"
                      >
                        {alert.primaryActionLabel}
                      </button>
                    </div>
                  </div>
                </PracticeGlassCard>
              </li>
            );
          })}
          {overflow > 0 && (
            <li className="pt-1 text-center">
              <span className="text-xs text-slate-500">
                +{overflow} more · view all coming soon
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
