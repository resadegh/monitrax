'use client';

/**
 * M2.6 #5 — the shared "couldn't load" state for kept pages.
 *
 * A failed fetch must NEVER render the "you have no data yet" empty state:
 * telling a user with three properties that they have none (and inviting
 * them to add their first) is a duplicate-entry trap and a direct hit on
 * trust (pain #8). Mirrors the /dashboard/balances error pattern; used by
 * properties, assets, documents and the depreciation page.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LoadFailedState({
  what,
  onRetry,
}: {
  /** Plain-English name of what failed to load, e.g. "your properties". */
  what: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/[0.06] p-10 text-center">
      <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        We couldn&rsquo;t load {what}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Your data is safe — this is a connection problem, not a data problem.
        Try again in a moment.
      </p>
      <Button variant="outline" onClick={onRetry} className="mt-5">
        <RefreshCw className="mr-1.5 h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
