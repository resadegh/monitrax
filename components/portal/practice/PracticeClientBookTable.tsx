/**
 * PracticeClientBookTable — cross-client table with profession-flavoured
 * default columns. Clicking a row will (PR2+) open the canonical consumer
 * dashboard with the adviser overlay docked. For this PR the row click is a
 * no-op + cursor cue so the demo conveys the intent without shipping the
 * drill-in surface yet.
 */
import { PracticeGlassCard } from './PracticeGlassCard';
import { TrailStageChip } from './TrailStageChip';
import type {
  DemoClient,
  PracticeProfessionConfig,
  ClientBookColumn,
} from '@/lib/portal/practice';

interface PracticeClientBookTableProps {
  clients: DemoClient[];
  profession: PracticeProfessionConfig;
}

const fmtAud = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${n < 0 ? '-' : ''}$${Math.round(abs / 1_000)}k`;
  }
  return `${n < 0 ? '-' : ''}$${Math.round(abs)}`;
};

const fmtAudExact = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-AU')}`;

const fmtPct = (n: number) => `${(n * 100).toFixed(0)}%`;

const fmtDays = (days: number) => {
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return '1 week ago';
  return `${Math.round(days / 7)} weeks ago`;
};

const fmtBasDue = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const due = new Date(iso);
  const today = new Date('2026-05-04T00:00:00.000Z');
  const days = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  return `in ${days}d`;
};

function renderCell(client: DemoClient, column: ClientBookColumn) {
  switch (column.key) {
    case 'trail':
      return <TrailStageChip stage={client.trailStage} delta={client.trailDelta ?? null} size="sm" />;
    case 'health':
      return (
        <span className="tabular-nums text-sm font-medium text-slate-900">
          {client.healthScore}
          <span
            className={`ml-1 text-[11px] ${
              client.healthDelta30d >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {client.healthDelta30d >= 0 ? '↑' : '↓'}
            {Math.abs(client.healthDelta30d)}
          </span>
        </span>
      );
    case 'netWorth':
      return <span className="tabular-nums text-sm text-slate-900">{fmtAud(client.netWorthAud)}</span>;
    case 'cashflow':
      return (
        <span
          className={`tabular-nums text-sm ${
            client.monthlyCashflowAud >= 0 ? 'text-slate-900' : 'text-rose-600'
          }`}
        >
          {client.monthlyCashflowAud >= 0 ? '+' : ''}
          {fmtAudExact(client.monthlyCashflowAud)}
        </span>
      );
    case 'lvr':
      return client.lvr != null ? (
        <span className="tabular-nums text-sm text-slate-900">{fmtPct(client.lvr)}</span>
      ) : (
        <span className="text-sm text-slate-400">—</span>
      );
    case 'equityAvailable':
      return client.equityAvailableAud != null ? (
        <span className="tabular-nums text-sm text-slate-900">{fmtAud(client.equityAvailableAud)}</span>
      ) : (
        <span className="text-sm text-slate-400">—</span>
      );
    case 'taxPositionYtd':
      return client.taxPositionYtdAud != null ? (
        <span
          className={`tabular-nums text-sm ${
            client.taxPositionYtdAud >= 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {fmtAudExact(client.taxPositionYtdAud)}
        </span>
      ) : (
        <span className="text-sm text-slate-400">—</span>
      );
    case 'missingReceipts':
      return client.missingReceiptsCount != null ? (
        <span
          className={`tabular-nums text-sm ${
            client.missingReceiptsCount > 0 ? 'text-amber-700' : 'text-slate-900'
          }`}
        >
          {client.missingReceiptsCount}
        </span>
      ) : (
        <span className="text-sm text-slate-400">—</span>
      );
    case 'basDue':
      return <span className="text-sm text-slate-900">{fmtBasDue(client.basDueDate)}</span>;
    case 'lastSeen':
      return <span className="text-sm text-slate-500">{fmtDays(client.lastContactDays)}</span>;
    default:
      return null;
  }
}

export function PracticeClientBookTable({ clients, profession }: PracticeClientBookTableProps) {
  return (
    <section aria-labelledby="practice-clients-heading">
      <header className="flex items-baseline justify-between mb-3">
        <div>
          <h2
            id="practice-clients-heading"
            className="text-base font-semibold tracking-tight text-slate-900"
          >
            Client book
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {profession.bookCaption}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-full bg-white text-slate-900 ring-1 ring-slate-200 text-xs font-medium px-3 py-1.5 hover:bg-slate-50 transition-colors"
        >
          + Invite client
        </button>
      </header>

      <PracticeGlassCard padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/70">
                <th className="px-5 py-3 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
                  Client
                </th>
                {profession.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500 ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map((client, idx) => (
                <tr
                  key={client.id}
                  className={`group cursor-pointer transition-colors hover:bg-slate-50/70 ${
                    idx === clients.length - 1 ? '' : 'border-b border-slate-100'
                  }`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-semibold tracking-tight"
                        aria-hidden="true"
                      >
                        {client.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {client.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {client.propertiesCount}{' '}
                          {client.propertiesCount === 1 ? 'property' : 'properties'} ·{' '}
                          {client.loansCount} loan{client.loansCount === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  </td>
                  {profession.columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-4 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      {renderCell(client, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PracticeGlassCard>
    </section>
  );
}
