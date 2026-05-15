'use client';

/**
 * /admin/run-seed
 *
 * SUPER_ADMIN-only operator page that triggers idempotent Prisma seeds
 * against the live database via `/api/admin/run-seed`. Avoids the need
 * for a Cloud SQL Proxy on the operator's machine — auth flows through
 * the existing Vercel runtime (WIF + Cloud SQL Connector).
 *
 * Three actions:
 *   1. Lighthouse — creates Smithfield Wealth Advisers + 3 archetype
 *      consumers (idempotent; --reset deletes + re-seeds).
 *   2. Portal Access — grants admin@monitrax.com.au PORTAL_OWNER on
 *      the Smithfield org so the Org Portal /portal/signin succeeds.
 *   3. Feature Flags — creates the platform-canonical GlobalFeatureFlag
 *      rows (currently `BASIQ_INTEGRATION`, defaults OFF). Idempotent;
 *      NEVER overwrites the operator's toggle state on re-run.
 *
 * All seeds are idempotent and safe to re-run.
 */

import { useState } from 'react';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';

type Action = 'lighthouse' | 'portal-access' | 'feature-flags';

export default function AdminRunSeedPage() {
  const [running, setRunning] = useState<Action | null>(null);
  const [output, setOutput] = useState<string>('');
  const [reset, setReset] = useState(false);
  const [extraEmails, setExtraEmails] = useState('');

  async function run(action: Action) {
    setRunning(action);
    setOutput('Running...\n');
    try {
      const body: Record<string, unknown> = { action };
      if (action === 'lighthouse') body.reset = reset;
      if (action === 'portal-access') {
        body.extraEmails = extraEmails
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);
      }

      const res = await fetch('/api/admin/run-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      const status = data.success ? '✅ SUCCESS' : '❌ FAILED';
      const errLine = data.error
        ? `\n[error] ${data.error.code}: ${data.error.message}`
        : '';
      setOutput(`${status}\n\n${data.output ?? ''}${errLine}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput(`❌ FAILED\n\nNetwork or parse error: ${msg}`);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Run Database Seeds</h1>
        <p className="mt-1 text-sm text-gray-600">
          SUPER_ADMIN-only. Runs idempotent Prisma seeds against the live database
          via the Vercel runtime. Safe to re-run.
        </p>
      </div>

      <AdminCard>
        <AdminCardHeader
          title="Lighthouse Demo Data"
          description="Creates Smithfield Wealth Advisers + 3 archetype consumers (Sarah, David, Olivia). Idempotent — re-running keeps the same IDs and stable demo URLs."
        />
        <div className="space-y-3 p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={reset}
              onChange={(e) => setReset(e.target.checked)}
              disabled={running !== null}
              className="rounded border-gray-300"
            />
            <span>
              <strong>Reset mode</strong> — delete all lighthouse-seeded users
              (cascade) before re-seeding. Use only when the schema has shifted.
            </span>
          </label>
          <button
            onClick={() => run('lighthouse')}
            disabled={running !== null}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {running === 'lighthouse' ? 'Running…' : 'Run Lighthouse Seed'}
          </button>
        </div>
      </AdminCard>

      <AdminCard>
        <AdminCardHeader
          title="Portal Test Access"
          description="Grants admin@monitrax.com.au (and any extra emails) PORTAL_OWNER access on the Smithfield Wealth Advisers org. Run after the lighthouse seed."
        />
        <div className="space-y-3 p-4">
          <label className="block text-sm">
            <span className="text-gray-700">
              Extra emails (comma-separated, optional)
            </span>
            <input
              type="text"
              value={extraEmails}
              onChange={(e) => setExtraEmails(e.target.value)}
              disabled={running !== null}
              placeholder="e.g. ops@monitrax.com.au, qa@monitrax.com.au"
              className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm"
            />
          </label>
          <button
            onClick={() => run('portal-access')}
            disabled={running !== null}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {running === 'portal-access' ? 'Running…' : 'Run Portal Access Seed'}
          </button>
        </div>
      </AdminCard>

      <AdminCard>
        <AdminCardHeader
          title="Feature Flags"
          description="Creates the platform-canonical GlobalFeatureFlag rows (currently BASIQ_INTEGRATION, defaults OFF). Idempotent — never overwrites your toggle state on re-run. After this seed, the flag appears in /admin/feature-flags ready to flip."
        />
        <div className="space-y-3 p-4">
          <p className="text-xs text-gray-500">
            Run this once after the BASIQ toggle ships so the row exists in
            the GlobalFeatureFlag table. Subsequent runs only refresh the
            row&apos;s name + description — your enabled / rollout settings
            are preserved.
          </p>
          <button
            onClick={() => run('feature-flags')}
            disabled={running !== null}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {running === 'feature-flags' ? 'Running…' : 'Run Feature Flag Seed'}
          </button>
        </div>
      </AdminCard>

      <AdminCard>
        <AdminCardHeader title="Output" description="Latest run log." />
        <pre className="m-4 max-h-[480px] overflow-auto rounded-md bg-gray-900 p-4 text-xs text-gray-100">
          {output || '(no run yet)'}
        </pre>
      </AdminCard>
    </div>
  );
}
