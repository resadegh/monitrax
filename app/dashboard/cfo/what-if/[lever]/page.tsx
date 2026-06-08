'use client';

/**
 * Phase 45 PR 2.A — lever-detail route stub.
 *
 * Validates `[lever]` against the `ScenarioType` whitelist and renders a
 * "coming soon in PR 2.B" placeholder. The interactive lever-detail UI
 * (sliders + projection chart + H1 source line + H2 regime badge +
 * H3 cap-hard-stop tooltip + assumptions panel + GAW footer) ships in
 * PR 2.B per `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §6.4.
 *
 * Canonical Stitch artefact: `.stitch/designs/what-if-lever-detail*.{html,png}`
 * (locked PR #977 — Salary-sacrifice as the showcase lever, all other
 * levers parameterised by the same React component).
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowLeft, Construction } from 'lucide-react';
import { SCENARIO_TYPES, type ScenarioType } from '@/lib/cfo/scenarios';

const LEVER_TITLES: Record<ScenarioType, string> = {
  refinanceLoan: 'Refinance a loan',
  salarySacrificeToSuper: 'Salary-sacrifice to super',
  sellProperty: 'Sell a property',
  payDownLoan: 'Pay extra off a debt',
  addInvestment: 'Buy an investment property',
  redirectToOffset: 'Redirect to offset',
  cutSpendCategory: 'Cut a spending category',
};

function isScenarioType(value: string): value is ScenarioType {
  return (SCENARIO_TYPES as string[]).includes(value);
}

export default function LeverDetailPage() {
  const params = useParams<{ lever: string }>();
  const leverParam = params.lever;
  const isValid = typeof leverParam === 'string' && isScenarioType(leverParam);
  const title = isValid ? LEVER_TITLES[leverParam] : 'Unknown lever';

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/cfo/what-if"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back to lever picker
        </Link>

        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          My Guide · What if?
        </p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>

        {!isValid && (
          <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">
            That lever doesn&apos;t exist. Go back and pick one from the lever
            picker.
          </p>
        )}

        <div className="mt-10 flex flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-foreground/15 bg-card/30 p-12 text-center backdrop-blur-xl">
          <Construction
            className="mb-4 h-8 w-8 text-foreground/40"
            strokeWidth={1.5}
          />
          <h2 className="text-lg font-semibold text-foreground">
            Lever detail coming in PR 2.B
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The interactive sliders, 10-year projection chart, and per-lever
            assumptions panel ship in the next PR. The engine that powers them
            (Phase 45 PR 1) is already live — see{' '}
            <code className="rounded bg-foreground/5 px-1.5 py-0.5 text-xs">
              lib/cfo/scenarios/
            </code>
            .
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
