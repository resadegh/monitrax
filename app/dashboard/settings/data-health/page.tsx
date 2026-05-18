'use client';

/**
 * Phase 12 PR 3c.2d — Settings > Data Health.
 *
 * Balance-age heat-map: the "single source of truth for staleness"
 * surface that the chip + nudge link to. Lets a user see, at a glance,
 * which of their accounts are auto-fed (BASIQ / IMPORT / USER_VERIFIED)
 * vs MANUAL, and which MANUALs are due for a refresh.
 *
 * Composition (CLAUDE.md §12.2 SSOT):
 *   - `<DataSourceChip>` from PR F renders the source label + age
 *   - `isBalanceStale()` from PR F is the single staleness predicate
 *   - `<UpgradeAccountButton>` from PR H surfaces the action for
 *     MANUAL / USER_VERIFIED accounts
 *
 * No new endpoint — reads `/api/accounts` directly (same path
 * `/dashboard/balances` uses).
 *
 * Per CLAUDE.md §0:
 *   - architect — pure read surface; no calc, no mutation, composes
 *     existing primitives
 *   - financial-adviser — neutral framing; no shaming of MANUAL; the
 *     three age bands map to "fresh / aging / stale" not "good / bad /
 *     fail"
 *   - behaviour-psychologist — leads with what's working (fresh count)
 *     not what's broken (stale count) — Bandura self-efficacy
 *   - designer — restraint; small grid, no charts, no animation
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { ChevronLeft, RefreshCw, Sparkles } from 'lucide-react';
import { DataSourceChip, isBalanceStale } from '@/components/accounts/DataSourceChip';
import { UpgradeAccountButton } from '@/components/accounts/UpgradeAccountButton';

interface AccountRow {
  id: string;
  name: string;
  type: string;
  institution?: string | null;
  balanceSource?: string | null;
  balanceLastUpdatedAt?: string | null;
}

interface AgeBucket {
  key: 'fresh' | 'aging' | 'stale' | 'untracked';
  label: string;
  description: string;
  tone: string;
  accounts: AccountRow[];
}

/**
 * Buckets are days-since-last-update. Untracked = no
 * `balanceLastUpdatedAt` at all (covered by PR I's audit going
 * forward, but pre-PR-I rows may still be null).
 */
function bucketByAge(accounts: AccountRow[]): AgeBucket[] {
  const fresh: AccountRow[] = [];
  const aging: AccountRow[] = [];
  const stale: AccountRow[] = [];
  const untracked: AccountRow[] = [];

  for (const a of accounts) {
    if (!a.balanceLastUpdatedAt) {
      untracked.push(a);
      continue;
    }
    const days = daysSince(a.balanceLastUpdatedAt);
    if (days < 14) fresh.push(a);
    else if (days < 60) aging.push(a);
    else stale.push(a);
  }

  return [
    {
      key: 'fresh',
      label: 'Fresh',
      description: 'Updated in the last 2 weeks',
      tone: 'border-emerald-200 bg-emerald-50/50',
      accounts: fresh,
    },
    {
      key: 'aging',
      label: 'Aging',
      description: '2 weeks to 2 months old',
      tone: 'border-amber-200 bg-amber-50/50',
      accounts: aging,
    },
    {
      key: 'stale',
      label: 'Stale',
      description: 'Over 2 months old',
      tone: 'border-rose-200 bg-rose-50/50',
      accounts: stale,
    },
    {
      key: 'untracked',
      label: 'Untracked',
      description: 'No update history yet',
      tone: 'border-slate-200 bg-slate-50/50',
      accounts: untracked,
    },
  ];
}

function daysSince(input: string): number {
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.floor((Date.now() - then) / 86_400_000);
}

export default function DataHealthPage() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch('/api/accounts', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!active) return;
        const rows = (body?.data ?? body?.accounts ?? []) as AccountRow[];
        setAccounts(rows);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[data-health] fetch failed:', err);
        setError('Could not load your accounts. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const buckets = bucketByAge(accounts);
  const total = accounts.length;
  const fresh = buckets.find((b) => b.key === 'fresh')?.accounts.length ?? 0;
  const stale = accounts.filter((a) => isBalanceStale(a.balanceSource, a.balanceLastUpdatedAt)).length;
  const freshPct = total > 0 ? Math.round((fresh / total) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Breadcrumb */}
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft className="h-4 w-4" />
          Settings
        </Link>

        {/* Hero */}
        <header className="mb-8">
          <p className="text-sm font-medium text-muted-foreground">Settings · Data Health</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-1">
            Where your balances stand
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Your dashboard reads from these balances. Keeping them fresh keeps every number it shows you accurate.
          </p>
        </header>

        {/* Loading / error / empty */}
        {loading && (
          <div className="rounded-xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            Loading your accounts…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!loading && !error && total === 0 && (
          <div className="rounded-xl border border-slate-200 px-4 py-8 text-center">
            <p className="text-sm font-medium text-slate-900">No accounts yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Add an account on your{' '}
              <Link href="/dashboard/balances" className="text-emerald-700 underline">
                balances page
              </Link>{' '}
              to start tracking freshness.
            </p>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <>
            {/* Headline stat */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-5 py-4 mb-6 flex items-start gap-3">
              <div className="rounded-lg bg-emerald-100 p-1.5 mt-0.5">
                <Sparkles aria-hidden className="h-4 w-4 text-emerald-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-900 tabular-nums">
                  {freshPct}% of your {total} {total === 1 ? 'account' : 'accounts'} are fresh
                </p>
                <p className="mt-0.5 text-xs text-emerald-800/80">
                  {stale === 0
                    ? "You're in great shape — every balance is up to date."
                    : stale === 1
                      ? '1 manual balance is due for a refresh.'
                      : `${stale} manual balances are due for a refresh.`}
                </p>
              </div>
            </div>

            {/* Heat-map: one section per bucket */}
            <div className="space-y-4">
              {buckets
                .filter((b) => b.accounts.length > 0)
                .map((bucket) => (
                  <section
                    key={bucket.key}
                    className={`rounded-xl border ${bucket.tone} px-4 py-3`}
                  >
                    <div className="flex items-baseline justify-between mb-3">
                      <h2 className="text-sm font-semibold text-slate-900">
                        {bucket.label}
                        <span className="ml-2 text-xs font-normal text-slate-500 tabular-nums">
                          ({bucket.accounts.length})
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500">{bucket.description}</p>
                    </div>
                    <ul className="space-y-2">
                      {bucket.accounts.map((account) => (
                        <li
                          key={account.id}
                          className="rounded-lg bg-white/80 dark:bg-slate-900/40 px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                                {account.name}
                              </span>
                              <DataSourceChip
                                balanceSource={account.balanceSource}
                                balanceLastUpdatedAt={account.balanceLastUpdatedAt}
                                size="compact"
                              />
                            </div>
                            {account.institution && (
                              <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                                {account.institution}
                              </p>
                            )}
                          </div>
                          {(account.balanceSource === 'MANUAL' ||
                            account.balanceSource === 'USER_VERIFIED') && (
                            <UpgradeAccountButton
                              balanceSource={account.balanceSource}
                              size="compact"
                            />
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
            </div>

            {/* Footer guidance */}
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-600 flex items-start gap-2">
              <RefreshCw aria-hidden className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
              <p>
                Basiq syncs balances automatically. Imported statements refresh per
                upload. Manual balances stay frozen until you update them.
              </p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
