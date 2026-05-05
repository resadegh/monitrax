/**
 * PracticeHeader — page-level header for the Practice dashboard.
 *
 * Greets the user + names the practice mode (driven by `profession` on the
 * Organization record). No demo switcher in production: profession is
 * forced at registration and cannot be flipped at runtime — see Reza
 * directive 2026-05-04 (skip the demo, build the complete app, seed
 * realistic users for the pitch).
 *
 * Phase 33g: small "Send feedback" affordance in the action slot — quick
 * access for advisers without leaving the dashboard. The link carries the
 * current pathname so the new-thread form pre-fills `surfaceRoute`.
 */
import Link from 'next/link';
import { MessageSquarePlus } from 'lucide-react';
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
      <div className="flex items-center gap-2">
        <Link
          href="/portal/feedback?route=%2Fportal%2Fdashboard"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/85 ring-1 ring-slate-900/[0.08] px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-white transition-colors"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Send feedback
        </Link>
      </div>
    </header>
  );
}
