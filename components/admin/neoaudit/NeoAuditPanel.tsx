'use client';

/**
 * NeoAudit panel (R3-self) — renders GET /api/verify/invariants on the
 * operator's real data as a PASS/FAIL scorecard. Admin design system (§18.2).
 *
 * v1 scope: the self-audit invariants (the real-data half of the Release
 * Scorecard). The CI/registry half of the scorecard (rings 0–2 green, zero OPEN
 * number-issues) is aggregated in a later iteration (NEOAUDIT.md §6, §8 step 6).
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

export function NeoAuditPanel() {
  const { token } = useAuth();
  const [data, setData] = useState<SelfAuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/verify/invariants', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Self-audit failed to run');
        return;
      }
      setData(json.data as SelfAuditData);
    } catch {
      setError('Self-audit request failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">NeoAudit — Self-Audit</h1>
          <p className="text-sm text-slate-500">
            Ring-3 accounting invariants on your real data.{' '}
            <a href="/docs" className="underline">docs/blueprint/NEOAUDIT.md</a>
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {loading ? 'Running…' : 'Re-run'}
        </button>
      </div>

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
