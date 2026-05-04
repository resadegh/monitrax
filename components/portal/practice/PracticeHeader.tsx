/**
 * PracticeHeader — page-level header for the Practice dashboard.
 *
 * Greets the user + names the practice mode (driven by `profession` on the
 * Organization record). No demo switcher in production: profession is
 * forced at registration and cannot be flipped at runtime — see Reza
 * directive 2026-05-04 (skip the demo, build the complete app, seed
 * realistic users for the pitch).
 */
import type { OrganizationType } from '@prisma/client';

interface PracticeHeaderProps {
  organisationName: string;
  profession: OrganizationType;
  practiceLabel: string;
}

export function PracticeHeader({
  organisationName,
  practiceLabel,
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
        </div>
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-slate-900">
          {greeting}, {organisationName}.
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your book at a glance.
        </p>
      </div>
    </header>
  );
}
