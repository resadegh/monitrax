/**
 * PracticeHeader — page-level header for the Practice dashboard.
 *
 * Includes a profession switcher (demo-only at v1, swaps the layout/columns/
 * alerts) so the lighthouse pitch can show advisers, brokers, and accountants
 * the SAME engine with profession-flavoured defaults — proving the
 * dual-surface architecture without shipping all three onboarding flows.
 *
 * In production the switcher disappears: the org's `profession` is forced at
 * registration and never changes. The switcher is gated by a `demoMode` prop
 * so production rendering never accidentally lets a logged-in adviser flip
 * to the broker view.
 */
import type { OrganizationType } from '@prisma/client';
import { PROFESSION_OPTIONS } from '@/lib/portal/practice';

interface PracticeHeaderProps {
  organisationName: string;
  profession: OrganizationType;
  practiceLabel: string;
  onProfessionChange?: (next: OrganizationType) => void;
  demoMode?: boolean;
}

export function PracticeHeader({
  organisationName,
  profession,
  practiceLabel,
  onProfessionChange,
  demoMode = false,
}: PracticeHeaderProps) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
            {practiceLabel}
          </span>
          {demoMode && (
            <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
              Demo data
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-slate-900">
          {greeting}, {organisationName}.
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {demoMode
            ? 'Lighthouse demo — five fictitious clients, real engine, no production data.'
            : 'Your book at a glance.'}
        </p>
      </div>

      {demoMode && onProfessionChange && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.08em] text-slate-500 mr-1">
            View as
          </span>
          <div className="inline-flex rounded-full bg-white ring-1 ring-slate-200 p-1 shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset]">
            {PROFESSION_OPTIONS.map((opt) => {
              const active = opt.key === profession;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onProfessionChange(opt.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  aria-pressed={active}
                  title={opt.hint}
                >
                  {opt.label.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
