/**
 * PracticeKpiStrip — the four-up KPI hero for the Practice dashboard.
 *
 * Reads from the demo dataset's `computeKpis()`. When the alert engine wires
 * to real snapshots (PR3+), swap the input source — the component contract
 * stays the same.
 */
import { PracticeGlassCard } from './PracticeGlassCard';
import type { PracticeKpis } from '@/lib/portal/practice';

interface PracticeKpiStripProps {
  kpis: PracticeKpis;
}

export function PracticeKpiStrip({ kpis }: PracticeKpiStripProps) {
  const items: Array<{
    label: string;
    value: string;
    sub?: string;
    tone?: 'positive' | 'attention';
  }> = [
    {
      label: 'Active clients',
      value: String(kpis.activeClients),
      sub: 'on your book',
    },
    {
      label: 'Need attention',
      value: String(kpis.needsAttention),
      sub: 'today',
      tone: kpis.needsAttention > 0 ? 'attention' : undefined,
    },
    {
      label: 'TRAIL advanced',
      value: String(kpis.trailAdvancedThisWeek),
      sub: 'this week',
      tone: kpis.trailAdvancedThisWeek > 0 ? 'positive' : undefined,
    },
    {
      label: 'Avg client Health',
      value: String(kpis.averageHealth),
      sub: kpis.averageHealthDelta >= 0
        ? `↑ ${kpis.averageHealthDelta.toFixed(1)} vs 30d`
        : `↓ ${Math.abs(kpis.averageHealthDelta).toFixed(1)} vs 30d`,
      tone: kpis.averageHealthDelta >= 0 ? 'positive' : 'attention',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {items.map((item) => (
        <PracticeGlassCard key={item.label} padding="md">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {item.value}
          </p>
          {item.sub && (
            <p
              className={`mt-1 text-xs tabular-nums ${
                item.tone === 'attention'
                  ? 'text-rose-600'
                  : item.tone === 'positive'
                    ? 'text-emerald-600'
                    : 'text-slate-500'
              }`}
            >
              {item.sub}
            </p>
          )}
        </PracticeGlassCard>
      ))}
    </div>
  );
}
