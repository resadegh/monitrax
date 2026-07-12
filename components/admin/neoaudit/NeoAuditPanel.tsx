'use client';

/**
 * NeoAudit panel (R3-self) — renders the Ring-3 accounting invariants as a
 * PASS/FAIL scorecard. Admin design system (§18.2).
 *
 * Audit target (2026-07-12): a picker lets the operator run the audit on ANY
 * user's real data, not just the logged-in admin account.
 *   - "My account (self)" → GET /api/verify/invariants   (the admin's own data)
 *   - a selected user      → GET /api/admin/neoaudit?userId=…  (admin-gated +
 *     audit-logged; the same shared computation, so results can't diverge)
 *
 * v1 scope: the self-audit invariants (the real-data half of the Release
 * Scorecard). The CI/registry half (rings 0–2 green, zero OPEN number-issues) is
 * aggregated later (NEOAUDIT.md §6, §8 step 6).
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency } from '@/lib/utils/formatters';

interface Invariant {
  id: string;
  label: string;
  lhs: number;
  rhs: number;
  delta: number;
  tolerance: number;
  pass: boolean;
}

interface SelfAuditData {
  pass: boolean;
  auditedAccount: string;
  advisories: string[];
  checkedAt: string;
  invariantCount: number;
  failureCount: number;
  invariants: Invariant[];
  info: {
    canonicalMonthlyNet: number;
    cashflowBasis: string;
    canonicalSavingsRate: number;
    nonFiniteFields: string[];
  };
}

interface UserOption {
  id: string;
  email: string;
}

interface ScorecardData {
  openNumberIssues: { id: string; title: string; status: string }[];
  openNumberIssueCount: number;
  totalOpenCount: number;
  registryClean: boolean;
  externalChecks: string[];
}

// null = "My account (self)"; a userId = audit that user via the admin endpoint.
const SELF = '__self__';

export function NeoAuditPanel() {
  const { token } = useAuth();
  const [data, setData] = useState<SelfAuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [target, setTarget] = useState<string>(SELF);
  const [scorecard, setScorecard] = useState<ScorecardData | null>(null);

  // Populate the picker + the Release Scorecard (both cookie-authed, admin).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/users?limit=200&sortBy=email&sortOrder=asc');
        if (!res.ok) return; // picker is optional — self-audit still works without it
        const json = await res.json();
        const list: UserOption[] = (json.data ?? []).map((u: { id: string; email: string }) => ({ id: u.id, email: u.email }));
        if (!cancelled) setUsers(list);
      } catch {
        /* non-fatal — leave the picker with just "self" */
      }
    })();
    (async () => {
      try {
        const res = await fetch('/api/admin/neoaudit/scorecard');
        if (!res.ok) return; // scorecard is optional decoration on the invariants
        const json = await res.json();
        if (!cancelled && json.success) setScorecard(json.data as ScorecardData);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async () => {
    // Self-audit needs the Firebase token; wait for it rather than flash a 401
    // on first mount. The admin-targeted path uses the admin_session cookie.
    if (target === SELF && !token) return;
    setLoading(true);
    setError(null);
    try {
      const res =
        target === SELF
          ? await fetch('/api/verify/invariants', { headers: { Authorization: `Bearer ${token}` } })
          : await fetch(`/api/admin/neoaudit?userId=${encodeURIComponent(target)}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? json?.error ?? 'Self-audit failed to run');
        setData(null);
        return;
      }
      setData(json.data as SelfAuditData);
    } catch {
      setError('Self-audit request failed');
    } finally {
      setLoading(false);
    }
  }, [target, token]);

  // Re-run whenever the target changes (and on mount).
  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">NeoAudit — Self-Audit</h1>
          <p className="text-sm text-slate-500">
            Ring-3 accounting invariants on real data.{' '}
            <a href="/docs" className="underline">docs/blueprint/NEOAUDIT.md</a>
          </p>
          {data && (
            <p className="mt-0.5 text-xs text-slate-500">
              Auditing account: <span className="font-mono text-slate-700 dark:text-slate-300">{data.auditedAccount}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <span className="whitespace-nowrap">Audit account</span>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={loading}
              className="max-w-[220px] rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-800 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value={SELF}>My account (self)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {loading ? 'Running…' : 'Re-run'}
          </button>
        </div>
      </div>

      {/* Release Scorecard — the publish gate (NEOAUDIT.md §6). States gate
          OUTPUT, never a bare "safe to publish" claim (§22.2.4). Combines the
          two signals the app can self-verify (this account's invariants +
          zero open number-issues) and names the external ones. */}
      {scorecard && (() => {
        const invariantsClean = data?.pass ?? null; // null = not yet run
        const appVerifiable = invariantsClean === true && scorecard.registryClean;
        return (
          <div
            className={`mb-4 rounded-lg border p-4 ${
              appVerifiable
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
                : 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Release scorecard — publish gate</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-700 dark:text-slate-300">Real-data invariants (this account)</span>
                <span className={`font-semibold ${invariantsClean === true ? 'text-emerald-700 dark:text-emerald-300' : invariantsClean === false ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                  {invariantsClean === true ? 'ALL PASS' : invariantsClean === false ? `${data?.failureCount} FAIL` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-700 dark:text-slate-300">Open number-issues in the registry</span>
                <span className={`font-semibold ${scorecard.registryClean ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {scorecard.openNumberIssueCount === 0 ? 'ZERO' : `${scorecard.openNumberIssueCount} open`}
                </span>
              </div>
            </div>
            {scorecard.openNumberIssues.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-800 dark:text-amber-200">
                {scorecard.openNumberIssues.map((i) => (
                  <li key={i.id}><span className="font-mono">{i.id}</span> <span className="uppercase opacity-70">({i.status})</span> — {i.title}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-black/5 pt-2 text-xs text-slate-500 dark:border-white/10">
              Also verify on CI before publishing (not self-reported here): {scorecard.externalChecks.join(' · ')}.
              {appVerifiable
                ? ' The two in-app signals are green.'
                : ' One or more in-app signals is not yet green.'}
            </p>
          </div>
        );
      })()}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Scorecard header */}
          <div
            className={`mb-4 rounded-lg border p-4 ${
              data.pass
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950'
                : 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-lg font-bold ${data.pass ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                  {data.pass ? 'ALL PASS' : `${data.failureCount} FAIL`}
                </p>
                <p className="text-xs text-slate-500">
                  {data.invariantCount} invariants · checked {new Date(data.checkedAt).toLocaleString('en-AU')}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>Monthly net: <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(data.info.canonicalMonthlyNet)}</span> <span className="uppercase">({data.info.cashflowBasis})</span></div>
                <div>Savings rate: <span className="tabular-nums text-slate-800 dark:text-slate-200">{data.info.canonicalSavingsRate}%</span></div>
              </div>
            </div>
          </div>

          {/* Advisories — plausibility smells (amber, not FAIL) */}
          {data.advisories.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Advisories — a human should look</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-200">
                {data.advisories.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                These aren&rsquo;t identity failures — the maths is consistent. They flag data that <em>looks</em> like a test account or a missing feed, which the PASS/FAIL checks can&rsquo;t see.
              </p>
            </div>
          )}

          {/* Invariant table */}
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2">Invariant</th>
                  <th className="px-3 py-2 text-right">Left</th>
                  <th className="px-3 py-2 text-right">Right</th>
                  <th className="px-3 py-2 text-right">Δ</th>
                  <th className="px-3 py-2 text-center">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.invariants.map((inv) => (
                  <tr key={inv.id} className={inv.pass ? '' : 'bg-red-50 dark:bg-red-950/40'}>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-slate-400">{inv.id}</span>{' '}
                      <span className="text-slate-800 dark:text-slate-200">{inv.label}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{inv.lhs.toLocaleString('en-AU', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">{inv.rhs.toLocaleString('en-AU', { maximumFractionDigits: 2 })}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${Math.abs(inv.delta) > inv.tolerance ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
                      {inv.delta.toLocaleString('en-AU', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inv.pass ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                        {inv.pass ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Each row asserts an identity between canonical fields (§12.2.1). A FAIL is a real-data defect — raise a MON-### issue.
          </p>
        </>
      )}
    </div>
  );
}
